"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function AccountMenu({ email, name }: { email: string; name: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name || email).charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid h-9 w-9 place-items-center rounded-[2px] border border-ink-950/20 bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        {initial}
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          role="menu"
          onClick={(event) => (event.target as HTMLElement).closest("a") && setOpen(false)}
          className="animate-in absolute right-0 z-20 mt-2 w-64 rounded-[2px] border border-ink-950/20 bg-white p-2 shadow-soft"
        >
          <div className="border-b border-ink-950/10 px-3 pb-3 pt-1.5">
            <p className="truncate text-sm font-semibold text-ink-950">
              {name || (email ? email.split("@")[0] : "Your account")}
            </p>
            <p className="truncate text-xs text-ink-500">{email}</p>
          </div>
          <div className="pt-1.5">
            <Link
              role="menuitem"
              href="/dashboard"
              className="flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-paper hover:text-ink-950"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <path d="M7 9h10M7 13h6" strokeLinecap="round" />
              </svg>
              Paint code lookup
            </Link>
            <Link
              role="menuitem"
              href="/dashboard/billing"
              className="flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-paper hover:text-ink-950"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="M3 10h18" />
              </svg>
              Billing & credits
            </Link>
            <Link
              role="menuitem"
              href="/about"
              className="flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-paper hover:text-ink-950"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
              </svg>
              About us
            </Link>
          </div>
          <form action="/auth/signout" method="post" className="mt-1 border-t border-ink-950/10 pt-1.5">
            <button
              role="menuitem"
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-[2px] px-3 py-2 text-left text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M15 12H4m4-4-4 4 4 4M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
