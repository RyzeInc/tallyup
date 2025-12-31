"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars, CONTEXT_TAGS, EXPENSE_SPACES, INCOME_SPACES } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";
import { CategoryIcon } from "@/components/icons/iconMap";

// Swipe threshold in px
const SWIPE_THRESHOLD = 80;

function getDateGroupLabel(ts: number): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  if (ts >= todayStart) return "TODAY";
  if (ts >= yesterdayStart) return "YESTERDAY";

  return new Date(ts)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}

function getReviewReasonFallback(entry: any): "NEEDS_CATEGORY" | "NEEDS_CONTEXT" | "NEEDS_ACCOUNT" | null {
  if (!entry.category) return "NEEDS_CATEGORY";
  if (!entry.contextTags || entry.contextTags.length === 0) return "NEEDS_CONTEXT";
  if (!entry.methodOrAccount) return "NEEDS_ACCOUNT";
  return null;
}

export default function ActivityTable({
  entries = [],
  onDelete,
  onSavePattern,
  onBulkComplete,
  externalSelectMode,
  onSelectModeChange,
}: {
  entries?: any[];
  onDelete?: (id: Id<"entries">) => void;
  onSavePattern?: (entry: any) => void;
  onBulkComplete?: () => void;
  externalSelectMode?: boolean;
  onSelectModeChange?: (mode: boolean) => void;
}) {
  const toast = useToast();
  
  // Selection mode state - use external control if provided
  const [internalSelectMode, setInternalSelectMode] = useState(false);
  const selectMode = externalSelectMode ?? internalSelectMode;
  const setSelectMode = onSelectModeChange ?? setInternalSelectMode;
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  
  const bulkMarkReviewed = useMutation(api.entries.bulkMarkReviewed);
  const updateEntry = useMutation(api.entries.updateEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);
  const accounts = useQuery(api.accounts.listAccounts, {}) as any[] | undefined;

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts ?? []) {
      if (acc?._id && acc?.name) map.set(acc._id, acc.name);
    }
    return map;
  }, [accounts]);

  const transferAccounts = useMemo(() => {
    const map = new Map<string, { from?: string; to?: string }>();
    for (const entry of entries ?? []) {
      if (!entry?.transferId) continue;
      const current = map.get(entry.transferId) ?? {};
      const accountName = entry.accountId ? accountNameById.get(entry.accountId) : undefined;
      if (entry.isTransferSource) {
        current.from = accountName ?? current.from;
      } else {
        current.to = accountName ?? current.to;
      }
      map.set(entry.transferId, current);
    }
    return map;
  }, [entries, accountNameById]);

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
      await bulkMarkReviewed({ ids: selectedIds as any });
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
        await deleteEntry({ id: id as any });
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
          await updateEntry({ id: id as any, tags: [...currentTags, tag] });
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
        await updateEntry({ id: id as any, category });
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

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const entry of entries ?? []) {
      const label = getDateGroupLabel(entry.date);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(entry);
    }
    return Array.from(groups.entries());
  }, [entries]);

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
        {groupedEntries.map(([groupLabel, groupEntries], groupIdx) => (
          <div key={groupLabel}>
            <div
              className="sticky z-10 px-4 py-2 text-xs font-semibold tracking-[0.18em]"
              style={{
                top: selectMode ? 52 : 0,
                backgroundColor: "var(--surface)",
                color: "var(--text-tertiary)",
                borderTop: groupIdx === 0 ? "none" : "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {groupLabel}
            </div>
            {groupEntries.map((r: any, i: number) => {
              const isIncome = r.type === "income";
              const isTransfer = r.type === "transfer";
              const amountColor = isIncome ? "var(--success)" : isTransfer ? "var(--text-secondary)" : "var(--text)";
              const amountPrefix = isIncome ? "+" : isTransfer ? "" : "−";
              const categoryLabel = r.category || r.bucket || "Uncategorized";
              const title = r.merchant || r.note || categoryLabel || "Transaction";
              const offset = swipeOffset[r._id] ?? 0;
              const reviewReason = r.reviewReason ?? getReviewReasonFallback(r);
              const needsReview = Boolean(reviewReason);
              const isIgnored = Boolean(r.ignoredForBudgets || r.excludeFromBudgets);
              const isTaxRelevant = (r.contextTags ?? r.tags ?? []).includes("Tax-Deductible");
              const isRecent = r.createdAt && Date.now() - r.createdAt < 6 * 60 * 60 * 1000;

              let statusLabel = categoryLabel;
              if (isTransfer) statusLabel = "Transfer";
              else if (isIgnored) statusLabel = "Ignored for budgets";
              else if (reviewReason === "NEEDS_CONTEXT") statusLabel = "Needs context";
              else if (reviewReason === "NEEDS_ACCOUNT") statusLabel = "Needs account";
              else if (reviewReason === "NEEDS_CATEGORY" || !r.category) statusLabel = "Needs category";

              const dotColor = needsReview
                ? "var(--warning)"
                : isTaxRelevant
                ? "var(--accent)"
                : isRecent
                ? "var(--success)"
                : "var(--border)";

              const transferInfo = r.transferId ? transferAccounts.get(r.transferId) : undefined;
              const fromName = transferInfo?.from;
              const toName = transferInfo?.to;
              const transferLine = fromName || toName ? `${fromName ?? "From"} → ${toName ?? "To"}` : "Transfer";

              const contextLabel = (r.contextTags?.[0] ?? r.tags?.[0]) || "";
              const secondaryLine = isTransfer
                ? transferLine
                : [r.methodOrAccount, contextLabel].filter(Boolean).join(" • ");

              return (
                <div
                  key={r._id}
                  className={`relative overflow-hidden ${i > 0 ? "border-t" : ""}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Swipe background indicators */}
                  <div className="absolute inset-0 flex">
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
                      longPressTimer.current = setTimeout(() => {
                        enterSelectMode(r._id);
                      }, 500);
                    }}
                    onTouchMove={(e) => {
                      handleTouchMove(r._id, e);
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
                        handleTouchEnd(r._id, r);
                      }
                    }}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={!!selected[r._id]}
                        onChange={() => toggle(r._id)}
                        className="h-5 w-5 rounded shrink-0"
                        style={{ accentColor: "var(--primary)" }}
                      />
                    )}

                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--surface-subtle)" }}
                    >
                      {(!r.category || needsReview) ? (
                        <Lucide.HelpCircle className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      ) : isTransfer ? (
                        <Lucide.ArrowRightLeft className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                      ) : isIncome ? (
                        <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                      ) : (
                        <CategoryIcon category={categoryLabel} size={18} style={{ color: "var(--text-secondary)" }} />
                      )}
                    </div>

                    <Link href={`/activity?edit=${r._id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-body font-semibold truncate" style={{ color: "var(--text)" }}>
                          {title}
                        </div>
                        {secondaryLine && (
                          <div className="text-meta truncate" style={{ color: "var(--text-secondary)" }}>
                            {secondaryLine}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-body font-semibold tabular-nums" style={{ color: amountColor }}>
                          {amountPrefix}{centsToDollars(Math.abs(r.amountCents))}
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: needsReview ? "var(--warning-subtle)" : "var(--surface-2)",
                            color: needsReview ? "var(--warning)" : "var(--text-secondary)",
                            border: `1px solid ${needsReview ? "var(--warning)" : "var(--border)"}`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
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
