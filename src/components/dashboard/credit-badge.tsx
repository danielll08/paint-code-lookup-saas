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
    if (!supabase) {
      return () => {
        window.removeEventListener(CREDITS_EVENT, onAnnounce);
      };
    }

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
    <div
      aria-label={`${balance} credit${balance === 1 ? "" : "s"} remaining`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-200 shadow-inner backdrop-blur transition-all duration-300",
        flash && "border-amber-400/80 bg-amber-500/20 text-amber-100 ring-2 ring-amber-400/30",
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            balance > 0 ? "animate-ping bg-emerald-400" : "bg-rose-400",
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            balance > 0 ? "bg-emerald-500" : "bg-rose-500",
          )}
        />
      </span>
      <span>
        <strong className="font-semibold text-white">{balance}</strong> {balance === 1 ? "credit" : "credits"}
      </span>
    </div>
  );
}
