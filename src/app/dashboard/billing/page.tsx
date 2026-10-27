import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingTabs } from "@/components/landing/pricing-tabs";
import { Alert, buttonClass, Card, cn } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import type { CreditTransaction, TransactionType } from "@/lib/database.types";
import { isHostedSupabaseConfigured } from "@/lib/oauth-config";
import { formatPrice, getPlan, getTopUpPack, TOPUP_PACKS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { saveAutoTopUp } from "./actions";

export const metadata: Metadata = { title: "Billing & credits" };

const ERRORS: Record<string, string> = {
  checkout_failed: "We couldn't start the checkout. Please try again.",
  portal_failed: "We couldn't open the billing portal. Please try again.",
  unknown_plan: "That plan doesn't exist.",
  unknown_pack: "That top-up pack doesn't exist.",
  invalid_request: "Invalid request.",
  auto_topup_failed: "We couldn't save your automatic top-up setting. Please try again.",
};

const TX_LABEL: Record<TransactionType, string> = {
  SUBSCRIPTION_CREDIT: "Monthly plan credits",
  SUBSCRIPTION_EXPIRY: "Monthly credits expired",
  TOPUP_PURCHASE: "Top-up purchase",
  LOOKUP_DEDUCTION: "Lookup",
  LOOKUP_REFUND: "Refund",
  ADMIN_ADJUSTMENT: "Adjustment",
};

const STATUS_TEXT = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed",
  canceled: "Cancelled",
  inactive: "No plan",
} as const;

type Profile = Awaited<ReturnType<typeof getProfile>>;

function CurrentPlan({ profile }: { profile: Profile }) {
  const plan = getPlan(profile.subscription_tier);
  const hasPlan = plan && ["active", "trialing", "past_due"].includes(profile.subscription_status);
  const topUpCredits = profile.credit_balance - profile.subscription_credits;
  const renews = profile.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="overflow-hidden border border-ink-950/20 bg-white">
      <div className="h-1 bg-brand-600" />
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-ink-400">Current plan</p>
            {hasPlan ? (
              <>
                <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-ink-950 sm:text-3xl">{plan.name} plan · {plan.credits} credits / month</p>
                <p className="mt-1.5 text-sm text-ink-500">
                  {formatPrice(plan.unitAmount)} / month
                  {renews && <> · renews on {renews}</>}
                </p>
              </>
            ) : (
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-ink-950 sm:text-3xl">Pay as you go</p>
            )}
            <span
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.12em]",
                profile.subscription_status === "past_due"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : hasPlan
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-ink-950/15 bg-paper text-ink-500",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5",
                  profile.subscription_status === "past_due"
                    ? "bg-amber-500"
                    : hasPlan
                      ? "bg-emerald-500"
                      : "bg-ink-300",
                )}
              />
              {STATUS_TEXT[profile.subscription_status]}
            </span>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-ink-950/10 border border-ink-950/15 bg-paper text-center">
            {[
              { label: "Total", value: profile.credit_balance },
              { label: "Monthly", value: profile.subscription_credits },
              { label: "Top-up", value: topUpCredits },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-3 sm:px-6">
                <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-ink-400">{stat.label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold leading-none tracking-[-0.03em] text-ink-950">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-ink-950/10 pt-6 sm:flex-row sm:items-center">
          <form action="/api/stripe/portal" method="post">
            <button
              type="submit"
              className={buttonClass("secondary", "md", "w-full whitespace-nowrap sm:w-auto")}
              disabled={!profile.stripe_customer_id}
            >
              Manage Subscription / Invoices
            </button>
          </form>
          <p className="text-sm text-ink-500">Change card, download PDF invoices or cancel in the secure Stripe portal. Top-up credits never expire.</p>
        </div>
      </div>
    </div>
  );
}

