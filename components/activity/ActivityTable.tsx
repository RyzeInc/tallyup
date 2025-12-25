"use client";

import React, { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars } from "@/components/utils";

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

  function toggle(id: Id<"entries">) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function clearSelection() {
    setSelected({});
  }

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
        >
          <span className="text-body font-semibold" style={{ color: "var(--accent)" }}>
            {selectedIds.length} selected
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={clearSelection}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Clear
            </button>
            <button
              onClick={async () => {
                try {
                  await bulkMarkReviewed({ ids: selectedIds as any });
                  clearSelection();
                  onBulkComplete?.();
                } catch (e) {
                  console.error(e);
                  alert("Failed to apply bulk action.");
                }
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Mark reviewed
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
                className="h-4 w-4 rounded"
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-body font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {r.note || r.merchant || r.category || "Untitled"}
                  </span>
                  {r.needsReview && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold"
                      style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning)" }}
                    >
                      Needs review
                    </span>
                  )}
                </div>
                <div className="text-meta truncate" style={{ color: "var(--text-secondary)" }}>
                  {r.bucket || r.category || "Uncategorized"}
                  {r.methodOrAccount && ` · ${r.methodOrAccount}`}
                </div>
              </div>

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
