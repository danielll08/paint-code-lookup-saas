import type { Metadata } from "next";
import { ButtonLink, Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Payment received" };

// Deliberately does NOT add credits (PRD 3.3.B): the browser redirect can be
// replayed or forged. Credits arrive via the signed Stripe webhook, and the
// dashboard badge updates live when they do.
export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-4 py-16 text-center">
      <div className="flex w-full max-w-lg flex-col items-center">
        <Logo />
        <div className="mt-10 w-full border border-ink-950/20 border-t-2 border-t-brand-600 bg-white p-8 sm:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center border border-emerald-200 bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.04em] text-ink-950 sm:text-4xl">Payment received</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-600">
            Thank you! Your credits are being added to your account and will appear in a few seconds.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/dashboard" size="lg">
              Start a lookup
            </ButtonLink>
            <ButtonLink href="/dashboard/billing" variant="secondary" size="lg">
              View billing
            </ButtonLink>
          </div>
        </div>
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-400">You can safely close this tab - your credits are applied automatically.</p>
      </div>
    </div>
  );
}
