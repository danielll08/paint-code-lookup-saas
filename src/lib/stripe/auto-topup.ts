import "server-only";

import type Stripe from "stripe";
import { stripeCurrency } from "@/lib/env";
import { getTopUpPack } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./server";

export const AUTO_TOPUP_KIND = "auto_topup";

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** The card Stripe would charge: the customer's default, else the newest saved card. */
async function savedPaymentMethod(stripe: Stripe, customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const preferred = idOf(customer.invoice_settings?.default_payment_method);
  if (preferred) return preferred;
  const cards = await stripe.customers.listPaymentMethods(customerId, { type: "card", limit: 1 });
  return cards.data[0]?.id ?? null;
}

/**
 * Called after a lookup leaves the balance at 0. Charges the user's chosen pack
 * off-session when they opted in. Credits are NOT granted here: the
 * payment_intent.succeeded webhook does that, exactly once per event.
 */
export async function maybeAutoTopUp(userId: string): Promise<void> {
  const admin = createAdminClient();
  // Locks the row and stamps the attempt, so concurrent calls charge at most once.
  const { data: packId, error } = await admin.rpc("claim_auto_topup", { p_user_id: userId });
  if (error) throw new Error(`claim_auto_topup failed: ${error.message}`);
  const pack = getTopUpPack(packId);
  if (!pack) return;

  const { data: profile } = await admin
    .from("users")
    .select("stripe_customer_id, auto_topup_attempted_at")
    .eq("id", userId)
    .single();
  const customerId = profile?.stripe_customer_id;
  if (!customerId) return;

  const fail = (message: string) => admin.from("users").update({ auto_topup_last_error: message }).eq("id", userId);
  const stripe = getStripe();

  try {
    const paymentMethod = await savedPaymentMethod(stripe, customerId);
    if (!paymentMethod) {
      await fail("No saved card. Buy a top-up once to save a card for automatic top-ups.");
      return;
    }
    await stripe.paymentIntents.create(
      {
        amount: pack.unitAmount,
        currency: stripeCurrency(),
        customer: customerId,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        description: `Automatic top-up: ${pack.credits} paint code lookup credits`,
        metadata: { user_id: userId, kind: AUTO_TOPUP_KIND, item_id: pack.id },
      },
      // One charge per claimed attempt, even if Stripe retries the request.
      { idempotencyKey: `auto-topup-${userId}-${profile?.auto_topup_attempted_at}` },
    );
  } catch (err) {
    const message =
      (err as Stripe.errors.StripeError)?.code === "authentication_required"
        ? "Your bank asked for confirmation. Buy a top-up manually to continue."
        : "Your card was declined for the automatic top-up.";
    await fail(message);
    console.error("[auto-topup]", err);
  }
}
