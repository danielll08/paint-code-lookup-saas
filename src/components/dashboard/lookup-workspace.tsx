"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { PlateInput } from "@/components/plate-input";
import { Alert, Button, Spinner } from "@/components/ui";
import type { LookupApiResponse, LookupView } from "@/lib/lookup/types";
import { parseVehicleIdentifier } from "@/lib/vrm";
import { BuyCreditsModal } from "./buy-credits-modal";
import { announceBalance } from "./credit-badge";
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
  const inFlight = useRef(false);

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
      if ("balance" in body && typeof body.balance === "number") announceBalance(body.balance);

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
      <form onSubmit={search} className="mx-auto flex max-w-2xl flex-col gap-3">
        <label htmlFor="vrm" className="text-center text-sm font-medium text-slate-600">
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
            "Get Paint Code"
          )}
        </Button>
      </form>

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
    <div className="mx-auto flex max-w-2xl flex-col gap-3" aria-hidden>
      <div className="mx-auto h-5 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-20 animate-pulse rounded-xl bg-plate-yellow/50" />
      <div className="h-12 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}
