// Google OAuth & Environment Configuration
// Resolves credentials securely from environment variables.

export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ||
    ""
  );
}

export function getGoogleClientSecret(): string {
  return (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ||
    ""
  );
}

/** Check if Supabase points to an external hosted cloud instance (not localhost/127.0.0.1 in production). */
export function isHostedSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return false;

  // In production (Vercel/Render), localhost is unreachable across serverless functions.
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
  if (process.env.NODE_ENV === "production" && isLocal) {
    return false;
  }

  return true;
}
