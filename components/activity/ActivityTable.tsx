"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars, CONTEXT_TAGS, EXPENSE_SPACES, INCOME_SPACES } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";

// Swipe threshold in px
const SWIPE_THRESHOLD = 80;

export default function ActivityTable({
  entries = [],
  onDelete,
  onSavePattern,
  onBulkComplete,
  externalSelectMode,
  onSelectModeChange,
}: {
  entries?: Doc<"entries">[];
  onDelete?: (id: Id<"entries">) => void;
  onSavePattern?: (entry: Doc<"entries">) => void;
  onBulkComplete?: () => void;
  externalSelectMode?: boolean;
  onSelectModeChange?: (mode: boolean) => void;
}) {
  const toast = useToast();
  
  // Selection mode state - use external control if provided
  const [internalSelectMode, setInternalSelectMode] = useState(false);
  const selectMode = externalSelectMode ?? internalSelectMode;
  const setSelectMode = onSelectModeChange ?? setInternalSelectMode;
  const [selected, setSelected] = useState<Record<Id<"entries">, boolean>>({} as Record<Id<"entries">, boolean>);
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k as Id<"entries">]) as Id<"entries">[],
    [selected]
  );
  
  const bulkMarkReviewed = useMutation(api.entries.bulkMarkReviewed);
  const updateEntry = useMutation(api.entries.updateEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  // Bulk action sheet state
  const [bulkAction, setBulkAction] = useState<"none" | "tag" | "category">("none");

  // Long-press for entering select mode
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Exit select mode when selection is cleared
  useEffect(() => {
    if (selectMode && selectedIds.length === 0) {
      // Keep select mode open if user just cleared, allow manual exit
    }
  }, [selectMode, selectedIds.length]);

  function enterSelectMode(entryId?: string) {
    setSelectMode(true);
    if (entryId) {
      setSelected({ [entryId]: true });
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected({});
    setBulkAction("none");
  }

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
      await bulkMarkReviewed({ ids: selectedIds });
      toast.success(`${selectedIds.length} items marked as reviewed`);
      exitSelectMode();
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to mark as reviewed");
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} entries? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        await deleteEntry({ id });
        onDelete?.(id);
      }
      toast.success(`${selectedIds.length} entries deleted`);
      exitSelectMode();
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete entries");
    }
  }

  async function handleBulkAddTag(tag: string) {
    try {
      for (const id of selectedIds) {
        const entry = entries.find((e) => e._id === id);
        if (!entry) continue;
        const currentTags = entry.tags ?? [];
        if (!currentTags.includes(tag)) {
          await updateEntry({ id, tags: [...currentTags, tag] });
        }
      }
      toast.success(`Added "${tag}" to ${selectedIds.length} entries`);
      exitSelectMode();
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add tag");
    }
  }

  async function handleBulkChangeCategory(category: string) {
    try {
      for (const id of selectedIds) {
        await updateEntry({ id, category });
      }
      toast.success(`Changed category to "${category}"`);
      exitSelectMode();
      onBulkComplete?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to change category");
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

  const handleTouchEnd = useCallback(async (id: Id<"entries">) => {
    const offset = swipeOffset[id] ?? 0;
    if (offset >= SWIPE_THRESHOLD) {
      // Swipe right = mark reviewed
      try {
        await updateEntry({ id, needsReview: false });
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
      {/* Selection Mode Header - Sticky at top when in select mode */}
      {selectMode && (
        <div
          className="sticky top-0 z-10 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--accent)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={exitSelectMode}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
              aria-label="Exit selection mode"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text)" }} />
            </button>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {selectedIds.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
              style={{ color: "var(--primary)" }}
            >
              Select all
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Clear
              </button>
            )}
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
                onTouchStart={(e) => {
                  handleTouchStart(r._id, e);
                  // Long press to enter select mode
                  longPressTimer.current = setTimeout(() => {
                    enterSelectMode(r._id);
                  }, 500);
                }}
                onTouchMove={(e) => {
                  handleTouchMove(r._id, e);
                  // Cancel long press on move
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                  if (!selectMode) {
                    handleTouchEnd(r._id);
                  }
                }}
              >
                {/* Checkbox - only show in select mode */}
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={!!selected[r._id]}
                    onChange={() => toggle(r._id)}
                    className="h-5 w-5 rounded shrink-0"
                    style={{ accentColor: "var(--primary)" }}
                  />
                )}

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
                  {r.recurringRuleId && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text-tertiary)" }}
                    >
                      Recurring rule
                    </span>
                  )}
                  {tagLabels.length > 0 && (
                    <>
                      <span style={{ color: "var(--text-tertiary)" }}>·</span>
                      {tagLabels.map((tag: string) => (
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

              {/* Actions Menu - only show when not in select mode */}
              {!selectMode && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => onSavePattern?.(r)}
                    className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-subtle)]"
                    title="Save as recurring rule"
                  >
                    <Lucide.Bookmark className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed Bottom Action Bar - shown when in select mode with items selected */}
      {selectMode && selectedIds.length > 0 && (
        <div
          className="fixed left-0 right-0 z-50 p-4"
          style={{
            bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
            backgroundColor: "var(--background)",
          }}
        >
          <div
            className="mx-auto max-w-md rounded-2xl p-3 shadow-lg flex items-center justify-around"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={handleBulkMarkReviewed}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-[var(--surface-subtle)]"
            >
              <Lucide.Check className="h-5 w-5" style={{ color: "var(--success)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Reviewed
              </span>
            </button>

            <button
              onClick={() => setBulkAction("tag")}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-[var(--surface-subtle)]"
            >
              <Lucide.Tag className="h-5 w-5" style={{ color: "var(--accent)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Tag
              </span>
            </button>

            <button
              onClick={() => setBulkAction("category")}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-[var(--surface-subtle)]"
            >
              <Lucide.Folder className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Category
              </span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-[var(--surface-subtle)]"
            >
              <Lucide.Trash2 className="h-5 w-5" style={{ color: "var(--error)" }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Delete
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Tag Selection Sheet */}
      {bulkAction === "tag" && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
          onClick={() => setBulkAction("none")}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-4 max-h-[50vh] overflow-y-auto"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Add Tag</h3>
              <button
                onClick={() => setBulkAction("none")}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
              >
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CONTEXT_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleBulkAddTag(tag)}
                  className="px-4 py-3 rounded-xl text-left text-sm font-medium hover:bg-[var(--surface-subtle)]"
                  style={{ color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Selection Sheet */}
      {bulkAction === "category" && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
          onClick={() => setBulkAction("none")}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-4 max-h-[50vh] overflow-y-auto"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Change Category</h3>
              <button
                onClick={() => setBulkAction("none")}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
              >
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleBulkChangeCategory(cat)}
                  className="px-4 py-3 rounded-xl text-left text-sm font-medium hover:bg-[var(--surface-subtle)]"
                  style={{ color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
