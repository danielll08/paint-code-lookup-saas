"use client";

import { useState } from "react";
import { buttonClass, ButtonLink, cn } from "@/components/ui";
import { formatPrice, SUBSCRIPTION_PLANS, TOPUP_PACKS } from "@/lib/plans";

type Tab = "monthly" | "topup";

/**
 * Pricing table with Monthly Plans vs Pay-as-you-go top-ups (PRD 3.2.1).
 * With `checkout` set, buttons post straight to Stripe Checkout (billing page);
 * otherwise they lead to sign-up (landing page).
 */
export function PricingTabs({ checkout = false, activeTier }: { checkout?: boolean; activeTier?: string | null }) {
  const [tab, setTab] = useState<Tab>("monthly");

  return (
    <div>
      <div className="mx-auto mb-8 flex w-fit rounded-xl bg-slate-200/70 p-1" role="tablist">
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
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "monthly" ? (
        <div className="grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = activeTier === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1",
                  plan.highlighted ? "ring-2 ring-brand-600" : "ring-slate-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.highlighted && (
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Most popular</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-5">
                  <span className="text-4xl font-bold tracking-tight">{formatPrice(plan.unitAmount)}</span>
                  <span className="text-sm text-slate-500"> / month</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                  <li>✓ {plan.credits} lookups every month</li>
                  <li>✓ {formatPrice(Math.round(plan.unitAmount / plan.credits))} per lookup</li>
                  <li>✓ Full lookup history & free re-checks (30 days)</li>
                  <li>✓ Cancel any time</li>
                </ul>
                {checkout ? (
                  <form action="/api/stripe/checkout" method="post" className="mt-6">
                    <input type="hidden" name="kind" value="subscription" />
                    <input type="hidden" name="item" value={plan.id} />
                    <button
                      type="submit"
                      disabled={isCurrent}
                      className={buttonClass(plan.highlighted ? "primary" : "secondary", "md", "w-full")}
                    >
                      {isCurrent ? "Current plan" : activeTier ? "Change plan" : `Subscribe to ${plan.name}`}
                    </button>
                  </form>
                ) : (
                  <ButtonLink
                    href={`/signup?next=${encodeURIComponent("/dashboard/billing")}`}
                    variant={plan.highlighted ? "primary" : "secondary"}
                    className="mt-6 w-full"
                  >
                    Start with {plan.name}
                  </ButtonLink>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {TOPUP_PACKS.map((pack) => (
            <div key={pack.id} className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold">{pack.credits} credits</h3>
              <p className="mt-1 text-sm text-slate-500">One-off purchase. Credits never expire.</p>
              <p className="mt-5">
                <span className="text-4xl font-bold tracking-tight">{formatPrice(pack.unitAmount)}</span>
              </p>
              <p className="mt-1 flex-1 text-sm text-slate-600">
                {formatPrice(Math.round(pack.unitAmount / pack.credits))} per lookup
              </p>
              {checkout ? (
                <form action="/api/stripe/checkout" method="post" className="mt-6">
                  <input type="hidden" name="kind" value="topup" />
                  <input type="hidden" name="item" value={pack.id} />
                  <button type="submit" className={buttonClass("secondary", "md", "w-full")}>
                    Buy {pack.credits} credits
                  </button>
                </form>
              ) : (
                <ButtonLink
                  href={`/signup?next=${encodeURIComponent("/dashboard/billing")}`}
                  variant="secondary"
                  className="mt-6 w-full"
                >
                  Buy {pack.credits} credits
                </ButtonLink>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
