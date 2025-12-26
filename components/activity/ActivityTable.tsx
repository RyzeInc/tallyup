"use client";

import React, { useMemo, useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars, CONTEXT_TAGS, EXPENSE_SPACES, INCOME_SPACES } from "@/components/utils";
import Link from "next/link";

// Swipe threshold in px
const SWIPE_THRESHOLD = 80;

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

  // Bulk action sheet state
  const [bulkAction, setBulkAction] = useState<"none" | "tag" | "category">("none");

  // Swipe state per row
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const touchStart = useRef<Record<string, { x: number; y: number }>>({});

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

  async function handleBulkAddTag(tag: string) {
    try {
      for (const id of selectedIds) {
        const entry = entries.find((e) => e._id === id);
        if (!entry) continue;
        const currentTags = entry.tags ?? [];
        if (!currentTags.includes(tag)) {
          await updateEntry({ id: id as any, tags: [...currentTags, tag] });
        }
      }
      clearSelection();
      setBulkAction("none");
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      alert("Failed to add tag.");
    }
  }

  async function handleBulkChangeCategory(category: string) {
    try {
      for (const id of selectedIds) {
        await updateEntry({ id: id as any, category });
      }
      clearSelection();
      setBulkAction("none");
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      alert("Failed to change category.");
    }
  }

  // Swipe handlers
  const handleTouchStart = useCallback((id: string, e: React.TouchEvent) => {
    touchStart.current[id] = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchMove = useCallback((id: string, e: React.TouchEvent) => {
    const start = touchStart.current[id];
    if (!start) return;
    const deltaX = e.touches[0].clientX - start.x;
    const deltaY = e.touches[0].clientY - start.y;
    // Only horizontal swipes
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    setSwipeOffset((o) => ({ ...o, [id]: Math.max(-SWIPE_THRESHOLD, Math.min(SWIPE_THRESHOLD, deltaX)) }));
  }, []);

  const handleTouchEnd = useCallback(async (id: string, entry: any) => {
    const offset = swipeOffset[id] ?? 0;
    if (offset >= SWIPE_THRESHOLD) {
      // Swipe right = mark reviewed
      try {
        await updateEntry({ id: id as any, needsReview: false });
        onBulkComplete?.();
      } catch (e) {
        console.error(e);
      }
    } else if (offset <= -SWIPE_THRESHOLD) {
      // Swipe left = edit (navigate)
      window.location.href = `/activity?edit=${id}`;
    }
    setSwipeOffset((o) => ({ ...o, [id]: 0 }));
    delete touchStart.current[id];
  }, [swipeOffset, updateEntry, onBulkComplete]);

  // Get category options based on selected entries
  const categoryOptions = useMemo(() => {
    const hasExpense = selectedIds.some((id) => entries.find((e) => e._id === id)?.type === "expense");
    const hasIncome = selectedIds.some((id) => entries.find((e) => e._id === id)?.type === "income");
    if (hasExpense && hasIncome) return [...EXPENSE_SPACES, ...INCOME_SPACES];
    if (hasIncome) return [...INCOME_SPACES];
    return [...EXPENSE_SPACES];
  }, [selectedIds, entries]);

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div
          className="sticky top-0 z-10 rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--accent-subtle)", border: "1px solid var(--accent)" }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-body font-semibold" style={{ color: "var(--accent)" }}>
              {selectedIds.length} selected
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={selectAll}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ border: "1px solid var(--border)", color: "var(--text)", backgroundColor: "var(--surface)" }}
              >
                Select all
              </button>
              <button
                onClick={clearSelection}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ border: "1px solid var(--border)", color: "var(--text)", backgroundColor: "var(--surface)" }}
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
                onClick={() => setBulkAction("tag")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                <span className="flex items-center gap-1">
                  <Lucide.Tag className="h-3 w-3" />
                  Add tag
                </span>
              </button>
              <button
                onClick={() => setBulkAction("category")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                <span className="flex items-center gap-1">
                  <Lucide.Folder className="h-3 w-3" />
                  Category
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

          {/* Tag selection panel */}
          {bulkAction === "tag" && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Select tag to add:
              </div>
              <div className="flex flex-wrap gap-2">
                {CONTEXT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleBulkAddTag(tag)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    {tag}
                  </button>
                ))}
                <button
                  onClick={() => setBulkAction("none")}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Category selection panel */}
          {bulkAction === "category" && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Select category:
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleBulkChangeCategory(cat)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  onClick={() => setBulkAction("none")}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
          const offset = swipeOffset[r._id] ?? 0;
          
          return (
            <div
              key={r._id}
              className={`relative overflow-hidden ${i > 0 ? "border-t" : ""}`}
              style={{ borderColor: "var(--border)" }}
            >
              {/* Swipe background indicators */}
              <div className="absolute inset-0 flex">
                {/* Right swipe = mark reviewed (green) */}
                <div
                  className="flex items-center justify-start pl-4 w-1/2"
                  style={{ backgroundColor: offset > 20 ? "var(--success)" : "transparent" }}
                >
                  {offset > 20 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-white">
                      <Lucide.Check className="h-4 w-4" />
                      Mark reviewed
                    </span>
                  )}
                </div>
                {/* Left swipe = edit (blue) */}
                <div
                  className="flex items-center justify-end pr-4 w-1/2"
                  style={{ backgroundColor: offset < -20 ? "var(--accent)" : "transparent" }}
                >
                  {offset < -20 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-white">
                      Edit
                      <Lucide.Pencil className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
              
              {/* Main row content */}
              <div
                className="relative flex items-center gap-3 px-4 py-3 transition-transform bg-[var(--surface)]"
                style={{ transform: `translateX(${offset}px)` }}
                onTouchStart={(e) => handleTouchStart(r._id, e)}
                onTouchMove={(e) => handleTouchMove(r._id, e)}
                onTouchEnd={() => handleTouchEnd(r._id, r)}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
