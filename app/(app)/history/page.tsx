"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import RecurringModal from "@/components/RecurringModal";
import EditEntryModal from "@/components/EditEntryModal";
import ActivityTable from "@/components/activity/ActivityTable";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useTimeRange } from "@/components/TimeRangeProvider";
import EmptyState from "@/components/ui/EmptyState";
import { EntryType, EXPENSE_SPACES, INCOME_SPACES, CONTEXT_TAGS } from "@/components/utils";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { startDate, endDate } = useTimeRange();

  const [type, setType] = useState<"all" | EntryType>(() => (searchParams.get("type") as any) ?? "all");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const reviewOnly = searchParams.get("review") === "1";
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Sync URL filters
  useEffect(() => {
    const cat = searchParams.get("category");
    const tag = searchParams.get("tag");
    if (cat) setSelectedCategories([cat]);
    if (tag) setSelectedTags([tag]);
    setType((searchParams.get("type") as any) ?? "all");
  }, [searchParams]);

  // Update URL when filters change
  useEffect(() => {
    const p = new URLSearchParams();
    if (type && type !== "all") p.set("type", type);
    if (q) p.set("q", q);
    if (reviewOnly) p.set("review", "1");
    if (selectedCategories.length === 1) p.set("category", selectedCategories[0]);
    if (selectedTags.length === 1) p.set("tag", selectedTags[0]);
    const qs = p.toString();
    const url = qs ? `/activity?${qs}` : `/activity`;
    router.replace(url);
  }, [type, q, reviewOnly, selectedCategories, selectedTags, router]);

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
  const activeFilterCount = selectedCategories.length + selectedTags.length + selectedMethods.length + (minAmount ? 1 : 0) + (maxAmount ? 1 : 0);

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

  const filterChip = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
        : "hover:bg-[var(--surface-subtle)]"
    }`;

  return (
    <div className="space-y-4 pb-4">
      {/* Header Card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1" style={{ color: "var(--text)" }}>Activity</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>All transactions</p>
          </div>
          <GlobalDateRangePicker showAllPresets />
        </div>
      </div>

      <SignedOut>
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to view your activity
          </div>
          <SignInButton mode="modal">
            <button
              className="rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Search Input */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Lucide.Search className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search transactions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent text-body outline-none placeholder:text-[var(--text-tertiary)]"
            style={{ color: "var(--text)" }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
        </div>

        {/* Filter Row: Type chips + Filters button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type segmented control */}
          <button
            onClick={() => setType("all")}
            className={filterChip(type === "all")}
            style={{
              border: `1px solid ${type === "all" ? "var(--accent)" : "var(--border)"}`,
              color: type === "all" ? "var(--accent)" : "var(--text)",
            }}
          >
            All
          </button>
          <button
            onClick={() => setType("expense")}
            className={filterChip(type === "expense")}
            style={{
              border: `1px solid ${type === "expense" ? "var(--accent)" : "var(--border)"}`,
              color: type === "expense" ? "var(--accent)" : "var(--text)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Lucide.ArrowUpRight className="h-4 w-4" />
              Spent
            </span>
          </button>
          <button
            onClick={() => setType("income")}
            className={filterChip(type === "income")}
            style={{
              border: `1px solid ${type === "income" ? "var(--accent)" : "var(--border)"}`,
              color: type === "income" ? "var(--accent)" : "var(--text)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Lucide.ArrowDownLeft className="h-4 w-4" />
              Received
            </span>
          </button>

          {/* Review filter */}
          <button
            onClick={toggleReview}
            className={filterChip(reviewOnly)}
            style={{
              border: `1px solid ${reviewOnly ? "var(--warning)" : "var(--border)"}`,
              color: reviewOnly ? "var(--warning)" : "var(--text)",
              backgroundColor: reviewOnly ? "var(--warning-subtle)" : undefined,
            }}
          >
            <span className="flex items-center gap-1.5">
              <Lucide.AlertCircle className="h-4 w-4" />
              Needs review
              {reviewCount > 0 && (
                <span
                  className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: "var(--warning)",
                    color: "white",
                  }}
                >
                  {reviewCount}
                </span>
              )}
            </span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filters button */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <Lucide.SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => clearCategory(cat)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}
              >
                {cat}
                <Lucide.X className="h-3 w-3" />
              </button>
            ))}
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => clearTag(tag)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text)" }}
              >
                {tag}
                <Lucide.X className="h-3 w-3" />
              </button>
            ))}
            {selectedMethods.map((m) => (
              <button
                key={m}
                onClick={() => clearMethod(m)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text)" }}
              >
                {m === "__unspecified__" ? "Unspecified" : m}
                <Lucide.X className="h-3 w-3" />
              </button>
            ))}
            {(minAmount || maxAmount) && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text)" }}
              >
                {minAmount && maxAmount ? `$${minAmount} – $${maxAmount}` : minAmount ? `≥ $${minAmount}` : `≤ $${maxAmount}`}
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-xs font-medium underline"
              style={{ color: "var(--text-secondary)" }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results */}
        {pages.length === 0 && !pageResult ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-center gap-2 text-meta">
              <Lucide.Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-tertiary)" }} />
              <span>Loading transactions…</span>
            </div>
          </div>
        ) : allEntries.length === 0 ? (
          <EmptyState
            title="No transactions"
            subtitle="No entries match your current filters."
          />
        ) : (
          <div className="space-y-3">
            <ActivityTable
              entries={allEntries}
              onDelete={(id) => deleteEntry({ id })}
              onSavePattern={(e) => setSelected(e)}
              onBulkComplete={() => {
                setPages([]);
                setCursorList([undefined]);
                setSeenIds({});
              }}
            />

            {nextCursor && (
              <div className="text-center pt-2">
                <button
                  onClick={loadMore}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text)" }}
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
              // Refresh the list
              setPages([]);
              setCursorList([undefined]);
              setSeenIds({});
            }}
            onDeleted={() => {
              // Refresh the list
              setPages([]);
              setCursorList([undefined]);
              setSeenIds({});
            }}
          />
        )}

        {/* Filters Bottom Sheet */}
        {filtersOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setFiltersOpen(false)}
            />
            <div
              className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-200"
            >
              <div
                className="rounded-t-2xl border-t border-x p-4 pb-8 max-h-[85vh] overflow-y-auto"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                {/* Handle */}
                <div className="flex justify-center mb-3">
                  <div className="h-1 w-10 rounded-full" style={{ backgroundColor: "var(--border)" }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Filters</h2>
                  <button
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-full p-2 transition-colors hover:bg-[var(--surface-subtle)]"
                  >
                    <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                </div>

                {/* Category filter */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Category</h3>
                  <div className="flex flex-wrap gap-2">
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
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "border hover:bg-[var(--surface-subtle)]"
                          }`}
                          style={{
                            borderColor: isSelected ? undefined : "var(--border)",
                            color: isSelected ? undefined : "var(--text)",
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Context Tags filter */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Context Tags</h3>
                  <div className="flex flex-wrap gap-2">
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
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "border hover:bg-[var(--surface-subtle)]"
                          }`}
                          style={{
                            borderColor: isSelected ? undefined : "var(--border)",
                            color: isSelected ? undefined : "var(--text)",
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount Range filter */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Amount Range</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Min</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                        <input
                          type="number"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Max</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                        <input
                          type="number"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          placeholder="Any"
                          className="w-full rounded-lg border pl-7 pr-3 py-2 text-sm"
                          style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Method/Account filter - data-driven from user's entries */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Method / Account</h3>
                  {methodOptions.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      No methods found in your entries
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
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
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              isSelected
                                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                                : "border hover:bg-[var(--surface-subtle)]"
                            }`}
                            style={{
                              borderColor: isSelected ? undefined : "var(--border)",
                              color: isSelected ? undefined : "var(--text)",
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
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Sort by</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "newest", label: "Newest" },
                      { key: "oldest", label: "Oldest" },
                      { key: "highest", label: "Highest" },
                      { key: "lowest", label: "Lowest" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setSortBy(opt.key as any)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          sortBy === opt.key
                            ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
                            : "hover:bg-[var(--surface-subtle)]"
                        }`}
                        style={{
                          border: `1px solid ${sortBy === opt.key ? "var(--accent)" : "var(--border)"}`,
                          color: sortBy === opt.key ? "var(--accent)" : "var(--text)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Apply button */}
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="w-full rounded-lg py-3 text-sm font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
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
                    className="w-full text-center text-meta font-medium py-2 mt-2"
                    style={{ color: "var(--text-secondary)" }}
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
