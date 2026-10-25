// Public pricing catalogue (safe for the browser). Prices are placeholders until
// the client confirms the tiers (PRD 7.1); Stripe Price IDs live in env vars.
import type { SubscriptionTier } from "@/lib/database.types";

export type SubscriptionPlan = {
  id: SubscriptionTier;
  name: string;
  credits: number;
  unitAmount: number; // minor units (pence)
  description: string;
  highlighted?: boolean;
};

export type TopUpPack = {
  id: "topup_5" | "topup_10" | "topup_25";
  credits: number;
  unitAmount: number;
};

export const CURRENCY_SYMBOL = "£";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "starter", name: "Starter", credits: 15, unitAmount: 1499, description: "For mobile smart repairers." },
  { id: "pro", name: "Pro", credits: 50, unitAmount: 3999, description: "For busy bodyshops.", highlighted: true },
  { id: "agency", name: "Agency", credits: 200, unitAmount: 11999, description: "For paint mixers & multi-site garages." },
];

export const TOPUP_PACKS: TopUpPack[] = [
  { id: "topup_5", credits: 5, unitAmount: 599 },
  { id: "topup_10", credits: 10, unitAmount: 1099 },
  { id: "topup_25", credits: 25, unitAmount: 2499 },
];

export function formatPrice(unitAmount: number): string {
  return `${CURRENCY_SYMBOL}${(unitAmount / 100).toFixed(2)}`;
}

export function getPlan(id: string | null | undefined): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}

export function getTopUpPack(id: string | null | undefined): TopUpPack | undefined {
  return TOPUP_PACKS.find((pack) => pack.id === id);
}
