import type { Metadata } from "next";
import { ButtonLink, Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Payment received" };

// Deliberately does NOT add credits (PRD 3.3.B): the browser redirect can be
// replayed or forged. Credits arrive via the signed Stripe webhook, and the
// dashboard badge updates live when they do.
export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo />
      <div className="mt-10 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
      <h1 className="mt-6 text-3xl font-bold">Payment received</h1>
      <p className="mt-3 max-w-md text-slate-600">
        Thank you! Your credits are being added to your account and will appear in a few seconds.
      </p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/dashboard" size="lg">
          Start a lookup
        </ButtonLink>
        <ButtonLink href="/dashboard/billing" variant="secondary" size="lg">
          View billing
        </ButtonLink>
      </div>
    </div>
  );
}
