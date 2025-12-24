"use client";

import React, { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars } from "@/components/utils";

export default function ActivityTable({ entries = [], onDelete, onSavePattern, onBulkComplete }: { entries?: any[]; onDelete?: (id: string) => void; onSavePattern?: (entry: any) => void; onBulkComplete?: () => void }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const bulkMarkReviewed = useMutation(api.entries.bulkMarkReviewed);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function clearSelection() {
    setSelected({});
  }

  return (
    <div>
      {selectedIds.length > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div className="text-sm text-neutral-700">{selectedIds.length} selected</div>
          <div className="ml-auto flex gap-2">
            <button className="rounded-md px-3 py-1 text-sm" style={{ border: "1px solid var(--border)" }} onClick={() => { clearSelection(); }}>Clear</button>
            <button className="rounded-md px-3 py-1 text-sm bg-accent text-accent-foreground" onClick={async () => {
              try {
                await bulkMarkReviewed({ ids: selectedIds as any });
                clearSelection();
                onBulkComplete?.();
              } catch (e) {
                console.error(e);
                alert("Failed to apply bulk action.");
              }
            }}>Mark reviewed</button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left text-xs text-neutral-600">
              <th className="px-3 py-2" style={{ width: 36 }}><input type="checkbox" onChange={(e) => {
                const checked = e.target.checked;
                const next: Record<string, boolean> = {};
                if (checked) for (const r of entries) next[r._id] = true;
                setSelected(next);
              }} /></th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Merchant / Note</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((r) => (
              <tr key={r._id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2"><input type="checkbox" checked={!!selected[r._id]} onChange={() => toggle(r._id)} /></td>
                <td className="px-3 py-2">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-neutral-700">{r.note ?? r.merchant ?? "—"}</td>
                <td className="px-3 py-2">{r.category ?? "Needs review"}</td>
                <td className="px-3 py-2">{r.methodOrAccount ?? "—"}</td>
                <td className="px-3 py-2">{(r.tags || []).slice(0,3).join(", ")}</td>
                <td className="px-3 py-2 text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{centsToDollars(r.amountCents)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onSavePattern?.(r)} className="text-xs rounded px-2 py-1" style={{ border: "1px solid var(--border)" }}>Save</button>
                    <button onClick={() => onDelete?.(r._id)} className="text-xs rounded px-2 py-1 text-danger" style={{ border: "1px solid var(--border)" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
