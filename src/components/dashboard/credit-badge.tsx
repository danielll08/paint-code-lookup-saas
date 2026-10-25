"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export const CREDITS_EVENT = "credits:updated";

/** Tell the badge about a balance we already know (e.g. from a lookup response). */
export function announceBalance(balance: number) {
  window.dispatchEvent(new CustomEvent<number>(CREDITS_EVENT, { detail: balance }));
}

/** Live credit balance: Supabase Realtime on the user's row + local announcements. */
export function CreditBadge({ userId, initialBalance }: { userId: string; initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const update = (value: number) => {
      setBalance((previous) => {
        if (previous !== value) {
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
        }
        return value;
      });
    };

    const onAnnounce = (event: Event) => update((event as CustomEvent<number>).detail);
    window.addEventListener(CREDITS_EVENT, onAnnounce);

    const supabase = createClient();
    const channel = supabase
      .channel(`credits:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { credit_balance?: number }).credit_balance;
          if (typeof next === "number") update(next);
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener(CREDITS_EVENT, onAnnounce);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition-colors",
        balance > 0 ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200",
        flash && "bg-amber-200",
      )}
      aria-live="polite"
    >
      <span aria-hidden>⚡</span>
      <span>
        {balance} {balance === 1 ? "Credit" : "Credits"}
        <span className="hidden sm:inline"> remaining</span>
      </span>
    </span>
  );
}
