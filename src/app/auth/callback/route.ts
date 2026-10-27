import { NextResponse, type NextRequest } from "next/server";
import { getGoogleClientId, getGoogleClientSecret, isHostedSupabaseConfigured } from "@/lib/oauth-config";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { getStandaloneProfile } from "@/lib/standalone-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const next = safeNextPath(state || searchParams.get("next") || "/dashboard");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth provider errors gracefully (e.g. user cancelled Google consent)
  if (oauthError) {
    const message =
      oauthError === "access_denied"
        ? "Google sign-in was cancelled."
        : (errorDescription ?? oauthError);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  if (code) {
    // 1. If hosted/local Supabase is configured, attempt standard Supabase exchange
    if (isHostedSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.user) {
          try {
            const admin = createAdminClient();
            const fullName =
              data.user.user_metadata?.full_name ??
              data.user.user_metadata?.name ??
              null;
            const email = data.user.email ?? `${data.user.id}@users.invalid`;
            await admin.from("users").upsert(
              { id: data.user.id, email, full_name: fullName },
              { onConflict: "id" }
            );
          } catch (err) {
            console.warn("[auth/callback] profile sync notice:", err);
          }
          return NextResponse.redirect(`${origin}${next}`);
        }
      } catch (err) {
        console.warn("[auth/callback] Supabase exchange failed, attempting direct Google exchange:", err);
      }
    }

    // 2. Resilient Direct Google OAuth exchange (Autonomous zero-config mode)
    try {
      const clientId = getGoogleClientId();
      const clientSecret = getGoogleClientSecret();
      const redirectUri = `${origin}/auth/callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[auth/callback] Google token exchange failed:", errText);
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Google authentication failed. Please try again.")}`);
      }

      const tokens = await tokenRes.json();
      let userId = `google_${Date.now()}`;
      let userEmail: string | null = null;
      let userName: string | null = null;
      let userPicture: string | undefined = undefined;

      // Extract identity from userinfo endpoint
      if (tokens.access_token) {
        try {
          const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (userinfoRes.ok) {
            const info = await userinfoRes.json();
            if (info.sub) userId = info.sub;
            if (info.email) userEmail = info.email;
            if (info.name) userName = info.name;
            if (info.picture) userPicture = info.picture;
          }
        } catch (err) {
          console.warn("[auth/callback] Userinfo fetch error:", err);
        }
      }

      // Fallback decoding from id_token
      if (!userEmail && tokens.id_token) {
        try {
          const payloadPart = tokens.id_token.split(".")[1];
          const decoded = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf8"));
          if (decoded.sub) userId = decoded.sub;
          if (decoded.email) userEmail = decoded.email;
          if (decoded.name) userName = decoded.name;
          if (decoded.picture) userPicture = decoded.picture;
        } catch {
          // Ignore
        }
      }

      // Initialize standalone user state with 50 credits
      await getStandaloneProfile(userId, userEmail, userName);

      // Create signed session token and set paint_session cookie
      const sessionToken = await createSessionToken({
        id: userId,
        email: userEmail,
        name: userName ?? undefined,
        picture: userPicture,
      });

      const response = NextResponse.redirect(`${origin}${next}`);
      setSessionCookie(response, sessionToken);
      return response;
    } catch (directOAuthError: unknown) {
      console.error("[auth/callback] direct OAuth handler exception:", directOAuthError);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Google sign-in encountered an error.")}`);
    }
  }

  const reason = errorDescription ?? "The sign-in link is invalid or has expired.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
