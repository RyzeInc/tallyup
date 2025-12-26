"use client";

import React, { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars } from "@/components/utils";
import Link from "next/link";

export default function ActivityTable({
  entries = [],
  onDelete,
  onSavePattern,
  onBulkComplete,
}: {
  entries?: any[];
  onDelete?: (id: Id<"entries">) => void;
  onSavePattern?: (entry: any) => void;
  onBulkComplete?: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const bulkMarkReviewed = useMutation(api.entries.bulkMarkReviewed);
  const updateEntry = useMutation(api.entries.updateEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  function toggle(id: Id<"entries">) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectAll() {
    const newSelected: Record<string, boolean> = {};
    entries.forEach((e) => { newSelected[e._id] = true; });
    setSelected(newSelected);
  }

  function clearSelection() {
    setSelected({});
  }

  async function handleBulkMarkReviewed() {
    try {
      await bulkMarkReviewed({ ids: selectedIds as any });
      clearSelection();
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      alert("Failed to apply bulk action.");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} entries? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        await deleteEntry({ id: id as any });
      }
      clearSelection();
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      alert("Failed to delete entries.");
    }
  }

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div
          className="sticky top-0 z-10 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
        >
          <span className="text-body font-semibold" style={{ color: "var(--accent)" }}>
            {selectedIds.length} selected
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={selectAll}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-subtle)]"
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Select all
            </button>
            <button
              onClick={clearSelection}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-subtle)]"
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Clear
            </button>
            <button
              onClick={handleBulkMarkReviewed}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: "var(--success)", color: "white" }}
            >
              <span className="flex items-center gap-1">
                <Lucide.Check className="h-3 w-3" />
                Mark reviewed
              </span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: "var(--danger)", color: "white" }}
            >
              <span className="flex items-center gap-1">
                <Lucide.Trash2 className="h-3 w-3" />
                Delete
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {entries.map((r, i) => {
          const isIncome = r.type === "income";
          const amountColor = isIncome ? "var(--success)" : "var(--text)";
          const amountPrefix = isIncome ? "+" : "−";
          
          // Build secondary line: Category · Tags (as short chips)
          const categoryLabel = r.category || r.bucket || "Uncategorized";
          const tagLabels = r.tags?.slice(0, 2) || [];
          
          return (
            <div
              key={r._id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-subtle)] ${
                i > 0 ? "border-t" : ""
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={!!selected[r._id]}
                onChange={() => toggle(r._id)}
                className="h-4 w-4 rounded shrink-0"
                style={{ accentColor: "var(--accent)" }}
              />

              {/* Icon */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isIncome ? "var(--success-subtle)" : "var(--surface-subtle)",
                }}
              >
                {isIncome ? (
                  <Lucide.ArrowDownLeft className="h-5 w-5" style={{ color: "var(--success)" }} />
                ) : (
                  <Lucide.ArrowUpRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                )}
              </div>

              {/* Main Content */}
              <Link href={`/activity?edit=${r._id}`} className="flex-1 min-w-0">
                {/* Primary: Title */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-body font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {r.note || r.merchant || categoryLabel}
                  </span>
                  {r.needsReview && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold"
                      style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning)" }}
                    >
                      Review
                    </span>
                  )}
                </div>
                
                {/* Secondary: Category · Context tags */}
                <div className="flex items-center gap-1.5 text-meta truncate" style={{ color: "var(--text-secondary)" }}>
                  <span>{categoryLabel}</span>
                  {tagLabels.length > 0 && (
                    <>
                      <span style={{ color: "var(--text-tertiary)" }}>·</span>
                      {tagLabels.map((tag: string, idx: number) => (
                        <span key={tag} className="inline-flex items-center">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full mr-1"
                            style={{ backgroundColor: "var(--accent)" }}
                          />
                          <span className="text-[11px]">{tag}</span>
                        </span>
                      ))}
                    </>
                  )}
                </div>
                
                {/* Tertiary: Method/account if present */}
                {r.methodOrAccount && (
                  <div className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {r.methodOrAccount}
                  </div>
                )}
              </Link>

              {/* Amount + Date */}
              <div className="shrink-0 text-right">
                <div
                  className="text-body font-semibold tabular-nums"
                  style={{ color: amountColor }}
                >
                  {amountPrefix}{centsToDollars(Math.abs(r.amountCents))}
                </div>
                <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(r.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>

              {/* Actions Menu */}
              <div className="relative shrink-0">
                <button
                  onClick={() => onSavePattern?.(r)}
                  className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-subtle)]"
                  title="Save as pattern"
                >
                  <Lucide.Bookmark className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
