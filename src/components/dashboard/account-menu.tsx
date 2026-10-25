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
        className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {initial}
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" onClick={(event) => (event.target as HTMLElement).closest("a") && setOpen(false)}
          className="animate-in absolute right-0 z-20 mt-2 w-60 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-3 py-2">
            {name && <p className="truncate text-sm font-semibold">{name}</p>}
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <Link role="menuitem" href="/dashboard" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
            Paint code lookup
          </Link>
          <Link role="menuitem" href="/dashboard/billing" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
            Billing & credits
          </Link>
          <Link role="menuitem" href="/about" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
            About us
          </Link>
          <form action="/auth/signout" method="post">
            <button role="menuitem" type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
