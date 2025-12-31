"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import RecurringModal from "@/components/RecurringModal";
import EditEntryModal from "@/components/EditEntryModal";
import ActivityTable from "@/components/activity/ActivityTable";
import TimeRangeControl from "@/components/TimeRangeControl";
import TimeRangeBadge from "@/components/TimeRangeBadge";
import { useTimeRange } from "@/components/TimeRangeProvider";
import { toQueryArgs } from "@/src/lib/timeRange/toQueryArgs";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { EntryType, EXPENSE_SPACES, INCOME_SPACES, CONTEXT_TAGS } from "@/components/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuickLog } from "@/components/log/QuickLogProvider";

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { open: openQuickLog } = useQuickLog();

  const { resolvedRange } = useTimeRange();
  const { fromMs, toMs } = toQueryArgs(resolvedRange);
  const startDate = fromMs;
  const endDate = toMs;

  const [type, setType] = useState<"all" | EntryType>(() => (searchParams.get("type") as any) ?? "all");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const reviewOnly = searchParams.get("review") === "1";
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Selection mode - controlled from here, passed to ActivityTable
  const [selectMode, setSelectMode] = useState(false);

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get("category");
    return cat ? [cat] : [];
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tag = searchParams.get("tag");
    return tag ? [tag] : [];
  });
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  // Focus search on mount if requested
  useEffect(() => {
    if (searchParams.get("focus") === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchParams]);

  // Sync URL params to state when URL changes (for drill-down navigation)
  const prevSearchParams = useRef(searchParams.toString());
  useEffect(() => {
    const currentParams = searchParams.toString();
    if (currentParams !== prevSearchParams.current) {
      prevSearchParams.current = currentParams;
      
      // Update state from URL params
      const urlType = searchParams.get("type");
      if (urlType === "income" || urlType === "expense") {
        setType(urlType);
      } else if (!urlType) {
        setType("all");
      }
      
      const urlCategory = searchParams.get("category");
      if (urlCategory) {
        setSelectedCategories([urlCategory]);
      } else {
        setSelectedCategories([]);
      }
      
      const urlTag = searchParams.get("tag");
      if (urlTag) {
        setSelectedTags([urlTag]);
      } else {
        setSelectedTags([]);
      }
      
      const urlQ = searchParams.get("q");
      if (urlQ !== null) {
        setQ(urlQ);
      }
    }
  }, [searchParams]);

  // Track if this is initial mount to avoid URL sync loops
  const isInitialMount = useRef(true);
  const lastUrlUpdate = useRef<string>("");

  // Update URL when filters change (but not on initial mount or when reading from URL)
  useEffect(() => {
    // Skip on initial mount - state is already initialized from URL
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const p = new URLSearchParams();
    if (type && type !== "all") p.set("type", type);
    if (q) p.set("q", q);
    if (reviewOnly) p.set("review", "1");
    if (selectedCategories.length === 1) p.set("category", selectedCategories[0]);
    if (selectedTags.length === 1) p.set("tag", selectedTags[0]);
    
    // Preserve edit param if present
    const editParam = searchParams.get("edit");
    if (editParam) p.set("edit", editParam);
    
    const qs = p.toString();
    const url = qs ? `/activity?${qs}` : `/activity`;
    
    // Avoid updating if URL is the same (prevents loops)
    if (url !== lastUrlUpdate.current) {
      lastUrlUpdate.current = url;
      router.replace(url);
    }
  }, [type, q, selectedCategories, selectedTags, router, reviewOnly, searchParams]);

  const deleteEntry = useMutation(api.entries.deleteEntry);

  // paginated entries: cursor-based pages from server
  const [pages, setPages] = useState<any[][]>([]);
  const [seenIds, setSeenIds] = useState<Record<string, boolean>>({});
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [cursorList, setCursorList] = useState<Array<number | undefined>>([undefined]);

  const currentCursor = cursorList[cursorList.length - 1];

  const pageResult = useQuery(api.entries.listEntriesPaged, {
    type: type === "all" ? undefined : type,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    startDate,
    endDate,
    needsReview: reviewOnly ? true : undefined,
    search: q ? q : undefined,
    limit: 60,
    cursorDate: currentCursor,
  }) as any | undefined;

  // when filters change, reset pages
  useEffect(() => {
    setPages([]);
    setNextCursor(undefined);
    setCursorList([undefined]);
    setSeenIds({});
  }, [type, startDate, endDate, selectedCategories, selectedTags, reviewOnly, q]);

  // append page result when it arrives
  useEffect(() => {
    if (!pageResult?.rows) return;
    const newRows: any[] = [];
    const seen = { ...seenIds };
    for (const r of pageResult.rows) {
      if (!seen[r._id]) {
        newRows.push(r);
        seen[r._id] = true;
      }
    }
    if (newRows.length) setPages((p) => [...p, newRows]);
    setSeenIds(seen);
    setNextCursor(pageResult.nextCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageResult]);

  // Sort and filter entries
  const allEntries = useMemo(() => {
    let entries = pages.flat();
    
    // Apply amount range filter using absolute values (magnitude)
    // This ensures filtering works correctly for both income and expenses
    if (minAmount) {
      const minCents = Math.round(parseFloat(minAmount) * 100);
      entries = entries.filter((e) => Math.abs(e.amountCents) >= minCents);
    }
    if (maxAmount) {
      const maxCents = Math.round(parseFloat(maxAmount) * 100);
      entries = entries.filter((e) => Math.abs(e.amountCents) <= maxCents);
    }
    
    // Apply method/account filter
    if (selectedMethods.length > 0) {
      entries = entries.filter((e) => {
        const method = e.methodOrAccount ?? "";
        return selectedMethods.some((m) => {
          if (m === "__unspecified__") return !e.methodOrAccount || e.methodOrAccount.trim() === "";
          return method.toLowerCase() === m.toLowerCase();
        });
      });
    }
    
    // Sort
    switch (sortBy) {
      case "oldest":
        return [...entries].sort((a, b) => a.date - b.date);
      case "highest":
        return [...entries].sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents));
      case "lowest":
        return [...entries].sort((a, b) => Math.abs(a.amountCents) - Math.abs(b.amountCents));
      case "newest":
      default:
        return [...entries].sort((a, b) => b.date - a.date);
    }
  }, [pages, sortBy, minAmount, maxAmount, selectedMethods]);

  const [selected, setSelected] = useState<any | null>(null);

  // Edit modal state - triggered by ?edit=id query param
  const editId = searchParams.get("edit");
  const [editEntry, setEditEntry] = useState<any | null>(null);

  // Load entry for editing when editId changes
  useEffect(() => {
    if (editId && allEntries.length > 0) {
      const entry = allEntries.find((e) => e._id === editId);
      if (entry) {
        setEditEntry(entry);
      }
    } else if (!editId) {
      setEditEntry(null);
    }
  }, [editId, allEntries]);

  // Close edit modal and clear URL param
  function closeEditModal() {
    setEditEntry(null);
    // Remove edit param from URL
    const p = new URLSearchParams(searchParams.toString());
    p.delete("edit");
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setCursorList((c) => [...c, nextCursor]);
  }

  // Count active filters
  const activeFilterCount =
    selectedCategories.length +
    selectedTags.length +
    selectedMethods.length +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (type !== "all" ? 1 : 0) +
    (reviewOnly ? 1 : 0);

  // Clear a specific filter
  function clearCategory(cat: string) {
    setSelectedCategories((prev) => prev.filter((c) => c !== cat));
  }
  function clearTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }
  function clearMethod(m: string) {
    setSelectedMethods((prev) => prev.filter((x) => x !== m));
  }
  function clearAllFilters() {
    setSelectedCategories([]);
    setSelectedTags([]);
    setSelectedMethods([]);
    setMinAmount("");
    setMaxAmount("");
  }

  function toggleReview() {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (reviewOnly) {
      p.delete("review");
    } else {
      p.set("review", "1");
    }
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
  }

  // Category options based on type
  const categoryOptions = useMemo(() => {
    if (type === "income") return [...INCOME_SPACES];
    if (type === "expense") return [...EXPENSE_SPACES];
    return [...INCOME_SPACES, ...EXPENSE_SPACES];
  }, [type]);

  // Data-driven method/account options from user's entries
  const methodOptions = useMemo(() => {
    const allPages = pages.flat();
    const methodSet = new Set<string>();
    let hasUnspecified = false;
    
    for (const e of allPages) {
      if (e.methodOrAccount && e.methodOrAccount.trim()) {
        methodSet.add(e.methodOrAccount.trim());
      } else {
        hasUnspecified = true;
      }
    }
    
    // Sort alphabetically and prepend Unspecified if any entries lack method
    const sorted = [...methodSet].sort((a, b) => a.localeCompare(b));
    if (hasUnspecified) {
      sorted.unshift("__unspecified__");
    }
    return sorted;
  }, [pages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header with Date Picker */}
      <PageHeader
        title="Activity"
        subtitle="All transactions"
        rightSlot={
          <div className="flex items-center gap-2">
            <TimeRangeBadge />
            <TimeRangeControl />
          </div>
        }
        compact
      />

      <SignedOut>
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--card-radius)",
            border: "1px solid var(--border)",
            padding: "var(--space-6)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
            Sign in to view your activity
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Search Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--input-radius)",
            border: "1px solid var(--border)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          <Lucide.Search className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search transactions"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              fontSize: "var(--text-body)",
              color: "var(--text)",
            }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              style={{
                padding: "4px",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                backgroundColor: "transparent",
                border: "none",
              }}
            >
              <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
          <button
            onClick={() => setFiltersOpen(true)}
            className="relative rounded-full p-2 transition-colors"
            style={{ backgroundColor: "var(--surface-2)" }}
            aria-label="Open filters"
          >
            <Lucide.SlidersHorizontal className="h-4 w-4" style={{ color: "var(--text)" }} />
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1 -right-1 rounded-full px-1.5 text-[10px] font-semibold"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Add CTA */}
        <button
          onClick={() => openQuickLog()}
          className="w-full rounded-xl px-4 py-3 text-left transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Quick Add</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Fast log in seconds</div>
        </button>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
            {selectedCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => clearCategory(cat)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-micro)",
                  fontWeight: 500,
                  cursor: "pointer",
                  backgroundColor: "var(--accent-subtle)",
                  color: "var(--primary)",
                  border: "none",
                }}
              >
                {cat}
                <Lucide.X className="h-3 w-3" />
              </button>
            ))}
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => clearTag(tag)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-micro)",
                  fontWeight: 500,
                  cursor: "pointer",
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                  border: "none",
                }}
              >
                {tag}
                <Lucide.X className="h-3 w-3" />
              </button>
            ))}
            {selectedMethods.map((m) => (
              <button
                key={m}
                onClick={() => clearMethod(m)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-micro)",
                  fontWeight: 500,
                  cursor: "pointer",
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                  border: "none",
                }}
              >
                {m === "__unspecified__" ? "Unspecified" : m}
                <Lucide.X className="h-3 w-3" />
              </button>
            ))}
            {(minAmount || maxAmount) && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-micro)",
                  fontWeight: 500,
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                }}
              >
                {minAmount && maxAmount ? `$${minAmount} – $${maxAmount}` : minAmount ? `≥ $${minAmount}` : `≤ $${maxAmount}`}
              </span>
            )}
            <button
              onClick={clearAllFilters}
              style={{
                fontSize: "var(--text-micro)",
                fontWeight: 500,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results */}
        {pages.length === 0 && !pageResult ? (
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border)",
              padding: "var(--space-8)",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
              <Lucide.Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-tertiary)" }} />
              <span style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}>Loading transactions…</span>
            </div>
          </div>
        ) : allEntries.length === 0 ? (
          <EmptyState
            title="No transactions"
            subtitle="No entries match your current filters."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <ActivityTable
              entries={allEntries}
              onDelete={(id) => deleteEntry({ id })}
              onSavePattern={(e) => setSelected(e)}
              onBulkComplete={() => {
                setPages([]);
                setCursorList([undefined]);
                setSeenIds({});
              }}
              externalSelectMode={selectMode}
              onSelectModeChange={setSelectMode}
            />

            {nextCursor && (
              <div style={{ textAlign: "center", paddingTop: "var(--space-2)" }}>
                <button
                  onClick={loadMore}
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

        {selected && (
          <RecurringModal
            entry={selected}
            onClose={() => setSelected(null)}
            onCreated={() => setSelected(null)}
          />
        )}

        {/* Edit Entry Modal */}
        {editEntry && (
          <EditEntryModal
            entry={editEntry}
            onClose={closeEditModal}
            onSaved={() => {
              // Close the modal first (this clears editEntry and URL param)
              closeEditModal();
              // Then refresh the list
              setPages([]);
              setCursorList([undefined]);
              setSeenIds({});
            }}
            onDeleted={() => {
              // Close the modal first
              closeEditModal();
              // Then refresh the list
              setPages([]);
              setCursorList([undefined]);
              setSeenIds({});
            }}
          />
        )}

        {/* Filters Bottom Sheet */}
        {filtersOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.4)",
              }}
              onClick={() => setFiltersOpen(false)}
            />
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "28rem",
              }}
            >
              <div
                style={{
                  borderTopLeftRadius: "var(--card-radius)",
                  borderTopRightRadius: "var(--card-radius)",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderBottom: "none",
                  padding: "var(--space-4)",
                  paddingBottom: "var(--space-8)",
                  maxHeight: "85vh",
                  overflowY: "auto",
                }}
              >
                {/* Handle */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
                  <div style={{ height: 4, width: 40, borderRadius: "var(--radius-full)", backgroundColor: "var(--border)" }} />
                </div>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
                  <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text)" }}>Filters</h2>
                  <button
                    onClick={() => setFiltersOpen(false)}
                    style={{
                      padding: "var(--space-2)",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                </div>

                {/* Type filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Type</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {(["all", "expense", "income"] as const).map((t) => {
                      const isActive = type === t;
                      const label = t === "all" ? "All" : t === "expense" ? "Spent" : "Received";
                      return (
                        <button
                          key={t}
                          onClick={() => setType(t)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-micro)",
                            fontWeight: 500,
                            cursor: "pointer",
                            backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                            color: isActive ? "var(--primary)" : "var(--text)",
                            border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Review filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Review</h3>
                  <button
                    onClick={toggleReview}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-meta)",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 150ms ease",
                      backgroundColor: reviewOnly ? "var(--warning-subtle)" : "transparent",
                      color: reviewOnly ? "var(--warning)" : "var(--text)",
                      border: reviewOnly ? "1px solid var(--warning)" : "1px solid var(--border)",
                    }}
                  >
                    <Lucide.AlertCircle className="h-4 w-4" />
                    Needs meaning
                    {reviewCount > 0 && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "var(--radius-full)",
                          fontSize: "10px",
                          fontWeight: 700,
                          backgroundColor: "var(--warning)",
                          color: "white",
                        }}
                      >
                        {reviewCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Category filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Category</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {categoryOptions.map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategories((prev) => prev.filter((c) => c !== cat));
                            } else {
                              setSelectedCategories((prev) => [...prev, cat]);
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-micro)",
                            fontWeight: 500,
                            cursor: "pointer",
                            backgroundColor: isSelected ? "var(--primary)" : "transparent",
                            color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                            border: isSelected ? "none" : "1px solid var(--border)",
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Context Tags filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Context Tags</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {CONTEXT_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTags((prev) => prev.filter((t) => t !== tag));
                            } else {
                              setSelectedTags((prev) => [...prev, tag]);
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-micro)",
                            fontWeight: 500,
                            cursor: "pointer",
                            backgroundColor: isSelected ? "var(--primary)" : "transparent",
                            color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                            border: isSelected ? "none" : "1px solid var(--border)",
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount Range filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Amount Range</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                    <div>
                      <label style={{ fontSize: "var(--text-micro)", display: "block", marginBottom: "4px", color: "var(--text-secondary)" }}>Min</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "var(--text-meta)", color: "var(--text-tertiary)" }}>$</span>
                        <input
                          type="number"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          placeholder="0"
                          style={{
                            width: "100%",
                            paddingLeft: "28px",
                            paddingRight: "12px",
                            padding: "10px 12px 10px 28px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--surface-2)",
                            fontSize: "var(--text-meta)",
                            color: "var(--text)",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "var(--text-micro)", display: "block", marginBottom: "4px", color: "var(--text-secondary)" }}>Max</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "var(--text-meta)", color: "var(--text-tertiary)" }}>$</span>
                        <input
                          type="number"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          placeholder="Any"
                          style={{
                            width: "100%",
                            padding: "10px 12px 10px 28px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--surface-2)",
                            fontSize: "var(--text-meta)",
                            color: "var(--text)",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Method/Account filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Method / Account</h3>
                  {methodOptions.length === 0 ? (
                    <p style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)" }}>
                      No methods found in your entries
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {methodOptions.map((method) => {
                        const isUnspecified = method === "__unspecified__";
                        const label = isUnspecified ? "Unspecified" : method;
                        const isSelected = selectedMethods.includes(method);
                        return (
                          <button
                            key={method}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMethods((prev) => prev.filter((m) => m !== method));
                              } else {
                                setSelectedMethods((prev) => [...prev, method]);
                              }
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "var(--radius-full)",
                              fontSize: "var(--text-micro)",
                              fontWeight: 500,
                              cursor: "pointer",
                              backgroundColor: isSelected ? "var(--primary)" : "transparent",
                              color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                              border: isSelected ? "none" : "1px solid var(--border)",
                              fontStyle: isUnspecified ? "italic" : undefined,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sort */}
                <div style={{ marginBottom: "var(--space-6)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Sort by</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                    {[
                      { key: "newest", label: "Newest" },
                      { key: "oldest", label: "Oldest" },
                      { key: "highest", label: "Highest" },
                      { key: "lowest", label: "Lowest" },
                    ].map((opt) => {
                      const isActive = sortBy === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setSortBy(opt.key as any)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--text-meta)",
                            fontWeight: 500,
                            cursor: "pointer",
                            backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                            color: isActive ? "var(--primary)" : "var(--text)",
                            border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Apply button */}
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="btn-primary"
                  style={{ width: "100%" }}
                >
                  Apply Filters
                </button>

                {/* Clear all */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      clearAllFilters();
                      setFiltersOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "center",
                      fontSize: "var(--text-meta)",
                      fontWeight: 500,
                      padding: "var(--space-2)",
                      marginTop: "var(--space-2)",
                      color: "var(--text-secondary)",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}
