import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Google OAuth, email confirmation and password recovery all land here with ?code=
// (PKCE). Exchange it for a session cookie, then continue to `next`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
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
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      // Self-healing profile sync: ensure Google user metadata (full name) is saved into public.users
      try {
        const admin = createAdminClient();
        const fullName =
          data.user.user_metadata?.full_name ??
          data.user.user_metadata?.name ??
          null;
        const email = data.user.email ?? `${data.user.id}@users.invalid`;
        await admin.from("users").upsert(
          {
            id: data.user.id,
            email,
            full_name: fullName,
          },
          { onConflict: "id" },
        );
      } catch (err) {
        // Non-fatal warning - trigger or fallback will safeguard
        console.warn("[auth/callback] profile sync notice:", err);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  const reason = errorDescription ?? "The sign-in link is invalid or has expired.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
