"use client";

import { useState } from "react";
import { Card, cn } from "@/components/ui";
import type { LookupView } from "@/lib/lookup/types";
import { formatVrm } from "@/lib/vrm";
import { CodeLocationDiagram } from "./code-location-diagram";
import { ColorSwatch } from "./color-swatch";

const ACTION_BUTTON =
  "inline-flex items-center gap-1.5 rounded-[2px] border border-ink-950/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-950/45 hover:bg-paper hover:text-ink-950";

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
        ACTION_BUTTON,
        copied && "border-emerald-600 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h8" strokeLinecap="round" />
      </svg>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CopySummaryButton({ lookup }: { lookup: LookupView }) {
  const [copied, setCopied] = useState(false);
  const summary = [
    `Vehicle: ${[lookup.make, lookup.model].filter(Boolean).join(" ") || "Unknown"}${lookup.year ? ` (${lookup.year})` : ""}`,
    `Registration: ${formatVrm(lookup.vrm)}`,
    lookup.vinPartial ? `VIN: ${lookup.vinPartial}` : null,
    lookup.paintCode ? `OEM Paint Code: ${lookup.paintCode}` : "No Paint Code",
    lookup.paintName ? `Paint Name: ${lookup.paintName}` : null,
    lookup.paintFinish ? `Finish: ${lookup.paintFinish}` : null,
    lookup.codeLocationHint ? `Location Hint: ${lookup.codeLocationHint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(summary);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked
        }
      }}
      className={cn(
        ACTION_BUTTON,
        "no-print",
        copied && "border-emerald-600 bg-emerald-50 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
      )}
      title="Copy full vehicle and paint specification"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
      {copied ? "Spec Copied" : "Copy Spec"}
    </button>
  );
}

function PrintJobCardButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(ACTION_BUTTON, "no-print")}
      title="Print workshop job card for technicians"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </svg>
      Print Job Sheet
    </button>
  );
}

function Detail({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: string | number | null | undefined;
  invert?: boolean;
}) {
  return (
    <div>
      <dt
        className={cn(
          "font-mono text-[9px] font-medium uppercase tracking-[0.14em] print:text-ink-500",
          invert ? "text-white/45" : "text-ink-400",
        )}
      >
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm font-medium print:text-ink-950", invert ? "text-white" : "text-ink-950")}>
        {value || "-"}
      </dd>
    </div>
  );
}

/** Vehicle & Paint Result Card (PRD 3.2.2). */
export function ResultCard({ lookup, note }: { lookup: LookupView; note?: { tone: "info" | "success"; text: string } }) {
  const hasPaint = Boolean(lookup.paintCode);

  return (
    <Card className="animate-in overflow-hidden border border-ink-950/20 print:border print:border-ink-300 print:shadow-none">
      <div className={cn("h-1 w-full print:hidden", hasPaint ? "bg-brand-600" : "bg-ink-300")} />

      {/* Print-only workshop job card header */}
      <div className="hidden border-b border-ink-950/20 bg-paper p-4 print:block">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink-950">Workshop Paint Job Sheet</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">Verified OEM Spec · PaintCode Finder</span>
        </div>
      </div>

      {note && (
        <div
          className={cn(
            "no-print flex items-center gap-2 border-b border-ink-950/10 px-5 py-2.5 text-sm font-medium sm:px-6",
            note.tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-brand-50 text-brand-800",
          )}
        >
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center text-[11px] font-bold",
              note.tone === "success" ? "bg-emerald-600 text-white" : "bg-brand-600 text-white",
            )}
            aria-hidden
          >
            {note.tone === "success" ? "✓" : "i"}
          </span>
          {note.text}
        </div>
      )}

      <div className="grid md:grid-cols-[1.08fr_0.92fr]">
        <section aria-label="Paint information" className="min-w-0 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5", hasPaint ? "bg-brand-600" : "bg-ink-300")} />
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500">
              {hasPaint ? "OEM paint code" : "Paint information"}
            </p>
          </div>

          {hasPaint ? (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
                <span className="font-mono text-5xl font-medium tracking-[-0.05em] text-ink-950 sm:text-6xl">{lookup.paintCode}</span>
                <div className="no-print mb-1 flex flex-wrap gap-2">
                  <CopyButton value={lookup.paintCode!} />
                  <CopySummaryButton lookup={lookup} />
                  <PrintJobCardButton />
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-950/10 pt-4">
                <Detail label="Paint name" value={lookup.paintName} />
                <Detail label="Finish" value={lookup.paintFinish} />
              </dl>

              <div className="mt-5 border border-ink-950/15 bg-paper p-4">
                <ColorSwatch
                  paintName={lookup.paintName}
                  registeredColor={lookup.registeredColor}
                  finish={lookup.paintFinish}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-ink-600">Paint code not available for this vehicle.</p>
          )}
        </section>

        <section
          aria-label="Vehicle details"
          className="relative self-start overflow-hidden bg-ink-950 p-5 text-white sm:p-6 md:border-l md:border-ink-950/20 print:bg-white print:text-ink-950 print:ring-1 print:ring-ink-300"
        >
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-white/45 print:text-ink-500">
                Vehicle check
              </p>
              <span className="plate border border-white/25 bg-white/10 px-2 py-0.5 text-xs font-bold text-white print:border-ink-300 print:bg-white print:text-ink-950">
                {formatVrm(lookup.vrm)}
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <Detail invert label="Make" value={lookup.make} />
              <Detail invert label="Model" value={lookup.model} />
              <Detail invert label="Year" value={lookup.year} />
              <Detail invert label="Registered colour" value={lookup.registeredColor} />
              <div className="col-span-2">
                <Detail invert label="VIN (partial)" value={lookup.vinPartial} />
              </div>
            </dl>
            <p className="mt-5 border-t border-white/15 pt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-white/40 print:border-ink-200 print:text-ink-500">
              Checked {new Date(lookup.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · source{" "}
              {lookup.provider}
            </p>
          </div>
        </section>
      </div>

      {lookup.codeLocationHint && (
        <div className="border-t border-ink-950/15 bg-paper p-5 sm:p-6">
          <div className="border border-ink-950/15 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center bg-brand-600 text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                    <circle cx="12" cy="9.5" r="2.5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-950">Where to find the paint code label</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">{lookup.codeLocationHint}</p>
                </div>
              </div>
              <div className="sm:w-72 sm:shrink-0">
                <CodeLocationDiagram hint={lookup.codeLocationHint} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
