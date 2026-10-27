"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Card, cn } from "@/components/ui";
import type { LookupView } from "@/lib/lookup/types";
import { formatVrm, normalizeVrm } from "@/lib/vrm";
import { ResultCard } from "./result-card";

const STATUS_LABEL: Record<LookupView["status"], { text: string; className: string }> = {
  SUCCESS: { text: "Found", className: "border-emerald-600/30 bg-emerald-50 text-emerald-800" },
  PENDING: { text: "In progress", className: "border-ink-300 bg-ink-100 text-ink-700" },
  NOT_FOUND_REFUNDED: { text: "No data · refunded", className: "border-amber-600/30 bg-amber-50 text-amber-800" },
  FAILED_REFUNDED: { text: "Error · refunded", className: "border-brand-600/30 bg-brand-50 text-brand-700" },
};

type StatusFilter = "ALL" | "SUCCESS" | "REFUNDED";

export function exportLookupsToCsv(items: LookupView[]) {
  const headers = [
    "Date & Time",
    "Registration",
    "Make",
    "Model",
    "Year",
    "Registered Colour",
    "Paint Code",
    "Paint Name",
    "Finish",
    "Location Hint",
    "Status",
    "Source Provider",
  ];

  const escapeCell = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = items.map((item) => [
    escapeCell(new Date(item.createdAt).toISOString()),
    escapeCell(item.vrm),
    escapeCell(item.make),
    escapeCell(item.model),
    escapeCell(item.year),
    escapeCell(item.registeredColor),
    escapeCell(item.paintCode),
    escapeCell(item.paintName),
    escapeCell(item.paintFinish),
    escapeCell(item.codeLocationHint),
    escapeCell(item.status),
    escapeCell(item.provider),
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `paint-lookups-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "SUCCESS", label: "Found" },
  { id: "REFUNDED", label: "Refunded" },
];

const SMALL_ACTION =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[2px] border border-ink-950/20 bg-white px-2.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-950/45 hover:bg-paper hover:text-ink-950 sm:px-3";

/** Recent Lookups table with quick filter and CSV export (PRD 3.2.2). */
export function RecentLookupsTable({ lookups }: { lookups: LookupView[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LookupView | null>(null);
  const [statusTab, setStatusTab] = useState<StatusFilter>("ALL");

  const counts = useMemo(() => {
    let success = 0;
    let refunded = 0;
    for (const l of lookups) {
      if (l.status === "SUCCESS") success++;
      else if (l.status.includes("REFUNDED")) refunded++;
    }
    return { all: lookups.length, success, refunded };
  }, [lookups]);

  const filtered = useMemo(() => {
    const q = normalizeVrm(query);
    const text = query.trim().toLowerCase();

    return lookups.filter((l) => {
      if (statusTab === "SUCCESS" && l.status !== "SUCCESS") return false;
      if (statusTab === "REFUNDED" && !l.status.includes("REFUNDED")) return false;

      if (!text) return true;
      return (
        (q && l.vrm.includes(q)) ||
        `${l.make ?? ""} ${l.model ?? ""}`.toLowerCase().includes(text) ||
        (l.paintCode ?? "").toLowerCase().includes(text)
      );
    });
  }, [lookups, query, statusTab]);

  return (
    <Card className="overflow-hidden border border-ink-950/20">
      <div className="border-b border-ink-950/15 p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center border border-ink-950/15 bg-paper text-ink-700" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 8v5l3 2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>
              <div>
                <h2 className="font-display text-xl font-semibold leading-none tracking-[-0.025em] text-ink-950">Recent lookups</h2>
                <p className="mt-1.5 text-xs text-ink-500">Every lookup is saved, searchable and ready to print.</p>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by plate, model or code"
                  aria-label="Filter recent lookups"
                  className="h-9 w-full rounded-[2px] border border-ink-950/20 bg-white pl-9 pr-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
                />
              </div>
              {lookups.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportLookupsToCsv(filtered)}
                  className={SMALL_ACTION}
                  title="Download filtered lookups as a CSV file"
                  aria-label="Export lookups as a CSV file"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="max-sm:hidden">Export CSV</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-ink-950/20 text-xs font-semibold">
              {TABS.map((tab) => {
                const count = tab.id === "ALL" ? counts.all : tab.id === "SUCCESS" ? counts.success : counts.refunded;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
                    className={cn(
                      "px-3 py-1.5 transition-colors",
                      statusTab === tab.id
                        ? "bg-ink-950 text-white"
                        : "text-ink-600 hover:bg-paper hover:text-ink-950",
                    )}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>
            {query && (
              <span className="text-xs text-ink-400">
                Showing {filtered.length} of {lookups.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {lookups.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center border border-ink-950/15 bg-paper text-ink-700" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="6" width="18" height="12" rx="2.5" />
              <path d="M7 10h4M7 14h7" strokeLinecap="round" />
            </svg>
          </span>
          <p className="mt-4 font-semibold text-ink-950">Your lookups will appear here.</p>
          <p className="mt-1 max-w-xs text-sm text-ink-500">Enter a registration above to find your first paint code.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-ink-950/10 bg-paper-deep/50 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-500">
              <tr>
                <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Time</th>
                <th className="px-3 py-3 font-medium sm:px-4">Registration</th>
                <th className="px-3 py-3 font-medium sm:px-4">Vehicle</th>
                <th className="px-3 py-3 font-medium sm:px-4">Paint code</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Status</th>
                <th className="py-3 pl-1 pr-3 sm:px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-950/10">
              {filtered.map((lookup) => {
                const status = STATUS_LABEL[lookup.status];
                return (
                  <tr key={lookup.id} className="transition-colors hover:bg-brand-50/50">
                    <td className="hidden whitespace-nowrap px-4 py-3.5 text-xs text-ink-500 sm:table-cell sm:px-5">
                      {new Date(lookup.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-3.5 sm:px-4">
                      <span className="plate whitespace-nowrap border border-ink-950/20 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-950">
                        {formatVrm(lookup.vrm)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-medium text-ink-950 sm:px-4">
                      <span className="block max-w-32 truncate sm:max-w-none">
                        {[lookup.make, lookup.model].filter(Boolean).join(" ") || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-sm font-semibold text-ink-950 sm:px-4">{lookup.paintCode ?? "-"}</td>
                    <td className="hidden px-4 py-3.5 md:table-cell">
                      <span className={cn("whitespace-nowrap border px-2 py-0.5 text-[11px] font-medium", status.className)}>
                        {status.text}
                      </span>
                    </td>
                    <td className="py-3.5 pl-1 pr-3 text-right sm:px-5">
                      {lookup.status === "SUCCESS" && (
                        <button
                          type="button"
                          onClick={() => setSelected(lookup)}
                          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
                          aria-label="View lookup details"
                        >
                          <span className="max-sm:hidden">View details</span>
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                            <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-500">
                    No lookups match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title="Lookup details" wide>
        {selected && <ResultCard lookup={selected} />}
      </Modal>
    </Card>
  );
}
