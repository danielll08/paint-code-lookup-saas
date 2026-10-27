"use client";

import Link from "next/link";
import { Modal } from "@/components/modal";
import { buttonClass } from "@/components/ui";
import { formatPrice, TOPUP_PACKS } from "@/lib/plans";

/** "Not enough credits" popup with one-click top-ups (PRD 2.3 step 3). */
export function BuyCreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="You're out of credits">
      <div className="flex items-start gap-3 border border-brand-200 bg-brand-50 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center bg-brand-600 text-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
          </svg>
        </span>
        <p className="text-sm leading-relaxed text-ink-600">
          Top up to keep looking up paint codes. Top-up credits never expire, and you&apos;re only charged when a paint code is found.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {TOPUP_PACKS.map((pack) => (
          <form key={pack.id} action="/api/stripe/checkout" method="post">
            <input type="hidden" name="kind" value="topup" />
            <input type="hidden" name="item" value={pack.id} />
            <button
              type="submit"
              className={buttonClass(
                "secondary",
                "lg",
                "group h-auto w-full flex-col gap-0.5 py-3.5 hover:border-brand-600 hover:bg-brand-50",
              )}
            >
              <span className="text-lg font-semibold tracking-[-0.02em] text-ink-950">{pack.credits} credits</span>
              <span className="text-sm font-normal text-ink-500">{formatPrice(pack.unitAmount)}</span>
              <span className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                Buy now
              </span>
            </button>
          </form>
        ))}
      </div>
      <p className="mt-5 text-center text-sm text-ink-500">
        Looking up cars every day?{" "}
        <Link href="/dashboard/billing" className="font-semibold text-brand-600 hover:text-brand-700">
          See monthly plans
        </Link>
      </p>
    </Modal>
  );
}
