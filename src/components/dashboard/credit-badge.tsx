"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export const CREDITS_EVENT = "credits:updated";

/** Tell the badge about a balance we already know (e.g. from a lookup response). */
export function announceBalance(balance: number) {
  window.dispatchEvent(new CustomEvent<number>(CREDITS_EVENT, { detail: balance }));
}

/** Live credit balance: Supabase Realtime on the user's row + local announcements + focus/poll refresh. */
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

    // Fallback when Realtime is unavailable (blocked websocket, missed event):
    // re-read the balance (RLS: own row only) when the tab regains focus and every 30 s.
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.from("users").select("credit_balance").eq("id", userId).maybeSingle();
      if (data) update(data.credit_balance);
    };
    const onVisible = () => void refresh();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, 30_000);

    return () => {
      window.removeEventListener(CREDITS_EVENT, onAnnounce);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] border py-1 pl-1 pr-2.5 text-xs font-semibold transition-all duration-300",
        balance > 0 ? "border-ink-950/20 bg-white text-ink-950" : "border-brand-600 bg-brand-600 text-white",
        flash && "ring-2 ring-brand-600/15",
      )}
      aria-live="polite"
    >
      <span
        className={cn(
          "grid h-5 w-5 place-items-center",
          balance > 0 ? "bg-brand-600 text-white" : "bg-white/15 text-white",
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
        </svg>
      </span>
      <span>
        {balance} {balance === 1 ? "Credit" : "Credits"}
        <span className="hidden font-medium opacity-70 sm:inline"> remaining</span>
      </span>
    </span>
  );
}
