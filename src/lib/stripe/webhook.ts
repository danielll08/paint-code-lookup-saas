import "server-only";

import type Stripe from "stripe";
import type { SubscriptionStatus } from "@/lib/database.types";
import { subscriptionCreditRollover } from "@/lib/env";
import { getTopUpPack } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTO_TOPUP_KIND } from "./auto-topup";
import { getStripe, planForSubscription, subscriptionPeriodEnd, topUpForPrice } from "./server";

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Find our user for a Stripe object: explicit metadata first, then the customer id. */
async function resolveUserId(metadataUserId: string | null | undefined, customerId: string | null): Promise<string | null> {
  const admin = createAdminClient();
  if (metadataUserId) {
    const { data } = await admin.from("users").select("id").eq("id", metadataUserId).maybeSingle();
    if (data) return data.id;
  }
  if (customerId) {
    const { data } = await admin.from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    if (data) return data.id;
  }
  return null;
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "inactive"; // incomplete, incomplete_expired, paused
  }
}

async function linkCustomer(userId: string, customerId: string | null) {
  if (!customerId) return;
  await createAdminClient().from("users").update({ stripe_customer_id: customerId }).eq("id", userId).is("stripe_customer_id", null);
}

// --- checkout.session.completed / async_payment_succeeded --------------------
async function handleCheckoutSession(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const customerId = idOf(session.customer);
  const userId = await resolveUserId(session.metadata?.user_id ?? session.client_reference_id, customerId);
  if (!userId) throw new Error(`No user for checkout session ${session.id}`);
  await linkCustomer(userId, customerId);

  // Subscriptions are credited by invoice.paid; only one-off top-ups are handled here.
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return; // async methods: wait for async_payment_succeeded

  // Never trust an amount from the client: map the pack id (or price id) server-side.
  let pack = getTopUpPack(session.metadata?.item_id);
  if (!pack) {
    const items = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
    pack = topUpForPrice(items.data[0]?.price?.id);
  }
  if (!pack) throw new Error(`Unknown top-up pack for checkout session ${session.id}`);

  const { error } = await createAdminClient().rpc("grant_credits", {
    p_user_id: userId,
    p_amount: pack.credits,
    p_type: "TOPUP_PURCHASE",
    p_stripe_event_id: event.id,
    p_description: `Top-up: +${pack.credits} credits`,
  });
  if (error) throw new Error(`grant_credits failed: ${error.message}`);
}

// --- payment_intent.*: automatic (off-session) top-ups ----------------------
async function handleAutoTopUpIntent(event: Stripe.Event, intent: Stripe.PaymentIntent, succeeded: boolean) {
  // Checkout top-ups are credited by checkout.session.completed; only auto top-ups here.
  if (intent.metadata?.kind !== AUTO_TOPUP_KIND) return;
  const userId = await resolveUserId(intent.metadata.user_id, idOf(intent.customer));
  if (!userId) throw new Error(`No user for payment intent ${intent.id}`);
  const admin = createAdminClient();

  if (!succeeded) {
    await admin.from("users").update({ auto_topup_last_error: "Your card was declined for the automatic top-up." }).eq("id", userId);
    return;
  }

  const pack = getTopUpPack(intent.metadata.item_id);
  if (!pack) throw new Error(`Unknown top-up pack for payment intent ${intent.id}`);
  const { error } = await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: pack.credits,
    p_type: "TOPUP_PURCHASE",
    p_stripe_event_id: event.id,
    p_description: `Automatic top-up: +${pack.credits} credits`,
  });
  if (error) throw new Error(`grant_credits failed: ${error.message}`);
  await admin.from("users").update({ auto_topup_last_error: null }).eq("id", userId);
}

// --- invoice.paid: monthly allowance ----------------------------------------
async function handleInvoicePaid(event: Stripe.Event, invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return; // not a subscription invoice

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const plan = planForSubscription(subscription);
  if (!plan) throw new Error(`Cannot map subscription ${subscriptionId} to a plan`);

  const customerId = idOf(subscription.customer);
  const userId = await resolveUserId(subscription.metadata?.user_id, customerId);
  if (!userId) throw new Error(`No user for subscription ${subscriptionId}`);
  await linkCustomer(userId, customerId);

  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_subscription_credits", {
    p_user_id: userId,
    p_amount: plan.credits,
    p_stripe_event_id: event.id,
    p_tier: plan.id,
    p_period_end: subscriptionPeriodEnd(subscription),
    p_rollover: subscriptionCreditRollover(),
    p_description: `${plan.name} plan: +${plan.credits} monthly credits`,
  });
  if (error) throw new Error(`grant_subscription_credits failed: ${error.message}`);

  await admin.from("users").update({ stripe_subscription_id: subscription.id }).eq("id", userId);
}

// --- invoice.payment_failed: PRD 5.3 ----------------------------------------
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return;
  const userId = await resolveUserId(null, idOf(invoice.customer));
  if (!userId) return;
  // Top-up credits stay usable; the dashboard shows an "update your card" banner.
  await createAdminClient().from("users").update({ subscription_status: "past_due" }).eq("id", userId);
}

// --- customer.subscription.* ------------------------------------------------
async function handleSubscriptionChange(subscription: Stripe.Subscription, deleted: boolean) {
  const userId = await resolveUserId(subscription.metadata?.user_id, idOf(subscription.customer));
  if (!userId) throw new Error(`No user for subscription ${subscription.id}`);
  const admin = createAdminClient();

  const { data: current } = await admin.from("users").select("stripe_subscription_id").eq("id", userId).single();
  // Ignore events about an older subscription once the user has moved to a new one.
  if (current?.stripe_subscription_id && current.stripe_subscription_id !== subscription.id) return;

  if (deleted) {
    await admin
      .from("users")
      .update({ subscription_status: "canceled", subscription_tier: null, stripe_subscription_id: null, current_period_end: null })
      .eq("id", userId);

    if (!subscriptionCreditRollover()) {
      const { error } = await admin.rpc("expire_subscription_credits", {
        p_user_id: userId,
        p_description: "Subscription cancelled: monthly credits expired (top-up credits kept)",
      });
      if (error) throw new Error(`expire_subscription_credits failed: ${error.message}`);
    }
    return;
  }

  const plan = planForSubscription(subscription);
  await admin
    .from("users")
    .update({
      subscription_status: mapStatus(subscription.status),
      subscription_tier: plan?.id ?? null,
      stripe_subscription_id: subscription.id,
      current_period_end: subscriptionPeriodEnd(subscription),
    })
    .eq("id", userId);
}

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
] as const;

/** Every handler is idempotent, so Stripe retries are always safe. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutSession(event, event.data.object);
    case "invoice.paid":
      return handleInvoicePaid(event, event.data.object);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return handleSubscriptionChange(event.data.object, false);
    case "customer.subscription.deleted":
      return handleSubscriptionChange(event.data.object, true);
    case "payment_intent.succeeded":
      return handleAutoTopUpIntent(event, event.data.object, true);
    case "payment_intent.payment_failed":
      return handleAutoTopUpIntent(event, event.data.object, false);
    default:
      return;
  }
}
