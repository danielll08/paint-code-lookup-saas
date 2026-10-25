"use client";

import Link from "next/link";
import { Modal } from "@/components/modal";
import { buttonClass } from "@/components/ui";
import { formatPrice, TOPUP_PACKS } from "@/lib/plans";

/** "Not enough credits" popup with one-click top-ups (PRD 2.3 step 3). */
export function BuyCreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="You're out of credits">
      <p className="text-sm text-slate-600">
        Top up to keep looking up paint codes. Top-up credits never expire, and you&apos;re only charged when a paint code is found.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {TOPUP_PACKS.map((pack) => (
          <form key={pack.id} action="/api/stripe/checkout" method="post">
            <input type="hidden" name="kind" value="topup" />
            <input type="hidden" name="item" value={pack.id} />
            <button type="submit" className={buttonClass("secondary", "lg", "h-auto w-full flex-col gap-0 py-3")}>
              <span className="text-lg">{pack.credits} credits</span>
              <span className="text-sm font-normal text-slate-500">{formatPrice(pack.unitAmount)}</span>
            </button>
          </form>
        ))}
      </div>
      <p className="mt-5 text-center text-sm text-slate-600">
        Looking up cars every day?{" "}
        <Link href="/dashboard/billing" className="font-semibold text-brand-600">
          See monthly plans
        </Link>
      </p>
    </Modal>
  );
}
