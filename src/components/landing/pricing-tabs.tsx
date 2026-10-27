"use client";

import { useState } from "react";
import { buttonClass, ButtonLink, cn } from "@/components/ui";
import { formatPrice, SUBSCRIPTION_PLANS, TOPUP_PACKS } from "@/lib/plans";

type Tab = "monthly" | "topup";

function PlanCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("h-4 w-4 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m4.5 10.5 3.4 3.4 7.6-7.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pricing table with Monthly Plans vs Pay-as-you-go top-ups (PRD 3.2.1).
 * With `checkout` set, buttons post straight to Stripe Checkout (billing page);
 * otherwise they lead to sign-up (landing page).
 */
export function PricingTabs({ checkout = false, activeTier }: { checkout?: boolean; activeTier?: string | null }) {
  const [tab, setTab] = useState<Tab>("monthly");

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-ink-950/15 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-2" role="tablist">
          {(
            [
              ["monthly", "Monthly plans"],
              ["topup", "Pay as you go"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "border px-3.5 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors",
                tab === id
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-ink-950/20 bg-white text-ink-500 hover:border-ink-950/45 hover:text-ink-950",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-400">No contracts / cancel anytime</p>
      </div>

      {tab === "monthly" ? (
        <div className="border-t border-ink-950/15">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = activeTier === plan.id;
            const featured = Boolean(plan.highlighted);
            return (
              <article
                key={plan.id}
                className={cn(
                  "grid gap-6 border-b border-ink-950/15 px-4 py-7 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_12rem] md:items-center",
                  featured && "border-l-2 border-l-brand-600 bg-brand-50/50",
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl font-semibold leading-none tracking-[-0.025em]">{plan.name}</h3>
                    {featured && (
                      <span className="border border-brand-200 bg-white px-1.5 py-1 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.12em] text-brand-700">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink-500">{plan.description}</p>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold leading-none tracking-[-0.03em]">
                      {formatPrice(plan.unitAmount)}
                    </span>
                    <span className="text-sm text-ink-500">/ month</span>
                  </p>
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-400">
                    {formatPrice(Math.round(plan.unitAmount / plan.credits))} per successful lookup
                  </p>
                </div>

                <ul className="grid gap-x-6 gap-y-2 text-sm text-ink-600 sm:grid-cols-2">
                  <li className="flex items-start gap-2">
                    <PlanCheck className="mt-0.5 text-brand-600" />
                    <span>
                      <strong className="font-semibold text-ink-950">{plan.credits} lookups</strong> every month
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <PlanCheck className="mt-0.5 text-brand-600" />
                    Full lookup history & free re-checks (30 days)
                  </li>
                  <li className="flex items-start gap-2">
                    <PlanCheck className="mt-0.5 text-brand-600" />
                    Print-ready workshop job sheets
                  </li>
                  <li className="flex items-start gap-2">
                    <PlanCheck className="mt-0.5 text-brand-600" />
                    Cancel any time
                  </li>
                </ul>

                <div>
                  {checkout ? (
                    <form action="/api/stripe/checkout" method="post">
                      <input type="hidden" name="kind" value="subscription" />
                      <input type="hidden" name="item" value={plan.id} />
                      <button
                        type="submit"
                        disabled={isCurrent}
                        className={buttonClass(featured ? "primary" : "secondary", "md", "w-full")}
                      >
                        {isCurrent ? "Current plan" : activeTier ? "Change plan" : `Subscribe to ${plan.name}`}
                      </button>
                    </form>
                  ) : (
                    <ButtonLink
                      href={`/signup?next=${encodeURIComponent("/dashboard/billing")}`}
                      variant={featured ? "primary" : "secondary"}
                      className="w-full"
                    >
                      Start with {plan.name}
                    </ButtonLink>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border-t border-ink-950/15">
          {TOPUP_PACKS.map((pack) => {
            const best = pack.credits === 10;
            return (
              <article
                key={pack.id}
                className={cn(
                  "grid gap-4 border-b border-ink-950/15 px-4 py-6 sm:grid-cols-[minmax(0,1fr)_9rem_12rem] sm:items-center sm:gap-6",
                  best && "border-l-2 border-l-brand-600 bg-brand-50/50",
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl font-semibold leading-none tracking-[-0.025em]">{pack.credits} credits</h3>
                    {best && (
                      <span className="border border-brand-200 bg-white px-1.5 py-1 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.12em] text-brand-700">
                        Best value
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-500">One-off purchase. Credits never expire.</p>
                </div>
                <div>
                  <p className="font-display text-3xl font-semibold leading-none tracking-[-0.03em]">{formatPrice(pack.unitAmount)}</p>
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-400">
                    {formatPrice(Math.round(pack.unitAmount / pack.credits))} per lookup
                  </p>
                </div>
                <div>
                  {checkout ? (
                    <form action="/api/stripe/checkout" method="post">
                      <input type="hidden" name="kind" value="topup" />
                      <input type="hidden" name="item" value={pack.id} />
                      <button type="submit" className={buttonClass(best ? "primary" : "secondary", "md", "w-full")}>
                        Buy {pack.credits} credits
                      </button>
                    </form>
                  ) : (
                    <ButtonLink
                      href={`/signup?next=${encodeURIComponent("/dashboard/billing")}`}
                      variant={best ? "primary" : "secondary"}
                      className="w-full"
                    >
                      Buy {pack.credits} credits
                    </ButtonLink>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
