"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Card, cn } from "@/components/ui";
import type { LookupView } from "@/lib/lookup/types";
import { formatVrm, normalizeVrm } from "@/lib/vrm";
import { ResultCard } from "./result-card";

const STATUS_LABEL: Record<LookupView["status"], { text: string; className: string }> = {
  SUCCESS: { text: "Found", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PENDING: { text: "In progress", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  NOT_FOUND_REFUNDED: { text: "No data · refunded", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  FAILED_REFUNDED: { text: "Error · refunded", className: "bg-red-50 text-red-700 ring-red-200" },
};

/** Recent Lookups table with quick filter (PRD 3.2.2). */
export function RecentLookupsTable({ lookups }: { lookups: LookupView[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LookupView | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeVrm(query);
    const text = query.trim().toLowerCase();
    if (!text) return lookups;
    return lookups.filter(
      (l) =>
        (q && l.vrm.includes(q)) ||
        `${l.make ?? ""} ${l.model ?? ""}`.toLowerCase().includes(text) ||
        (l.paintCode ?? "").toLowerCase().includes(text),
    );
  }, [lookups, query]);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold">Recent lookups</h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by plate, model or paint code"
          aria-label="Filter recent lookups"
          className="h-9 w-full rounded-lg border-0 px-3 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:w-72"
        />
      </div>

      {lookups.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">Your lookups will appear here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Paint code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((lookup) => {
                const status = STATUS_LABEL[lookup.status];
                return (
                  <tr key={lookup.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {new Date(lookup.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="plate whitespace-nowrap rounded border border-slate-900 bg-plate-yellow px-1.5 py-0.5 text-xs font-bold">
                        {formatVrm(lookup.vrm)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{[lookup.make, lookup.model].filter(Boolean).join(" ") || "-"}</td>
                    <td className="px-4 py-3 font-mono font-bold">{lookup.paintCode ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1", status.className)}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lookup.status === "SUCCESS" && (
                        <button
                          type="button"
                          onClick={() => setSelected(lookup)}
                          className="whitespace-nowrap font-semibold text-brand-600 hover:text-brand-700"
                        >
                          View details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
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
