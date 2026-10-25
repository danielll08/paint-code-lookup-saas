import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/env";

// Pages a signed-in user should never see again (PRD 2.2 / 3.1).
const GUEST_ONLY_PATHS = new Set(["/", "/login", "/signup"]);
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the Supabase session cookie and applies the routing rules:
 *   - signed in  + "/" | "/login" | "/signup"  -> 307 /dashboard
 *   - signed out + "/dashboard/**"             -> 307 /login?next=...
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

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

  // getClaims() verifies the JWT signature; do not trust getSession() here.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

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
