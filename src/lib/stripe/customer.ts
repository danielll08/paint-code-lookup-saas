import "server-only";

import type { SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./server";

/** Returns the user's Stripe customer id, creating (and storing) it once. */
export async function ensureStripeCustomer(user: SessionUser): Promise<string> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("email, full_name, stripe_customer_id")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error(`Profile not found: ${error?.message ?? "no row"}`);
  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await getStripe().customers.create(
    {
      email: profile.email,
      name: profile.full_name ?? undefined,
      metadata: { user_id: user.id },
    },
    // Two concurrent clicks create the same customer instead of two.
    { idempotencyKey: `customer-create-${user.id}` },
  );

  // Only set it if still empty, then re-read to return whichever id won.
  await admin.from("users").update({ stripe_customer_id: customer.id }).eq("id", user.id).is("stripe_customer_id", null);
  const { data: updated } = await admin.from("users").select("stripe_customer_id").eq("id", user.id).single();
  return updated?.stripe_customer_id ?? customer.id;
}
