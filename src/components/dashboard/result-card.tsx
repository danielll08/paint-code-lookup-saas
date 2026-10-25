"use client";

import { useState } from "react";
import { Card, cn } from "@/components/ui";
import type { LookupView } from "@/lib/lookup/types";
import { formatVrm } from "@/lib/vrm";
import { CodeLocationDiagram } from "./code-location-diagram";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (e.g. insecure context); nothing else to do.
        }
      }}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition-colors",
        copied ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
      )}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value || "-"}</dd>
    </div>
  );
}

/** Vehicle & Paint Result Card (PRD 3.2.2). */
export function ResultCard({ lookup, note }: { lookup: LookupView; note?: { tone: "info" | "success"; text: string } }) {
  const hasPaint = Boolean(lookup.paintCode);

  return (
    <Card className="animate-in overflow-hidden">
      {note && (
        <div
          className={cn(
            "px-6 py-2.5 text-sm font-medium",
            note.tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-brand-50 text-brand-700",
          )}
        >
          {note.text}
        </div>
      )}
      <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_1fr]">
        <section aria-label="Paint information">
          <p className="text-sm font-medium text-slate-500">Paint code</p>
          {hasPaint ? (
            <>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-5xl font-black tracking-tight text-slate-950">{lookup.paintCode}</span>
                <CopyButton value={lookup.paintCode!} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <Detail label="Paint name" value={lookup.paintName} />
                <Detail label="Finish" value={lookup.paintFinish} />
              </dl>
            </>
          ) : (
            <p className="mt-2 text-slate-600">Paint code not available for this vehicle.</p>
          )}
          {lookup.codeLocationHint && (
            <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <div>
                <p className="text-sm font-semibold">Where to find the paint code label</p>
                <p className="mt-0.5 text-sm text-slate-600">{lookup.codeLocationHint}</p>
                <CodeLocationDiagram hint={lookup.codeLocationHint} />
              </div>
            </div>
          )}
        </section>

        <section aria-label="Vehicle details" className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Vehicle check</p>
            <span className="plate rounded-md border-2 border-slate-900 bg-plate-yellow px-2 py-0.5 text-sm font-bold">
              {formatVrm(lookup.vrm)}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Make" value={lookup.make} />
            <Detail label="Model" value={lookup.model} />
            <Detail label="Year" value={lookup.year} />
            <Detail label="Registered colour" value={lookup.registeredColor} />
            <div className="col-span-2">
              <Detail label="VIN (partial)" value={lookup.vinPartial} />
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Checked {new Date(lookup.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · source{" "}
            {lookup.provider}
          </p>
        </section>
      </div>
    </Card>
  );
}
