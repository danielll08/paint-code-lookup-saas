"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlateInput } from "@/components/plate-input";
import { Button } from "@/components/ui";
import { parseVehicleIdentifier } from "@/lib/vrm";

/** Trial search box: looking up requires an account, so it routes to sign-up with the plate kept. */
export function HeroSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div id="lookup" className="w-full max-w-[30rem] scroll-mt-28">
      <form
        // Without JS (or before hydration) the browser submits to /signup?vrm=... natively.
        action="/signup"
        className="border border-ink-950/20 bg-white"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseVehicleIdentifier(value);
          if (!parsed) {
            setError("Enter a valid registration, e.g. AB12 CDE");
            return;
          }
          const next = `/dashboard?vrm=${parsed.value}`;
          router.push(`/signup?vrm=${parsed.value}&next=${encodeURIComponent(next)}`);
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-950/15 bg-paper-deep/40 px-3 py-2">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-500">
            Specimen request
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">VRM / VIN</span>
        </div>
        <div className="p-3">
          <PlateInput
            aria-label="Vehicle registration"
            name="vrm"
            placeholder="AB12 CDE"
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toUpperCase());
              setError(null);
            }}
          />
          {error && <p className="mt-2 text-sm font-medium text-brand-700">{error}</p>}
          <Button type="submit" size="lg" className="mt-2.5 w-full">
            Get Paint Code
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-400">
        <span className="inline-flex items-center gap-1.5 text-ink-500">
          <span className="h-1 w-1 bg-brand-600" aria-hidden />
          Free account required
        </span>
        <span className="text-ink-300">/</span>
        <span>Google &amp; Email sign-in</span>
        <span className="text-ink-300">/</span>
        <span>No paint code = no charge</span>
      </p>
    </div>
  );
}
