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
import { EntryType, CONTEXT_TAGS, getCategoryDisplayName } from "@/components/utils";
import { useRouter, useSearchParams } from "next/navigation";
import type { Doc, Id } from "convex/_generated/dataModel";

type EntryDoc = Doc<"entries">;
type PlaidTransaction = Doc<"plaidTransactions">;
type EditableEntry = EntryDoc & { type: "expense" | "income" };
type EntriesPage = { rows: EntryDoc[]; nextCursor?: number };
type SortBy = "newest" | "oldest" | "highest" | "lowest";
type ViewMode = "cards" | "table" | "extended" | "plaid";

function isEditableEntry(entry: EntryDoc): entry is EditableEntry {
  return entry.type === "expense" || entry.type === "income";
}

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Ref for measuring filter chip space
  const spacerRef = useRef<HTMLDivElement>(null);
  const [chipsInline, setChipsInline] = useState(false);

  const { startDate, endDate } = useTimeRange();

  const initialType = (() => {
    const raw = searchParams.get("type");
    return raw === "income" || raw === "expense" ? raw : "all";
  })();
  const [type, setType] = useState<"all" | EntryType>(initialType);
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [reviewOnly, setReviewOnly] = useState(() => searchParams.get("review") === "1");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Selection mode - controlled from here, passed to ActivityTable
  const [selectMode, setSelectMode] = useState(false);
  
  // View mode - "cards" (default), "table" (compact), "extended" (full columns), or "plaid" (raw Plaid transactions)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tallyup.activityViewMode") as ViewMode) || "cards";
    }
    return "cards";
  });
  
  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem("tallyup.activityViewMode", viewMode);
    } catch {}
  }, [viewMode]);
  
  // Cycle through view modes: cards -> table -> extended -> plaid -> cards
  const cycleViewMode = () => {
    if (viewMode === "cards") setViewMode("table");
    else if (viewMode === "table") setViewMode("extended");
    else if (viewMode === "extended") setViewMode("plaid");
    else setViewMode("cards");
  };

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
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as EntryDoc[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  // Convert timestamps to YYYY-MM-DD for Plaid query
  const startDateStr = useMemo(() => {
    const d = new Date(startDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [startDate]);
  const endDateStr = useMemo(() => {
    const d = new Date(endDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [endDate]);

  // Get raw Plaid transactions when in plaid view mode
  const plaidTransactions = useQuery(
    api.plaid.listAllPlaidTransactions,
    viewMode === "plaid" ? { limit: 100, startDate: startDateStr, endDate: endDateStr } : "skip"
  ) as PlaidTransaction[] | undefined;
  
  // Check if user has linked Plaid accounts
  const plaidAccounts = useQuery(
    api.plaid.listPlaidAccounts,
    viewMode === "plaid" ? {} : "skip"
  );
  const hasLinkedAccounts = plaidAccounts && plaidAccounts.length > 0;

  // Get user's accounts for filtering
  const accounts = useQuery(api.accounts.listAccounts, {}) as Doc<"accounts">[] | undefined;
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});
  const expenseCategories = useQuery(api.categories.listCategories, { categoryType: "expense" }) as
    | { _id: string; name: string }[]
    | undefined;
  const incomeCategories = useQuery(api.categories.listCategories, { categoryType: "income" }) as
    | { _id: string; name: string }[]
    | undefined;

  // Focus search on mount if requested
  useEffect(() => {
    if (searchParams.get("focus") === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchParams]);

  // Sync URL params to state when URL changes (for drill-down navigation)
  // We compare only the filter-related params, ignoring edit param
  const getFilterParams = (sp: URLSearchParams) => {
    const p = new URLSearchParams();
    const t = sp.get("type"); if (t) p.set("type", t);
    const c = sp.get("category"); if (c) p.set("category", c);
    const tag = sp.get("tag"); if (tag) p.set("tag", tag);
    const qp = sp.get("q"); if (qp) p.set("q", qp);
    const r = sp.get("review"); if (r) p.set("review", r);
    return p.toString();
  };
  const prevFilterParams = useRef(getFilterParams(searchParams));
  /* eslint-disable react-hooks/set-state-in-effect -- intentional sync from URL params */
  useEffect(() => {
    const currentFilterParams = getFilterParams(searchParams);
    // Only sync state if filter params actually changed (ignore edit param changes)
    if (currentFilterParams !== prevFilterParams.current) {
      prevFilterParams.current = currentFilterParams;
      
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
  /* eslint-enable react-hooks/set-state-in-effect */

  // Track if this is initial mount to avoid URL sync loops
  const isInitialMount = useRef(true);
  // Initialize lastUrlUpdate to the current URL so we don't trigger a replace on mount
  const lastUrlUpdate = useRef<string>(
    (() => {
      const p = new URLSearchParams();
      const t = searchParams.get("type");
      if (t === "income" || t === "expense") p.set("type", t);
      const qVal = searchParams.get("q");
      if (qVal) p.set("q", qVal);
      if (searchParams.get("review") === "1") p.set("review", "1");
      const cat = searchParams.get("category");
      if (cat) p.set("category", cat);
      const tag = searchParams.get("tag");
      if (tag) p.set("tag", tag);
      const qs = p.toString();
      return qs ? `/activity?${qs}` : `/activity`;
    })()
  );

  // Update URL when filters change (but not on initial mount or when reading from URL)
  // Skip entirely when edit modal is open to avoid URL thrashing
  useEffect(() => {
    // Skip on initial mount - state is already initialized from URL
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Skip URL updates while the edit modal is open to prevent thrashing
    const editParam = searchParams.get("edit");
    if (editParam) {
      return;
    }

    const p = new URLSearchParams();
    if (type && type !== "all") p.set("type", type);
    if (q) p.set("q", q);
    if (reviewOnly) p.set("review", "1");
    if (selectedCategories.length === 1) p.set("category", selectedCategories[0]);
    if (selectedTags.length === 1) p.set("tag", selectedTags[0]);
    
    const qs = p.toString();
    const url = qs ? `/activity?${qs}` : `/activity`;
    
    // Avoid updating if URL is the same (prevents loops)
    if (url !== lastUrlUpdate.current) {
      lastUrlUpdate.current = url;
      router.replace(url);
    }
  }, [type, q, selectedCategories, selectedTags, router, reviewOnly, searchParams]);

  const deleteEntry = useMutation(api.entries.deleteEntry);
  const deletePlaidTransaction = useMutation(api.plaid.deletePlaidTransaction);
  const deletePlaidTransactionsBulk = useMutation(api.plaid.deletePlaidTransactionsBulk);
  
  // Selection state for Plaid transactions
  const [selectedPlaidIds, setSelectedPlaidIds] = useState<Set<string>>(new Set());
  const [plaidSelectMode, setPlaidSelectMode] = useState(false);

  // paginated entries: cursor-based pages from server
  const [pages, setPages] = useState<EntryDoc[][]>([]);
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
  }) as EntriesPage | undefined;

  // Use refs to track state and avoid stale closure issues in effects
  const seenIdsRef = useRef<Record<string, boolean>>({});
  const cursorListRef = useRef<Array<number | undefined>>([undefined]);
  const pagesRef = useRef<EntryDoc[][]>([]);

  // when filters change, reset pages
  /* eslint-disable react-hooks/set-state-in-effect -- intentional pagination reset */
  useEffect(() => {
    setPages([]);
    setNextCursor(undefined);
    setCursorList([undefined]);
    setSeenIds({});
    // Also reset refs immediately for the next pageResult effect
    seenIdsRef.current = {};
    cursorListRef.current = [undefined];
    pagesRef.current = [];
  }, [type, startDate, endDate, selectedCategories, selectedTags, reviewOnly, q]);
  /* eslint-enable react-hooks/set-state-in-effect */
  
  // Keep refs in sync with state
  useEffect(() => {
    seenIdsRef.current = seenIds;
  }, [seenIds]);
  
  useEffect(() => {
    cursorListRef.current = cursorList;
  }, [cursorList]);
  
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // append page result when it arrives
  /* eslint-disable react-hooks/set-state-in-effect -- intentional sync from Convex query */
  useEffect(() => {
    if (!pageResult?.rows) return;
    
    // Use refs for latest values to avoid stale closure
    const currentSeenIds = seenIdsRef.current;
    const currentCursorList = cursorListRef.current;
    const currentPages = pagesRef.current;
    
    const newRows: EntryDoc[] = [];
    const seen = { ...currentSeenIds };
    
    for (const r of pageResult.rows) {
      if (!seen[r._id]) {
        newRows.push(r);
        seen[r._id] = true;
      }
    }
    
    if (newRows.length) {
      // Check if this is a real-time update (new entries at the front)
      // vs a pagination load (new entries at the end)
      const isFirstPage = currentCursorList.length === 1 && currentCursorList[0] === undefined;
      
      if (isFirstPage && currentPages.length > 0) {
        // Real-time update: merge new entries into the first page
        // This handles the case where a new entry was added to the database
        setPages((p) => {
          const existingFirstPage = p[0] || [];
          const combined = [...newRows, ...existingFirstPage];
          // Deduplicate by ID (in case of race conditions)
          const deduped: EntryDoc[] = [];
          const ids = new Set<string>();
          for (const row of combined) {
            if (!ids.has(row._id)) {
              ids.add(row._id);
              deduped.push(row);
            }
          }
          return [deduped, ...p.slice(1)];
        });
      } else {
        // Normal pagination: append as a new page
        setPages((p) => [...p, newRows]);
      }
    }
    
    setSeenIds(seen);
    setNextCursor(pageResult.nextCursor);
  }, [pageResult]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    
    // Apply method/account filter (legacy methodOrAccount string)
    if (selectedMethods.length > 0) {
      entries = entries.filter((e) => {
        const method = e.methodOrAccount ?? "";
        return selectedMethods.some((m) => {
          if (m === "__unspecified__") return !e.methodOrAccount || e.methodOrAccount.trim() === "";
          return method.toLowerCase() === m.toLowerCase();
        });
      });
    }

    // Apply account filter (linked accounts)
    if (selectedAccountIds.length > 0) {
      entries = entries.filter((e) => {
        // Check if entry has a linked accountId that matches selection
        if (e.accountId && selectedAccountIds.includes(e.accountId)) return true;
        // Also check for "unlinked" filter option
        if (selectedAccountIds.includes("__unlinked__") && !e.accountId) return true;
        return false;
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
  }, [pages, sortBy, minAmount, maxAmount, selectedMethods, selectedAccountIds]);

  const [selected, setSelected] = useState<EditableEntry | null>(null);

  // Edit modal state - triggered by ?edit=id query param
  const editId = searchParams.get("edit");
  const [editEntry, setEditEntry] = useState<EditableEntry | null>(null);
  // Track when we're intentionally closing to prevent race condition reopening
  const isClosingModal = useRef(false);

  // Load entry for editing when editId changes
  /* eslint-disable react-hooks/set-state-in-effect -- intentional sync from URL edit param */
  useEffect(() => {
    // Don't reopen if we're in the process of closing
    if (isClosingModal.current) {
      return;
    }
    if (editId && allEntries.length > 0) {
      const entry = allEntries.find((e) => e._id === editId);
      if (entry && isEditableEntry(entry)) {
        setEditEntry(entry);
      } else if (entry) {
        setEditEntry(null);
      }
    } else if (!editId) {
      setEditEntry(null);
    }
  }, [editId, allEntries]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close edit modal and clear URL param
  function closeEditModal() {
    isClosingModal.current = true;
    setEditEntry(null);
    // Remove edit param from URL
    const p = new URLSearchParams(searchParams.toString());
    p.delete("edit");
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
    // Reset the closing flag after URL update settles
    setTimeout(() => {
      isClosingModal.current = false;
    }, 100);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setCursorList((c) => [...c, nextCursor]);
  }

  const allCategories = useMemo(() => {
    const expense = (expenseCategories ?? []) as { _id: string; name: string }[];
    const income = (incomeCategories ?? []) as { _id: string; name: string }[];
    return [...expense, ...income];
  }, [expenseCategories, incomeCategories]);

  const categoryLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of allCategories) {
      map.set(cat._id, cat.name);
    }
    return map;
  }, [allCategories]);

  // Count active filters
  const activeFilterCount = selectedCategories.length + selectedTags.length + selectedMethods.length + selectedAccountIds.length + (minAmount ? 1 : 0) + (maxAmount ? 1 : 0);

  // Estimate total width needed for all filter chips (rough calculation)
  const estimatedChipsWidth = useMemo(() => {
    // Each chip is roughly: padding (24px) + text (~8px per char) + X icon (12px) + gap (8px)
    let width = 0;
    selectedCategories.forEach((cat) => {
      const label = categoryLabelLookup.get(cat) ?? getCategoryDisplayName(cat, allCategories);
      width += 24 + label.length * 7 + 12 + 8;
    });
    selectedTags.forEach((tag) => { width += 24 + tag.length * 7 + 12 + 8; });
    selectedMethods.forEach((m) => { width += 24 + (m === "__unspecified__" ? 11 : m.length) * 7 + 12 + 8; });
    selectedAccountIds.forEach(() => { width += 24 + 10 * 7 + 12 + 8; }); // ~10 chars avg
    if (minAmount || maxAmount) width += 24 + 12 * 7 + 8; // amount range
    if (activeFilterCount > 0) width += 60; // "Clear all" link
    return width;
  }, [selectedCategories, selectedTags, selectedMethods, selectedAccountIds, minAmount, maxAmount, activeFilterCount, categoryLabelLookup, allCategories]);

  // Measure spacer width and decide if chips fit inline
  /* eslint-disable react-hooks/set-state-in-effect -- intentional layout measurement sync */
  useEffect(() => {
    if (!spacerRef.current || activeFilterCount === 0) {
      setChipsInline(false);
      return;
    }

    const checkFit = () => {
      if (!spacerRef.current) return;
      const spacerWidth = spacerRef.current.offsetWidth;
      // Add some margin (40px) to ensure comfortable fit
      setChipsInline(spacerWidth > estimatedChipsWidth + 40);
    };

    checkFit();

    const observer = new ResizeObserver(checkFit);
    observer.observe(spacerRef.current);
    
    return () => observer.disconnect();
  }, [estimatedChipsWidth, activeFilterCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
  function clearAccountId(id: string) {
    setSelectedAccountIds((prev) => prev.filter((x) => x !== id));
  }
  function clearAllFilters() {
    setSelectedCategories([]);
    setSelectedTags([]);
    setSelectedMethods([]);
    setSelectedAccountIds([]);
    setMinAmount("");
    setMaxAmount("");
  }

  function toggleReview() {
    const newReviewOnly = !reviewOnly;
    setReviewOnly(newReviewOnly);
    
    // Also update URL for bookmarkability
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (newReviewOnly) {
      p.set("review", "1");
    } else {
      p.delete("review");
    }
    if (typeof window !== "undefined") {
      const qs = p.toString();
      const url = qs ? `/activity?${qs}` : `/activity`;
      window.history.replaceState({ ...window.history.state }, "", url);
    }
  }

  // Category options based on type
  const categoryOptions = useMemo(() => {
    const hiddenExpense = new Set((userPrefs?.hiddenExpenseCategories ?? []).map((c) => c.toLowerCase()));
    const hiddenIncome = new Set((userPrefs?.hiddenIncomeCategories ?? []).map((c) => c.toLowerCase()));
    const expense = ((expenseCategories ?? []) as { _id: string; name: string }[]).filter(
      (c) => !hiddenExpense.has(c.name.toLowerCase())
    );
    const income = ((incomeCategories ?? []) as { _id: string; name: string }[]).filter(
      (c) => !hiddenIncome.has(c.name.toLowerCase())
    );
    if (type === "income") return income;
    if (type === "expense") return expense;
    return [...income, ...expense];
  }, [type, expenseCategories, incomeCategories, userPrefs?.hiddenExpenseCategories, userPrefs?.hiddenIncomeCategories]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", minHeight: 0 }}>
      {/* Date picker - full width to match table */}
      <div className="flex items-center justify-end" style={{ marginBottom: "var(--space-4)", flexShrink: 0, padding: "var(--space-4)" }}>
        <GlobalDateRangePicker showAllPresets />
      </div>

      <SignedOut>
        <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", width: "100%" }}>
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
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Narrow content wrapper for search only */}
        <div style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", width: "100%", flexShrink: 0 }}>
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
              flexShrink: 0,
              margin: "var(--space-4)",
            }}
          >
          <Lucide.Search className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search transactions…"
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
        </div>
        </div>
        {/* End narrow wrapper - filters and table at full width */}

        {/* Compact Filter Row - full width */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)", marginBottom: "var(--space-2)" }}>
          {/* Type chips - Spent/Received only, tapping selected deselects back to all */}
          {(["expense", "income"] as const).map((t) => {
            const isActive = type === t;
            const label = t === "expense" ? "Spent" : "Received";
            const Icon = t === "expense" ? Lucide.ArrowUpRight : Lucide.ArrowDownLeft;
            return (
              <button
                key={t}
                onClick={() => setType(isActive ? "all" : t)}
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
                  backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text)",
                  border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}

          {/* Review filter */}
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
            Review
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

          {/* Spacer - contains inline filter chips when they fit */}
          <div ref={spacerRef} style={{ flex: 1, minWidth: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            {chipsInline && activeFilterCount > 0 && (
              <>
                {selectedCategories.map((cat) => {
                  const label = categoryLabelLookup.get(cat) ?? getCategoryDisplayName(cat, allCategories);
                  return (
                    <button
                      key={cat}
                      onClick={() => clearCategory(cat)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--text-micro)",
                        fontWeight: 500,
                        cursor: "pointer",
                        backgroundColor: "var(--accent-subtle)",
                        color: "var(--primary)",
                        border: "none",
                      }}
                    >
                      {label}
                      <Lucide.X className="h-3 w-3" />
                    </button>
                  );
                })}
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => clearTag(tag)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
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
                      gap: "4px",
                      padding: "4px 10px",
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
                {selectedAccountIds.map((id) => {
                  const acc = accounts?.find((a) => a._id === id);
                  const label = id === "__unlinked__" ? "No Account" : (acc?.name ?? id);
                  return (
                    <button
                      key={id}
                      onClick={() => clearAccountId(id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--text-micro)",
                        fontWeight: 500,
                        cursor: "pointer",
                        backgroundColor: "var(--surface-2)",
                        color: "var(--text)",
                        border: "none",
                      }}
                    >
                      {label}
                      <Lucide.X className="h-3 w-3" />
                    </button>
                  );
                })}
                {(minAmount || maxAmount) && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 10px",
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
              </>
            )}
          </div>

          {/* View toggle - cards vs table vs extended vs plaid */}
          <button
            onClick={cycleViewMode}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--text-meta)",
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: viewMode === "plaid" ? "var(--accent-subtle)" : "transparent",
              color: viewMode === "plaid" ? "var(--primary)" : "var(--text)",
              border: "1px solid var(--border)",
            }}
            title={
              viewMode === "cards" ? "Switch to table view" : 
              viewMode === "table" ? "Switch to extended view" : 
              viewMode === "extended" ? "Switch to Plaid raw view" :
              "Switch to card view"
            }
          >
            {viewMode === "cards" ? (
              <Lucide.LayoutList className="h-4 w-4" />
            ) : viewMode === "table" ? (
              <Lucide.Table className="h-4 w-4" />
            ) : viewMode === "extended" ? (
              <Lucide.LayoutGrid className="h-4 w-4" />
            ) : (
              <Lucide.Database className="h-4 w-4" />
            )}
          </button>

          {/* Select button - inline with Filters */}
          <button
            onClick={() => setSelectMode(!selectMode)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--text-meta)",
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: selectMode ? "var(--accent-subtle)" : "transparent",
              color: selectMode ? "var(--primary)" : "var(--text)",
              border: selectMode ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >
            <Lucide.CheckSquare className="h-4 w-4" />
            Select
          </button>

          {/* Filters button */}
          <button
            onClick={() => setFiltersOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--text-meta)",
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor: activeFilterCount > 0 ? "var(--accent-subtle)" : "transparent",
              color: activeFilterCount > 0 ? "var(--primary)" : "var(--text)",
              border: activeFilterCount > 0 ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >
            <Lucide.SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "10px",
                  fontWeight: 700,
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter pills - separate row when they don't fit inline */}
        {activeFilterCount > 0 && !chipsInline && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", padding: "0 var(--space-4)", marginBottom: "var(--space-2)" }}>
            {selectedCategories.map((cat) => {
              const label = categoryLabelLookup.get(cat) ?? getCategoryDisplayName(cat, allCategories);
              return (
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
                  {label}
                  <Lucide.X className="h-3 w-3" />
                </button>
              );
            })}
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
            {selectedAccountIds.map((id) => {
              const acc = accounts?.find((a) => a._id === id);
              const label = id === "__unlinked__" ? "No Account" : (acc?.name ?? id);
              return (
                <button
                  key={id}
                  onClick={() => clearAccountId(id)}
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
                  {label}
                  <Lucide.X className="h-3 w-3" />
                </button>
              );
            })}
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

        {/* Results - can expand to full width (1400px) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flex: 1, minHeight: 0, overflow: "hidden", padding: "0 var(--space-4) var(--space-4) var(--space-4)" }}>
        
        {/* Plaid Raw Transactions View */}
        {viewMode === "plaid" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", overflow: "auto" }}>
            {/* Header explaining this view */}
            <div
              style={{
                backgroundColor: "var(--accent-subtle)",
                borderRadius: "var(--card-radius)",
                border: "1px solid var(--primary)",
                padding: "var(--space-4)",
                marginBottom: "var(--space-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <Lucide.Database className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text)" }}>Raw Plaid Transactions</h3>
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
                This view shows raw transaction data from Plaid before it&apos;s imported into TallyUp. 
                Use this to debug sync issues or see exactly what your bank sends.
              </p>
            </div>
            
            {/* Status legend */}
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--warning)" }} />
                <span style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>Pending</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--success)" }} />
                <span style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>Imported</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--text-tertiary)" }} />
                <span style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>Skipped</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--destructive)" }} />
                <span style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>Duplicate</span>
              </div>
            </div>
            
            {!plaidTransactions ? (
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
                  <span style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}>Loading Plaid transactions…</span>
                </div>
              </div>
            ) : plaidTransactions.length === 0 ? (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  borderRadius: "var(--card-radius)",
                  border: "1px solid var(--border)",
                  padding: "var(--space-8)",
                  textAlign: "center",
                }}
              >
                {!hasLinkedAccounts ? (
                  <>
                    <Lucide.Link2 className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
                    <div style={{ fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--text)" }}>
                      No Linked Accounts
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
                      This view shows raw transaction data from bank accounts connected via Plaid. 
                      You&apos;re currently using manual entry mode.
                    </div>
                    <div style={{ 
                      padding: "var(--space-3)", 
                      borderRadius: "var(--card-radius)", 
                      backgroundColor: "var(--surface-2)",
                      textAlign: "left",
                    }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text)", marginBottom: "var(--space-2)" }}>
                        💡 Manual mode works great!
                      </div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        All TallyUp features work without linking accounts. Your manually entered transactions 
                        appear in the Cards, Table, and Extended views.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Lucide.Database className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
                    <div style={{ fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--text)" }}>
                      No transactions in this date range
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      Try expanding your date range or syncing your accounts to fetch recent transactions.
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {/* Action bar for Plaid transactions */}
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  marginBottom: "var(--space-1)",
                }}>
                  <div style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}>
                    {plaidSelectMode && selectedPlaidIds.size > 0 
                      ? `${selectedPlaidIds.size} selected`
                      : `Showing ${plaidTransactions.length} raw transactions`
                    }
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    {plaidSelectMode ? (
                      <>
                        <button
                          onClick={() => {
                            // Select all
                            if (selectedPlaidIds.size === plaidTransactions.length) {
                              setSelectedPlaidIds(new Set());
                            } else {
                              setSelectedPlaidIds(new Set(plaidTransactions.map(t => t._id)));
                            }
                          }}
                          style={{
                            padding: "4px 12px",
                            fontSize: "var(--text-sm)",
                            fontWeight: 500,
                            color: "var(--text-secondary)",
                            backgroundColor: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                          }}
                        >
                          {selectedPlaidIds.size === plaidTransactions.length ? "Deselect All" : "Select All"}
                        </button>
                        <button
                          onClick={async () => {
                            if (selectedPlaidIds.size === 0) return;
                            if (!confirm(`Delete ${selectedPlaidIds.size} raw Plaid transactions? This cannot be undone.`)) return;
                            try {
                              await deletePlaidTransactionsBulk({ 
                                ids: Array.from(selectedPlaidIds) as Id<"plaidTransactions">[]
                              });
                              setSelectedPlaidIds(new Set());
                              setPlaidSelectMode(false);
                            } catch (err) {
                              console.error("Failed to delete:", err);
                              alert("Failed to delete some transactions");
                            }
                          }}
                          disabled={selectedPlaidIds.size === 0}
                          style={{
                            padding: "4px 12px",
                            fontSize: "var(--text-sm)",
                            fontWeight: 500,
                            color: selectedPlaidIds.size > 0 ? "#fff" : "var(--text-tertiary)",
                            backgroundColor: selectedPlaidIds.size > 0 ? "var(--destructive)" : "var(--surface-2)",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            cursor: selectedPlaidIds.size > 0 ? "pointer" : "not-allowed",
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-1)",
                          }}
                        >
                          <Lucide.Trash2 size={14} />
                          Delete
                        </button>
                        <button
                          onClick={() => {
                            setPlaidSelectMode(false);
                            setSelectedPlaidIds(new Set());
                          }}
                          style={{
                            padding: "4px 12px",
                            fontSize: "var(--text-sm)",
                            fontWeight: 500,
                            color: "var(--text-secondary)",
                            backgroundColor: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setPlaidSelectMode(true)}
                        style={{
                          padding: "4px 12px",
                          fontSize: "var(--text-sm)",
                          fontWeight: 500,
                          color: "var(--text-secondary)",
                          backgroundColor: "transparent",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-1)",
                        }}
                      >
                        <Lucide.CheckSquare size={14} />
                        Select
                      </button>
                    )}
                  </div>
                </div>
                {plaidTransactions.map((tx) => {
                  const statusColor = 
                    tx.importStatus === "pending" ? "var(--warning)" :
                    tx.importStatus === "imported" ? "var(--success)" :
                    tx.importStatus === "duplicate" ? "var(--destructive)" :
                    "var(--text-tertiary)";
                  const isSelected = selectedPlaidIds.has(tx._id);
                  
                  return (
                    <div
                      key={tx._id}
                      onClick={() => {
                        if (plaidSelectMode) {
                          setSelectedPlaidIds(prev => {
                            const next = new Set(prev);
                            if (next.has(tx._id)) {
                              next.delete(tx._id);
                            } else {
                              next.add(tx._id);
                            }
                            return next;
                          });
                        }
                      }}
                      style={{
                        backgroundColor: isSelected ? "var(--accent-subtle)" : "var(--surface)",
                        borderRadius: "var(--card-radius)",
                        border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                        padding: "var(--space-3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                        cursor: plaidSelectMode ? "pointer" : "default",
                        transition: "all 0.15s ease-out",
                      }}
                    >
                      {/* Top row: checkbox (if select mode), name, amount, status, delete */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
                        {plaidSelectMode && (
                          <div style={{ paddingTop: 2 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ 
                                width: 18, 
                                height: 18, 
                                cursor: "pointer",
                                accentColor: "var(--primary)",
                              }}
                            />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--text)", marginBottom: 2 }}>
                            {tx.merchantName || tx.name || "Unknown"}
                          </div>
                          {tx.merchantName && tx.name && tx.merchantName !== tx.name && (
                            <div style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)" }}>
                              Original: {tx.name}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ 
                              fontWeight: 600, 
                              fontSize: "var(--text-base)", 
                              color: tx.amount < 0 ? "var(--income)" : "var(--expense)"
                            }}>
                              {tx.amount < 0 ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                            </div>
                            <div style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: 4, 
                              fontSize: "var(--text-micro)",
                              color: statusColor,
                              fontWeight: 500,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusColor }} />
                              {tx.importStatus}
                            </div>
                          </div>
                          {!plaidSelectMode && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm("Delete this raw Plaid transaction? This cannot be undone.")) return;
                                try {
                                  await deletePlaidTransaction({ id: tx._id });
                                } catch (err) {
                                  console.error("Failed to delete:", err);
                                  alert("Failed to delete transaction");
                                }
                              }}
                              style={{
                                padding: "4px",
                                backgroundColor: "transparent",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                color: "var(--text-tertiary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              title="Delete transaction"
                            >
                              <Lucide.Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Middle row: date, account */}
                      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        <span>{tx.date}</span>
                        {tx.isoCurrencyCode && <span>• {tx.isoCurrencyCode}</span>}
                      </div>
                      
                      {/* Categories from Plaid */}
                      {(tx.category || tx.categoryDetailed) && (
                        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                          {tx.category && (
                            <span
                              style={{
                                fontSize: "var(--text-micro)",
                                padding: "2px 8px",
                                borderRadius: "var(--radius-full)",
                                backgroundColor: "var(--surface-2)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {tx.category}
                            </span>
                          )}
                          {tx.categoryDetailed && tx.categoryDetailed !== tx.category && (
                            <span
                              style={{
                                fontSize: "var(--text-micro)",
                                padding: "2px 8px",
                                borderRadius: "var(--radius-full)",
                                backgroundColor: "var(--surface-2)",
                                color: "var(--text-tertiary)",
                              }}
                            >
                              {tx.categoryDetailed}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Plaid IDs and technical details - collapsible */}
                      <details style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)" }}>
                        <summary style={{ cursor: "pointer", userSelect: "none" }}>Technical Details</summary>
                        <div style={{ marginTop: "var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-1)", paddingLeft: "var(--space-2)" }}>
                          <div><strong>Plaid TX ID:</strong> {tx.plaidTransactionId}</div>
                          <div><strong>Payment Channel:</strong> {tx.paymentChannel || "N/A"}</div>
                          <div><strong>Pending:</strong> {tx.pending ? "Yes" : "No"}</div>
                          {tx.categoryConfidence && (
                            <div><strong>Category Confidence:</strong> {tx.categoryConfidence}</div>
                          )}
                          {tx.entryId && (
                            <div><strong>Linked Entry:</strong> {tx.entryId}</div>
                          )}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : pages.length === 0 && !pageResult ? (
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
          <ActivityTable
            entries={allEntries}
            viewMode={viewMode}
            typeFilter={type}
            onDelete={(id) => deleteEntry({ id })}
            onSavePattern={(e) => {
              if (isEditableEntry(e)) setSelected(e);
            }}
            onBulkComplete={() => {
              setPages([]);
              setCursorList([undefined]);
              setSeenIds({});
            }}
            externalSelectMode={selectMode}
            onSelectModeChange={setSelectMode}
            hasMore={!!nextCursor}
            onLoadMore={loadMore}
          />
        )}
        </div>

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
              // Refresh the list after a successful save (modal will be closed by the form)
              setPages([]);
              setCursorList([undefined]);
              setSeenIds({});
            }}
            onDeleted={() => {
              // Refresh the list after deletion (modal will be closed by the delete handler)
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

                {/* Category filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Category</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {categoryOptions.map((cat) => {
                      const isSelected =
                        selectedCategories.includes(cat._id) ||
                        selectedCategories.includes(cat.name);
                      return (
                        <button
                          key={cat._id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategories((prev) =>
                                prev.filter((c) => c !== cat._id && c !== cat.name)
                              );
                            } else {
                              setSelectedCategories((prev) => [...prev, cat._id]);
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
                          {cat.name}
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

                {/* Method/Account filter (legacy freeform text) */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Payment Method</h3>
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

                {/* Linked Accounts filter */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ fontSize: "var(--text-meta)", fontWeight: 500, marginBottom: "var(--space-2)", color: "var(--text)" }}>Account</h3>
                  {!accounts || accounts.length === 0 ? (
                    <p style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)" }}>
                      No accounts set up yet. Add accounts in the Accounts tab.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {/* Unlinked option */}
                      <button
                        onClick={() => {
                          if (selectedAccountIds.includes("__unlinked__")) {
                            setSelectedAccountIds((prev) => prev.filter((id) => id !== "__unlinked__"));
                          } else {
                            setSelectedAccountIds((prev) => [...prev, "__unlinked__"]);
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-full)",
                          fontSize: "var(--text-micro)",
                          fontWeight: 500,
                          cursor: "pointer",
                          backgroundColor: selectedAccountIds.includes("__unlinked__") ? "var(--primary)" : "transparent",
                          color: selectedAccountIds.includes("__unlinked__") ? "var(--primary-foreground)" : "var(--text)",
                          border: selectedAccountIds.includes("__unlinked__") ? "none" : "1px solid var(--border)",
                          fontStyle: "italic",
                        }}
                      >
                        No Account
                      </button>
                      {accounts.map((acc) => {
                        const isSelected = selectedAccountIds.includes(acc._id);
                        return (
                          <button
                            key={acc._id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAccountIds((prev) => prev.filter((id) => id !== acc._id));
                              } else {
                                setSelectedAccountIds((prev) => [...prev, acc._id]);
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
                            {acc.name}
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
                          onClick={() => setSortBy(opt.key as SortBy)}
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
        </div>
      </SignedIn>
    </div>
  );
}
