"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars, CONTEXT_TAGS, getCategoryDisplayName } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// Swipe threshold in px
const SWIPE_THRESHOLD = 80;

// Helper to convert snake_case tags to display format (e.g., "transfer_in" -> "Transfer In")
function formatTagForDisplay(tag: string): string {
  return tag
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Column definitions
type ColumnKey = "date" | "category" | "amount" | "merchant" | "title" | "account" | "context" | "intent" | "tags" | "recurring" | "goal" | "note";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  incomeLabel?: string;
  width: number;
  minWidth?: number;
  flex?: number; // If set, column will grow to fill space
  sortable: boolean;
  align?: "left" | "right" | "center";
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", width: 80, sortable: true },
  { key: "category", label: "Category", incomeLabel: "Source", width: 120, flex: 1, sortable: true },
  { key: "amount", label: "Amount", width: 90, sortable: true, align: "right" },
  { key: "merchant", label: "Merchant", width: 130, flex: 1, sortable: true },
  { key: "account", label: "Payment", incomeLabel: "Account", width: 110, flex: 1, sortable: true },
  { key: "title", label: "Title", width: 110, flex: 1, sortable: true },
  { key: "context", label: "Context", width: 90, sortable: true },
  { key: "intent", label: "Intent", width: 90, sortable: true },
  { key: "tags", label: "Tags", width: 100, sortable: true },
  { key: "recurring", label: "Recurring", width: 32, sortable: false, align: "center" },
  { key: "goal", label: "Goal", width: 90, sortable: true },
  { key: "note", label: "Note", width: 130, flex: 1, sortable: true },
];

// Default column orders for different views
const COMPACT_COLUMNS: ColumnKey[] = ["date", "category", "amount", "merchant", "account", "title"];
const EXTENDED_COLUMNS: ColumnKey[] = ["date", "category", "amount", "merchant", "account", "title", "context", "intent", "tags", "recurring", "goal", "note"];

const STORAGE_KEY_COMPACT = "tallyup.activityTable.compactColumns";
const STORAGE_KEY_EXTENDED = "tallyup.activityTable.extendedColumns";

