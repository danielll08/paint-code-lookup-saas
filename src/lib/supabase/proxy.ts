import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { isHostedSupabaseConfigured } from "@/lib/oauth-config";
import { checkEdgeBurstLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

// Pages a signed-in user should never see again (PRD 2.2 / 3.1).
const GUEST_ONLY_PATHS = new Set(["/", "/login", "/signup"]);
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the session cookie and applies the routing rules:
 *   - signed in  + "/" | "/login" | "/signup"  -> 307 /dashboard
 *   - signed out + "/dashboard/**"             -> 307 /login?next=...
 *   - POST /api/lookup flood (> 5 / second)    -> 429
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let isSignedIn = false;
  let userId: string | null = null;

  // 1. Check direct Google OAuth session cookie
  const directToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (directToken) {
    const verified = await verifySessionToken(directToken);
    if (verified?.id) {
      isSignedIn = true;
      userId = verified.id;
    }
  }

  // 2. If not signed in via direct session, check Supabase session if configured
  if (!isSignedIn && isHostedSupabaseConfigured()) {
    try {
      const supabase = createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
          },
        },
      });

      const { data } = await supabase.auth.getClaims();
      if (data?.claims?.sub) {
        isSignedIn = true;
        userId = data.claims.sub;
      }
    } catch {
      // Supabase is unreachable, continue with isSignedIn status
    }
  }

  const { pathname, search } = request.nextUrl;

  // Edge burst guard (PRD 4.1): floods of lookups are rejected here, before any database work.
  if (pathname === "/api/lookup" && request.method === "POST") {
    const key = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const rate = await checkEdgeBurstLimit(key);
    if (!rate.allowed) {
      return NextResponse.json(
        { status: "rate_limited", retryAfterMs: rate.retryAfterMs, message: "Too many requests. Please wait a second." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)), "Cache-Control": "no-store" } },
      );
    }
  }

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target, 307);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (isSignedIn && GUEST_ONLY_PATHS.has(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/dashboard";
    // Carry a plate typed on the landing page through to the search box.
    const vrm = request.nextUrl.searchParams.get("vrm");
    target.search = vrm ? `?vrm=${encodeURIComponent(vrm)}` : "";
    return redirectTo(target);
  }

  if (!isSignedIn && PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectTo(target);
  }

  return response;
}
