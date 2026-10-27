"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlateInput } from "@/components/plate-input";
import { Alert, Button, Spinner } from "@/components/ui";
import type { LookupApiResponse, LookupView } from "@/lib/lookup/types";
import { parseVehicleIdentifier } from "@/lib/vrm";
import { BuyCreditsModal } from "./buy-credits-modal";
import { announceBalance, CREDITS_EVENT } from "./credit-badge";
import { ResultCard } from "./result-card";

type Outcome =
  | { kind: "result"; lookup: LookupView; note: { tone: "info" | "success"; text: string } }
  | { kind: "partial"; lookup: LookupView | null; message: string }
  | { kind: "error"; message: string };

/** Central search box + result (PRD 3.2.2). */
export function LookupWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(() => params.get("vrm")?.toUpperCase() ?? "");
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const b = (event as CustomEvent<number>).detail;
      if (typeof b === "number") setBalance(b);
    };
    window.addEventListener(CREDITS_EVENT, handler);
    return () => window.removeEventListener(CREDITS_EVENT, handler);
  }, []);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    // Ignore double clicks client-side too (the server is the real guard).
    if (inFlight.current) return;

    const parsed = parseVehicleIdentifier(value);
    if (!parsed) {
      setOutcome({ kind: "error", message: "Enter a valid registration (e.g. AB12 CDE) or a 17-character VIN." });
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vrm: parsed.value }),
      });
      const body = (await response.json()) as LookupApiResponse;
      if ("balance" in body && typeof body.balance === "number") {
        announceBalance(body.balance);
        setBalance(body.balance);
      }

      switch (body.status) {
        case "success":
          setOutcome({
            kind: "result",
            lookup: body.lookup,
            note: body.cached
              ? { tone: "info", text: "Saved in your history - no credit used." }
              : { tone: "success", text: body.charged ? "Paint code found · 1 credit used." : "Paint code found." },
          });
          router.refresh();
          break;
        case "no_paint_code":
          setOutcome({ kind: "partial", lookup: body.lookup, message: body.message });
          router.refresh();
          break;
        case "insufficient_credits":
          setBuyOpen(true);
          break;
        case "unauthorized":
          router.push(`/login?next=${encodeURIComponent(`/dashboard?vrm=${parsed.value}`)}`);
          break;
        default:
          setOutcome({ kind: "error", message: body.message });
      }
    } catch {
      setOutcome({ kind: "error", message: "Network error. Please check your connection and try again." });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="border border-ink-950/20 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-ink-950/15 bg-paper-deep/40 px-4 py-2.5 sm:px-6">
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-500">Lookup / 01</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-400">VRM / VIN</span>
        </div>
        <div className="relative px-4 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <p className="flex items-center justify-center gap-2 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-ink-400">
                <span className="h-1 w-1 bg-brand-600" aria-hidden />
                New specimen
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.03] tracking-[-0.035em] text-ink-950 sm:text-4xl">
                Find the exact paint code
              </h1>
              <p className="mt-2 text-sm text-ink-500">Enter a registration or VIN. You only pay when a paint code is found.</p>
            </div>

            {balance !== null && balance > 0 && balance <= 2 && (
              <div className="mt-6 flex items-center justify-between gap-3 border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-ink-700">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center bg-brand-600 text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
                    </svg>
                  </span>
                  <span>
                    Low credit balance: You have{" "}
                    <strong>
                      {balance} {balance === 1 ? "credit" : "credits"}
                    </strong>{" "}
                    left.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyOpen(true)}
                  className="shrink-0 rounded-[2px] bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  + Top up
                </button>
              </div>
            )}

            <form onSubmit={search} className="mt-6 space-y-3">
              <label htmlFor="vrm" className="block text-center font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
                Enter a registration number or VIN
              </label>
              <PlateInput
                id="vrm"
                name="vrm"
                autoFocus
                placeholder="AB12 CDE"
                value={value}
                disabled={loading}
                onChange={(event) => setValue(event.target.value.toUpperCase())}
              />
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Spinner className="h-5 w-5" /> Searching vehicle data…
                  </>
                ) : (
                  <>
                    Get Paint Code
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </Button>
              <p className="text-center font-mono text-[9px] uppercase tracking-[0.08em] text-ink-400">
                Looked up in the last 30 days? It&apos;s free. No paint code found? The credit is refunded.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        {outcome?.kind === "result" && <ResultCard lookup={outcome.lookup} note={outcome.note} />}
        {outcome?.kind === "partial" && (
          <div className="space-y-4">
            <Alert tone="warning">{outcome.message}</Alert>
            {outcome.lookup?.make && <ResultCard lookup={outcome.lookup} />}
          </div>
        )}
        {outcome?.kind === "error" && <Alert tone="error">{outcome.message}</Alert>}
      </div>

      <BuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </section>
  );
}

export function LookupWorkspaceSkeleton() {
  return (
    <div className="border border-ink-950/20 bg-white p-8" aria-hidden>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <div className="h-7 w-64 animate-pulse bg-ink-100" />
        <div className="h-5 w-40 animate-pulse bg-ink-100" />
        <div className="mt-4 h-[4.5rem] w-full animate-pulse border border-ink-950/10 bg-paper" />
        <div className="h-12 w-full animate-pulse bg-ink-100" />
      </div>
    </div>
  );
}
