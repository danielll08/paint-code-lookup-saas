import "server-only";

import Stripe from "stripe";
import { stripeCurrency, stripeSecretKey } from "@/lib/env";
import { getPlan, SUBSCRIPTION_PLANS, TOPUP_PACKS, type SubscriptionPlan, type TopUpPack } from "@/lib/plans";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  // STRIPE_API_BASE points the SDK at stripe-mock in automated tests; unset in real deployments.
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  stripe ??= new Stripe(stripeSecretKey(), {
    appInfo: { name: "paint-code-lookup" },
    maxNetworkRetries: 2,
    ...(base && {
      host: base.hostname,
      port: base.port,
      protocol: base.protocol === "http:" ? "http" : "https",
    }),
  });
  return stripe;
}

const PLAN_PRICE_ENV: Record<SubscriptionPlan["id"], string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  agency: process.env.STRIPE_PRICE_AGENCY,
};

const TOPUP_PRICE_ENV: Record<TopUpPack["id"], string | undefined> = {
  topup_5: process.env.STRIPE_PRICE_TOPUP_5,
  topup_10: process.env.STRIPE_PRICE_TOPUP_10,
  topup_25: process.env.STRIPE_PRICE_TOPUP_25,
};

/**
 * Uses the configured Stripe Price when present, otherwise inline price_data so
 * the app works in test mode with nothing but a secret key.
 */
export function planLineItem(plan: SubscriptionPlan): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = PLAN_PRICE_ENV[plan.id];
  if (price) return { price, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: stripeCurrency(),
      unit_amount: plan.unitAmount,
      recurring: { interval: "month" },
      product_data: { name: `${plan.name} plan - ${plan.credits} credits / month` },
    },
  };
}

export function topUpLineItem(pack: TopUpPack): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = TOPUP_PRICE_ENV[pack.id];
  if (price) return { price, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: stripeCurrency(),
      unit_amount: pack.unitAmount,
      product_data: { name: `${pack.credits} paint code lookup credits` },
    },
  };
}

/** Resolve which plan a subscription is on: configured price id first, then metadata. */
export function planForSubscription(subscription: Stripe.Subscription): SubscriptionPlan | undefined {
  const priceId = subscription.items.data[0]?.price?.id;
  const byPrice = SUBSCRIPTION_PLANS.find((plan) => priceId && PLAN_PRICE_ENV[plan.id] === priceId);
  return byPrice ?? getPlan(subscription.metadata?.plan_id);
}

export function topUpForPrice(priceId: string | undefined): TopUpPack | undefined {
  return TOPUP_PACKS.find((pack) => priceId && TOPUP_PRICE_ENV[pack.id] === priceId);
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}