function AutoTopUp({ profile }: { profile: Profile }) {
  const current = getTopUpPack(profile.auto_topup_pack);
  return (
    <Card className="border border-ink-950/20 p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-xl items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center bg-brand-600 text-white" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-ink-950">Automatic top-up</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              When your balance reaches 0 we charge your saved card for a top-up pack, so lookups never stop mid-shift.{" "}
              {current ? (
                <span className="font-medium text-emerald-700" data-testid="auto-topup-status">
                  On: {current.credits} credits for {formatPrice(current.unitAmount)} when you run out.
                </span>
              ) : (
                <span className="font-medium text-ink-500" data-testid="auto-topup-status">
                  Off.
                </span>
              )}
            </p>
            <p className="mt-1.5 text-xs text-ink-500">
              Uses the card from your subscription, or the card from your next top-up purchase. At most one charge every 10 minutes.
            </p>
          </div>
        </div>
        <form action={saveAutoTopUp} className="flex w-full items-center gap-2 md:w-auto">
          <label htmlFor="auto-topup-pack" className="sr-only">
            Automatic top-up pack
          </label>
          <select
            id="auto-topup-pack"
            name="pack"
            defaultValue={current?.id ?? ""}
            className="h-10 min-w-0 flex-1 rounded-[2px] border border-ink-950/20 bg-white px-3 text-sm text-ink-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 md:w-52 md:flex-none"
          >
            <option value="">Off</option>
            {TOPUP_PACKS.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.credits} credits · {formatPrice(pack.unitAmount)}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass("secondary", "md")}>
            Save
          </button>
        </form>
      </div>
      {current && profile.auto_topup_last_error && (
        <Alert tone="error" className="mt-4">
          {profile.auto_topup_last_error}
        </Alert>
      )}
    </Card>
  );
}

function Ledger({ transactions }: { transactions: CreditTransaction[] }) {
  return (
    <Card className="overflow-hidden border border-ink-950/20">
      <div className="flex items-center gap-3 border-b border-ink-950/15 p-5">
        <span className="grid h-9 w-9 place-items-center border border-ink-950/15 bg-paper text-ink-700" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 5h16v14H4z" />
            <path d="M4 9h16M8 13h3M8 16h6" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.025em] text-ink-950">Credit history</h2>
          <p className="mt-0.5 text-xs text-ink-500">Every credit added, spent or refunded.</p>
        </div>
      </div>
      {transactions.length === 0 ? (
        <p className="p-10 text-center text-sm text-ink-500">No credit movements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-ink-950/10 bg-paper-deep/50 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 text-right font-medium">Change</th>
                <th className="px-4 py-3 text-right font-medium sm:px-5">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-950/10">
              {transactions.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-brand-50/50">
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs text-ink-500 sm:px-5">
                    {new Date(tx.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-medium text-ink-950">{TX_LABEL[tx.transaction_type]}</td>
                  <td className="px-4 py-3.5 text-ink-600">{tx.description}</td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-4 py-3.5 text-right font-semibold",
                      tx.amount > 0 ? "text-emerald-700" : "text-ink-950",
                    )}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-ink-500 sm:px-5">{tx.balance_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

async function BillingContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, profile] = await Promise.all([searchParams, getProfile()]);
  let transactions: CreditTransaction[] = [];

  if (isHostedSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) transactions = data;
    } catch {
      // Supabase unavailable in standalone mode
    }
  }

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const activeTier = ["active", "trialing", "past_due"].includes(profile.subscription_status) ? profile.subscription_tier : null;

  return (
    <div className="space-y-8">
      {params.canceled && <Alert>Checkout cancelled - you have not been charged.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {params.auto_topup === "on" && <Alert tone="success">Automatic top-up is on.</Alert>}
      {params.auto_topup === "off" && <Alert>Automatic top-up is off.</Alert>}
      <CurrentPlan profile={profile} />
      <AutoTopUp profile={profile} />
      <section>
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-ink-950/15 pb-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink-950">Buy credits</h2>
            <p className="mt-0.5 text-sm text-ink-500">Top up once, or switch to a monthly plan.</p>
          </div>
        </div>
        <PricingTabs checkout activeTier={activeTier} />
      </section>
      <Ledger transactions={transactions} />
    </div>
  );
}

export default function BillingPage(props: PageProps<"/dashboard/billing">) {
  return (
    <div className="space-y-6">
      <div className="border-b border-ink-950/15 pb-5">
        <p className="flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
          <span className="h-1.5 w-1.5 bg-brand-600" aria-hidden />
          Account / 03
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-ink-950 sm:text-4xl">Billing & credits</h1>
        <p className="mt-2 text-sm text-ink-500">Manage your plan, top-ups and credit activity.</p>
      </div>
      <Suspense fallback={<Card className="h-72 animate-pulse border border-ink-950/20">{null}</Card>}>
        <BillingContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
