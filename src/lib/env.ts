// Central access to configuration. Values are read lazily so that `next build`
// works without secrets; a missing value only fails the request that needs it.

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "MissingEnvError";
  }
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new MissingEnvError(name);
  return value;
}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them.
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function supabaseSecretKey(): string {
  return required(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
}

export function stripeSecretKey(): string {
  return required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
}

export function stripeWebhookSecret(): string {
  return required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripeCurrency(): string {
  return (process.env.STRIPE_CURRENCY ?? "gbp").toLowerCase();
}

/** PRD 3.3.A rollover policy: carry unused monthly credits into the next period? */
export function subscriptionCreditRollover(): boolean {
  return process.env.SUBSCRIPTION_CREDIT_ROLLOVER === "true";
}

/** Ordered provider chain, e.g. "mock-primary,mock-backup" (first = cheapest). */
export function paintApiProviderNames(): string[] {
  return (process.env.PAINT_API_PROVIDERS ?? "mock-primary,mock-backup")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function paintApiTimeoutMs(): number {
  const value = Number(process.env.PAINT_API_TIMEOUT_MS ?? 10_000);
  return Number.isFinite(value) && value > 0 ? value : 10_000;
}