export default function ActivityTable({
  entries = [],
  displayLimit,
  viewMode = "cards",
  typeFilter = "all",
  onDelete,
  onSavePattern,
  onBulkComplete,
  externalSelectMode,
  onSelectModeChange,
  hasMore,
  onLoadMore,
  onSortChange,
}: {
  entries?: Doc<"entries">[];
  displayLimit?: number;
  viewMode?: "cards" | "table" | "extended";
  typeFilter?: "all" | "expense" | "income";
  onDelete?: (id: Id<"entries">) => void;
  onSavePattern?: (entry: Doc<"entries">) => void;
  onBulkComplete?: () => void;
  externalSelectMode?: boolean;
  onSelectModeChange?: (mode: boolean) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSortChange?: (column: string | null, direction: "asc" | "desc" | null) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editHref = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", id);
    return `/activity?${params}`;
  }, [searchParams]);
  
  // Fetch user preferences for hidden categories/tags
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});
  
  // Get filtered context tags based on user preferences
  const filteredContextTags = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenContextTags ?? []).map(t => t.toLowerCase()));
    return CONTEXT_TAGS.filter(tag => !hiddenSet.has(tag.toLowerCase()));
  }, [userPrefs?.hiddenContextTags]);
  
  // Fetch categories to resolve IDs to names
  const expenseCategories = useQuery(api.categories.listCategories, { categoryType: "expense", includeArchived: true });
  const incomeCategories = useQuery(api.categories.listCategories, { categoryType: "income", includeArchived: true });
  const allCustomCategories = useMemo(() => {
    const expense = (expenseCategories ?? []) as { _id: string; name: string }[];
    const income = (incomeCategories ?? []) as { _id: string; name: string }[];
    return [...expense, ...income];
  }, [expenseCategories, incomeCategories]);

  // Get filtered expense/income categories
  const filteredExpenseCategories = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenExpenseCategories ?? []).map((c) => c.toLowerCase()));
    return ((expenseCategories ?? []) as { _id: string; name: string; archived?: boolean }[])
      .filter(c => !c.archived)
      .map((c) => c.name)
      .filter((name) => !hiddenSet.has(name.toLowerCase()));
  }, [expenseCategories, userPrefs?.hiddenExpenseCategories]);
  
  const filteredIncomeCategories = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenIncomeCategories ?? []).map((c) => c.toLowerCase()));
    return ((incomeCategories ?? []) as { _id: string; name: string; archived?: boolean }[])
      .filter(c => !c.archived)
      .map((c) => c.name)
      .filter((name) => !hiddenSet.has(name.toLowerCase()));
  }, [incomeCategories, userPrefs?.hiddenIncomeCategories]);
  
  // Fetch goals for goal column
  const goals = useQuery(api.goals.listGoals, {}) as { _id: string; name: string }[] | undefined;
  const getGoalName = useCallback((goalId: string | undefined) => {
    if (!goalId || !goals) return null;
    const goal = goals.find((g) => g._id === goalId);
    return goal?.name ?? null;
  }, [goals]);
  
  // Fetch accounts for account column
  const accounts = useQuery(api.accounts.listAccounts, { includeArchived: true }) as { _id: string; name: string; last4?: string }[] | undefined;
  const getAccountName = useCallback((accountId: string | undefined) => {
    if (!accountId || !accounts) return null;
    const account = accounts.find((a) => a._id === accountId);
    return account ? `${account.name}${account.last4 ? ` ••${account.last4}` : ""}` : null;
  }, [accounts]);

  // Column order state with localStorage persistence
  const [compactColumnOrder, setCompactColumnOrder] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_COMPACT);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return COMPACT_COLUMNS;
  });

  const [extendedColumnOrder, setExtendedColumnOrder] = useState<ColumnKey[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_EXTENDED);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return EXTENDED_COLUMNS;
  });

  // Persist column orders
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPACT, JSON.stringify(compactColumnOrder));
    } catch {}
  }, [compactColumnOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXTENDED, JSON.stringify(extendedColumnOrder));
    } catch {}
  }, [extendedColumnOrder]);

  // Get current column order based on view mode
  const currentColumnOrder = viewMode === "extended" ? extendedColumnOrder : compactColumnOrder;
  const setCurrentColumnOrder = viewMode === "extended" ? setExtendedColumnOrder : setCompactColumnOrder;

  // Drag and drop state
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  const handleDragStart = (e: React.DragEvent, columnKey: ColumnKey) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnKey: ColumnKey) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragEnd = () => {
    if (draggedColumn && dragOverColumn && draggedColumn !== dragOverColumn) {
      const newOrder = [...currentColumnOrder];
      const fromIndex = newOrder.indexOf(draggedColumn);
      const toIndex = newOrder.indexOf(dragOverColumn);
      if (fromIndex !== -1 && toIndex !== -1) {
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedColumn);
        setCurrentColumnOrder(newOrder);
      }
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  
  // Selection mode state - use external control if provided
  const [internalSelectMode, setInternalSelectMode] = useState(false);
  const selectMode = externalSelectMode ?? internalSelectMode;
  const setSelectMode = onSelectModeChange ?? setInternalSelectMode;
  const [selected, setSelected] = useState<Record<Id<"entries">, boolean>>({} as Record<Id<"entries">, boolean>);
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k as Id<"entries">]) as Id<"entries">[],
    [selected]
  );

  // Sorting state: column key and direction
  type SortDirection = "asc" | "desc" | null;
  type SortColumn = ColumnKey | null;
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Cycle through sort states: null -> asc -> desc -> null
  const handleColumnSort = (column: SortColumn) => {
    let newColumn: SortColumn = column;
    let newDirection: SortDirection;
    
    if (sortColumn !== column) {
      newDirection = "asc";
    } else if (sortDirection === "asc") {
      newDirection = "desc";
    } else if (sortDirection === "desc") {
      newColumn = null;
      newDirection = null;
    } else {
      newDirection = "asc";
    }
    
    setSortColumn(newColumn);
    setSortDirection(newDirection);
    onSortChange?.(newColumn, newDirection);
  };

  // Sort entries based on current sort state
  const sortedEntries = useMemo(() => {
    if (!sortColumn || !sortDirection) return entries;

    return [...entries].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortColumn) {
        case "date":
          aVal = a.date;
          bVal = b.date;
          break;
        case "category":
          aVal = (getCategoryDisplayName(a.categoryId ?? a.category ?? a.bucket, allCustomCategories) ?? "").toLowerCase();
          bVal = (getCategoryDisplayName(b.categoryId ?? b.category ?? b.bucket, allCustomCategories) ?? "").toLowerCase();
          break;
        case "amount":
          aVal = a.amountCents;
          bVal = b.amountCents;
          break;
        case "merchant":
          aVal = (a.merchant ?? "").toLowerCase();
          bVal = (b.merchant ?? "").toLowerCase();
          break;
        case "title":
          aVal = ((a as Doc<"entries"> & { title?: string }).title ?? "").toLowerCase();
          bVal = ((b as Doc<"entries"> & { title?: string }).title ?? "").toLowerCase();
          break;
        case "account":
          aVal = (getAccountName(a.accountId as string | undefined) ?? a.methodOrAccount ?? "").toLowerCase();
          bVal = (getAccountName(b.accountId as string | undefined) ?? b.methodOrAccount ?? "").toLowerCase();
          break;
        case "context":
          aVal = (a.contextTags ?? []).join(",").toLowerCase();
          bVal = (b.contextTags ?? []).join(",").toLowerCase();
          break;
        case "intent":
          aVal = (a.intentTags ?? []).join(",").toLowerCase();
          bVal = (b.intentTags ?? []).join(",").toLowerCase();
          break;
        case "tags":
          aVal = (a.tags ?? []).join(",").toLowerCase();
          bVal = (b.tags ?? []).join(",").toLowerCase();
          break;
        case "goal":
          aVal = (getGoalName(a.goalId as string | undefined) ?? "").toLowerCase();
          bVal = (getGoalName(b.goalId as string | undefined) ?? "").toLowerCase();
          break;
        case "note":
          aVal = (a.note ?? "").toLowerCase();
          bVal = (b.note ?? "").toLowerCase();
          break;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [entries, sortColumn, sortDirection, allCustomCategories, getAccountName, getGoalName]);
  
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

  const handleTouchEnd = useCallback(async (id: Id<"entries">, e: React.TouchEvent) => {
    const offset = swipeOffset[id] ?? 0;
    if (offset >= SWIPE_THRESHOLD) {
      // Swipe right = mark reviewed
      e.preventDefault();
      try {
        await updateEntry({ id, needsReview: false });
        onBulkComplete?.();
      } catch (err) {
        console.error(err);
      }
    } else if (offset <= -SWIPE_THRESHOLD) {
      // Swipe left = edit (navigate using Next.js router)
      e.preventDefault();
      router.push(editHref(id));
    }
    // For small/no swipes, don't prevent default - allow Link to work
    setSwipeOffset((o) => ({ ...o, [id]: 0 }));
    delete touchStart.current[id];
  }, [swipeOffset, updateEntry, onBulkComplete, router, editHref]);

  // Get category options based on selected entries
  const categoryOptions = useMemo(() => {
    const hasExpense = selectedIds.some((id) => entries.find((e) => e._id === id)?.type === "expense");
    const hasIncome = selectedIds.some((id) => entries.find((e) => e._id === id)?.type === "income");
    if (hasExpense && hasIncome) return [...filteredExpenseCategories, ...filteredIncomeCategories];
    if (hasIncome) return [...filteredIncomeCategories];
    return [...filteredExpenseCategories];
  }, [selectedIds, entries, filteredExpenseCategories, filteredIncomeCategories]);

  return (
    <div className="space-y-3 flex flex-col min-h-0 max-h-full">
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

      {/* Transaction List - Table View (compact or extended) */}
      {(viewMode === "table" || viewMode === "extended") && (
        <div
          className="rounded-xl overflow-y-auto overflow-x-auto min-h-0 w-full"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Table Header - draggable, sortable columns */}
          <div
            className="flex items-center w-full sticky top-0 z-10"
            style={{ 
              gap: 12,
              padding: "12px 16px 8px",
              backgroundColor: "var(--surface-subtle)", 
              borderBottom: "1px solid var(--border)",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {selectMode && <div style={{ width: 20, flexShrink: 0 }} />}
            {currentColumnOrder.map((columnKey) => {
              const colDef = ALL_COLUMNS.find(c => c.key === columnKey);
              if (!colDef) return null;
              
              const label = typeFilter === "income" && colDef.incomeLabel ? colDef.incomeLabel : colDef.label;
              const isDragging = draggedColumn === columnKey;
              const isDragOver = dragOverColumn === columnKey;
              
              if (colDef.key === "recurring") {
                return (
                  <div
                    key={columnKey}
                    draggable
                    onDragStart={(e) => handleDragStart(e, columnKey)}
                    onDragOver={(e) => handleDragOver(e, columnKey)}
                    onDragEnd={handleDragEnd}
                    style={{ 
                      minWidth: colDef.width, 
                      flex: colDef.flex ? `${colDef.flex} 1 0%` : "0 0 auto",
                      textAlign: "center",
                      opacity: isDragging ? 0.5 : 1,
                      borderLeft: isDragOver ? "2px solid var(--primary)" : "none",
                      cursor: "grab",
                    }} 
                    title="Recurring"
                  >
                    <Lucide.Repeat className="h-4 w-4 inline" />
                  </div>
                );
              }
              
              return (
                <button
                  key={columnKey}
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, columnKey)}
                  onDragOver={(e) => handleDragOver(e, columnKey)}
                  onDragEnd={handleDragEnd}
                  onClick={() => colDef.sortable && handleColumnSort(columnKey)}
                  className={`flex items-center gap-1 ${colDef.align === "right" ? "justify-end" : ""} hover:text-[var(--text)] transition-colors`}
                  style={{ 
                    minWidth: colDef.width, 
                    flex: colDef.flex ? `${colDef.flex} 1 0%` : "0 0 auto",
                    textAlign: colDef.align || "left",
                    background: "none", 
                    border: "none", 
                    padding: 0, 
                    cursor: "grab", 
                    color: "inherit", 
                    textTransform: "inherit", 
                    letterSpacing: "inherit", 
                    fontWeight: "inherit", 
                    fontSize: "inherit",
                    opacity: isDragging ? 0.5 : 1,
                    borderLeft: isDragOver ? "2px solid var(--primary)" : "none",
                  }}
                >
                  {label}
                  {sortColumn === columnKey && colDef.sortable && (
                    sortDirection === "asc" ? <Lucide.ArrowUp className="h-3 w-3" /> : <Lucide.ArrowDown className="h-3 w-3" />
                  )}
                </button>
              );
            })}
          </div>
          {sortedEntries.slice(0, displayLimit).map((r, i) => {
            const isTransfer = r.type === "transfer";
            const isIncome = r.type === "income";
            const isTransferIn = isTransfer && r.isTransferSource === false;
            const amountColor = isTransfer
              ? isTransferIn
                ? "var(--success)"
                : "var(--text)"
              : isIncome
              ? "var(--success)"
              : "var(--text)";
            const amountPrefix = isTransfer ? (isTransferIn ? "+" : "−") : isIncome ? "+" : "−";
            const categoryLabel = getCategoryDisplayName(
              r.categoryId ?? r.category ?? r.bucket,
              allCustomCategories
            );
            const accountName = getAccountName(r.accountId as string | undefined) || r.methodOrAccount || "—";
            const goalName = getGoalName(r.goalId as string | undefined);
            const contextTags = r.contextTags ?? [];
            const intentTags = r.intentTags ?? [];
            const otherTags = r.tags ?? [];
            
            // Cell renderer
            const renderCell = (columnKey: ColumnKey) => {
              const colDef = ALL_COLUMNS.find(c => c.key === columnKey);
              if (!colDef) return null;
              
              const baseStyle: React.CSSProperties = { 
                minWidth: colDef.width, 
                flex: colDef.flex ? `${colDef.flex} 1 0%` : "0 0 auto",
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap",
                textAlign: colDef.align || "left",
              };
              
              switch (columnKey) {
                case "date":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.875rem", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  );
                case "category":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.9375rem", fontWeight: 600, color: "var(--text)" }}>
                      {categoryLabel}
                    </div>
                  );
                case "amount":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.9375rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: amountColor }}>
                      {amountPrefix}{centsToDollars(Math.abs(r.amountCents))}
                    </div>
                  );
                case "merchant":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {r.merchant || "—"}
                    </div>
                  );
                case "account":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                      {accountName}
                    </div>
                  );
                case "title":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {(r as Doc<"entries"> & { title?: string }).title || "—"}
                    </div>
                  );
                case "context":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                      {contextTags.length > 0 ? contextTags.slice(0, 2).map(formatTagForDisplay).join(", ") : "—"}
                    </div>
                  );
                case "intent":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                      {intentTags.length > 0 ? intentTags.slice(0, 2).map(formatTagForDisplay).join(", ") : "—"}
                    </div>
                  );
                case "tags":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
                      {otherTags.length > 0 ? otherTags.slice(0, 2).map(formatTagForDisplay).join(", ") : "—"}
                    </div>
                  );
                case "recurring":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, textAlign: "center" }}>
                      {r.recurringRuleId ? (
                        <Lucide.Check className="h-4 w-4 inline" style={{ color: "var(--success)" }} />
                      ) : (
                        <span style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>—</span>
                      )}
                    </div>
                  );
                case "goal":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.8125rem", color: goalName ? "var(--primary)" : "var(--text-tertiary)" }}>
                      {goalName || "—"}
                    </div>
                  );
                case "note":
                  return (
                    <div key={columnKey} style={{ ...baseStyle, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {r.note || "—"}
                    </div>
                  );
                default:
                  return null;
              }
            };
            
            return (
              <div
                key={r._id}
                className={`flex items-center w-full cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors ${i > 0 ? "border-t" : ""}`}
                style={{ 
                  gap: 12,
                  padding: "10px 16px",
                  borderColor: "var(--border)",
                }}
                onClick={() => {
                  if (selectMode) {
                    toggle(r._id);
                  } else {
                    router.push(editHref(r._id));
                  }
                }}
              >
                {/* Checkbox */}
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={!!selected[r._id]}
                    onChange={() => toggle(r._id)}
                    className="rounded"
                    style={{ width: 18, height: 18, flexShrink: 0, accentColor: "var(--primary)" }}
                  />
                )}
                
                {/* Render columns in order */}
                {currentColumnOrder.map(renderCell)}
              </div>
            );
          })}

          {/* Load More Button - inside scroll container */}
          {hasMore && onLoadMore && (
            <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
              <button
                onClick={onLoadMore}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "10px 16px",
                  borderRadius: "var(--input-radius)",
                  fontSize: "var(--text-meta)",
                  fontWeight: 500,
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Lucide.ChevronDown className="h-4 w-4" />
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction List - Card View */}
      {viewMode === "cards" && (
      <div
        className="rounded-xl overflow-y-auto min-h-0"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {sortedEntries.slice(0, displayLimit).map((r, i) => {
          const isTransfer = r.type === "transfer";
          const isIncome = r.type === "income";
          const isTransferIn = isTransfer && r.isTransferSource === false;
          const amountColor = isTransfer
            ? isTransferIn
              ? "var(--success)"
              : "var(--text)"
            : isIncome
            ? "var(--success)"
            : "var(--text)";
          const amountPrefix = isTransfer ? (isTransferIn ? "+" : "−") : isIncome ? "+" : "−";
          
          // Build secondary line: Category · Tags (as short chips)
          const categoryLabel = getCategoryDisplayName(
            r.categoryId ?? r.category ?? r.bucket,
            allCustomCategories
          );
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
                className="relative flex items-center gap-3 px-4 py-3 transition-transform bg-[var(--surface)] cursor-pointer"
                style={{ transform: `translateX(${offset}px)` }}
                onClick={(e) => {
                  // Only navigate if not in select mode and click target isn't a button/checkbox
                  const target = e.target as HTMLElement;
                  if (selectMode) {
                    toggle(r._id);
                    return;
                  }
                  if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
                    return;
                  }
                  // Navigate to edit using Next.js router (prevents full page reload)
                  router.push(editHref(r._id));
                }}
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
                onTouchEnd={(e) => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                  if (!selectMode) {
                    handleTouchEnd(r._id, e);
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
              <Link href={editHref(r._id)} className="flex-1 min-w-0">
                {/* Primary: Title - Merchant/Name takes priority, note is separate */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-body font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {r.merchant || r.title || categoryLabel}
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
                
                {/* Note - shown separately below title if present */}
                {((r.merchant && r.title && r.title !== r.merchant) || r.note) && (
                  <div className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                    {[r.merchant && r.title !== r.merchant ? r.title : undefined, r.note].filter(Boolean).join(" · ")}
                  </div>
                )}
                
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
                          <span className="text-[11px]">{formatTagForDisplay(tag)}</span>
                        </span>
                      ))}
                    </>
                  )}
                </div>
                
                {/* Tertiary: Method/account if present */}
                {(r.accountId || r.methodOrAccount) && (
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                    {getAccountName(r.accountId) || r.methodOrAccount || "Account unavailable"}
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

        {/* Load More Button - inside scroll container */}
        {hasMore && onLoadMore && (
          <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
            <button
              onClick={onLoadMore}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "10px 16px",
                borderRadius: "var(--input-radius)",
                fontSize: "var(--text-meta)",
                fontWeight: 500,
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              <Lucide.ChevronDown className="h-4 w-4" />
              Load more
            </button>
          </div>
        )}
      </div>
      )}

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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
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
              {filteredContextTags.map((tag) => (
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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
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
