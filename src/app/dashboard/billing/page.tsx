import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingTabs } from "@/components/landing/pricing-tabs";
import { Alert, buttonClass, Card, cn } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import type { CreditTransaction, TransactionType } from "@/lib/database.types";
import { formatPrice, getPlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Billing & credits" };

const ERRORS: Record<string, string> = {
  checkout_failed: "We couldn't start the checkout. Please try again.",
  portal_failed: "We couldn't open the billing portal. Please try again.",
  unknown_plan: "That plan doesn't exist.",
  unknown_pack: "That top-up pack doesn't exist.",
  invalid_request: "Invalid request.",
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

function CurrentPlan({ profile }: { profile: Awaited<ReturnType<typeof getProfile>> }) {
  const plan = getPlan(profile.subscription_tier);
  const hasPlan = plan && ["active", "trialing", "past_due"].includes(profile.subscription_status);
  const topUpCredits = profile.credit_balance - profile.subscription_credits;
  const renews = profile.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Current plan</p>
          {hasPlan ? (
            <>
              <p className="mt-1 text-2xl font-bold">
                {plan.name} plan · {plan.credits} credits / month
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {formatPrice(plan.unitAmount)} / month
                {renews && <> · renews on {renews}</>}
              </p>
            </>
          ) : (
            <p className="mt-1 text-2xl font-bold">Pay as you go</p>
          )}
          <span
            className={cn(
              "mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
              profile.subscription_status === "past_due"
                ? "bg-amber-50 text-amber-800 ring-amber-200"
                : hasPlan
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200",
            )}
          >
            {STATUS_TEXT[profile.subscription_status]}
          </span>
        </div>

        <dl className="grid grid-cols-3 gap-4 rounded-xl bg-slate-50 p-4 text-center ring-1 ring-slate-200">
          <div>
            <dt className="text-xs text-slate-500">Total</dt>
            <dd className="text-2xl font-bold">{profile.credit_balance}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Monthly</dt>
            <dd className="text-2xl font-bold">{profile.subscription_credits}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Top-up</dt>
            <dd className="text-2xl font-bold">{topUpCredits}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        <form action="/api/stripe/portal" method="post">
          <button type="submit" className={buttonClass("secondary")} disabled={!profile.stripe_customer_id}>
            Manage Subscription / Invoices
          </button>
        </form>
        <p className="text-sm text-slate-500">
          Change card, download PDF invoices or cancel in the secure Stripe portal. Top-up credits never expire.
        </p>
      </div>
    </Card>
  );
}

function Ledger({ transactions }: { transactions: CreditTransaction[] }) {
  return (
    <Card>
      <h2 className="border-b border-slate-200 p-4 font-semibold">Credit history</h2>
      {transactions.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">No credit movements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 text-right font-medium">Change</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(tx.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{TX_LABEL[tx.transaction_type]}</td>
                  <td className="px-4 py-3 text-slate-600">{tx.description}</td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-right font-semibold",
                      tx.amount > 0 ? "text-emerald-600" : "text-slate-900",
                    )}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{tx.balance_after}</td>
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
  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const activeTier = ["active", "trialing", "past_due"].includes(profile.subscription_status) ? profile.subscription_tier : null;

  return (
    <div className="space-y-8">
      {params.canceled && <Alert>Checkout cancelled - you have not been charged.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <CurrentPlan profile={profile} />
      <section>
        <h2 className="mb-4 text-lg font-semibold">Buy credits</h2>
        <PricingTabs checkout activeTier={activeTier} />
      </section>
      <Ledger transactions={transactions ?? []} />
    </div>
  );
}

export default function BillingPage(props: PageProps<"/dashboard/billing">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing & credits</h1>
      <Suspense fallback={<Card className="h-72 animate-pulse">{null}</Card>}>
        <BillingContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
