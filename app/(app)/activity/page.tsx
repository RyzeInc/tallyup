"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
const {
  ArrowDownLeft,
  ArrowUpRight,
  CheckSquare,
  LayoutList,
  Loader2,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} = Lucide;
import ActivityTable from "@/components/activity/ActivityTable";
import ActivityFiltersPanel, {
  fieldClass,
} from "@/components/activity/ActivityFilters";
import EditEntryModal from "@/components/EditEntryModal";
import RecurringModal from "@/components/RecurringModal";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useTimeRange } from "@/components/TimeRangeProvider";
import EmptyState from "@/components/ui/EmptyState";
import {
  ActivityFilters,
  emptyFilters,
  filterActivityEntries,
  readActivityFilters,
  writeActivityFilters,
} from "@/lib/activity/filters";

type EditableEntry = Doc<"entries"> & { type: "income" | "expense" };
type ViewMode = "cards" | "table" | "extended";
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const chipClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors";
const chipStyle = (active: boolean) => ({
  borderColor: active ? "var(--primary)" : "var(--border)",
  backgroundColor: active ? "var(--accent-subtle)" : "transparent",
  color: active ? "var(--primary)" : "var(--text-secondary)",
});

export default function ActivityPage() {
  const { isAuthenticated } = useConvexAuth();
  const params = useSearchParams();
  const filters = useMemo(
    () => readActivityFilters(new URLSearchParams(params.toString())),
    [params],
  );
  const { startDate, endDate, label } = useTimeRange();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [patternEntry, setPatternEntry] = useState<EditableEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tallyup.activityViewMode");
      if (saved === "cards" || saved === "table" || saved === "extended") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore browser-only preference after hydration
        setViewMode(saved);
      }
    } catch {
      /* Storage is optional. */
    }
  }, []);
  useEffect(() => {
    if (params.get("focus") === "search") searchRef.current?.focus();
  }, [params]);

  function updateFilters(patch: Partial<ActivityFilters>) {
    // Read the current URL so rapid changes and edit navigation cannot overwrite each other.
    const current = new URLSearchParams(window.location.search);
    const next = writeActivityFilters(current, {
      ...readActivityFilters(current),
      ...patch,
    });
    window.history.replaceState(
      null,
      "",
      next.size ? `/activity?${next}` : "/activity",
    );
  }

  const accounts = useQuery(
    api.accounts.listAccounts,
    isAuthenticated ? { includeArchived: true } : "skip",
  );
  const categories = useQuery(
    api.categories.listCategories,
    isAuthenticated ? { includeArchived: true } : "skip",
  );
  const { results, status, loadMore } = usePaginatedQuery(
    api.entries.listActivityEntries,
    isAuthenticated ? { startDate, endDate } : "skip",
    { initialNumItems: 250 },
  );
  // Load the entire selected period before reporting complete matches or totals.
  // Native pagination keeps every loaded page subscribed, including after edits.
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(250);
  }, [status, loadMore]);
  const loading = status !== "Exhausted" || !accounts || !categories;
  const entries = useMemo(
    () =>
      filterActivityEntries(results, filters, categories ?? [], accounts ?? []),
    [results, filters, categories, accounts],
  );
  const reviewCount = results.filter((entry) => entry.needsReview).length;
  const totals = useMemo(
    () =>
      entries.reduce(
        (sum, entry) => {
          // Amounts of matching activity, including pending and excluded entries.
          // Transfers remain visible but are not labeled as spending or income.
          if (entry.type === "expense")
            sum.spent += Math.abs(entry.amountCents);
          if (entry.type === "income")
            sum.received += Math.abs(entry.amountCents);
          return sum;
        },
        { spent: 0, received: 0 },
      ),
    [entries],
  );
  const resultKey = `${startDate}:${endDate}:${JSON.stringify(filters)}`;
  const [display, setDisplay] = useState({ key: resultKey, count: 60 });
  const displayCount = display.key === resultKey ? display.count : 60;

  const editId = params.get("edit");
  const editEntry = useQuery(
    api.entries.getActivityEntry,
    isAuthenticated && editId ? { id: editId } : "skip",
  );
  function closeEdit() {
    const next = new URLSearchParams(window.location.search);
    next.delete("edit");
    window.history.replaceState(
      null,
      "",
      next.size ? `/activity?${next}` : "/activity",
    );
  }
  const deleteEntry = useMutation(api.entries.deleteEntry);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  for (const [key, values] of [
    ["categories", filters.categories],
    ["accounts", filters.accounts],
    ["tags", filters.tags],
    ["methods", filters.methods],
  ] as const) {
    for (const value of values) {
      const account = accounts?.find((account) => account._id === value);
      const category = categories?.find((category) => category._id === value);
      const chipLabel =
        value === "__unlinked__"
          ? "No account assigned"
          : value === "__unspecified__"
            ? "No payment method"
            : value === "__uncategorized__"
              ? "Uncategorized"
              : key === "accounts"
                ? `${account?.name ?? "Account"}${account?.last4 ? ` ••${account.last4}` : ""}`
                : key === "categories"
                  ? (category?.name ?? value)
                  : value;
      chips.push({
        key: `${key}:${value}`,
        label: chipLabel,
        remove: () =>
          updateFilters({ [key]: values.filter((item) => item !== value) }),
      });
    }
  }
  if (filters.min || filters.max)
    chips.push({
      key: "amount",
      label: `$${filters.min || "0"} – ${filters.max ? `$${filters.max}` : "Any"}`,
      remove: () => updateFilters({ min: "", max: "" }),
    });
  const activeCount = chips.length;
  const hasFilters =
    activeCount > 0 || filters.type !== "all" || filters.review || !!filters.q;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 text-[var(--text)]">
      <SignedOut>
        <EmptyState
          title="Your activity, in one place"
          subtitle="Sign in to view your transactions."
          action={
            <SignInButton mode="modal">
              <button className="btn-primary">Sign in</button>
            </SignInButton>
          }
        />
      </SignedOut>
      <SignedIn>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Activity</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Find any transaction. See the whole picture.
            </p>
          </div>
          <GlobalDateRangePicker showAllPresets />
        </header>
        <div className="relative shrink-0">
          <Search
            aria-hidden
            className="absolute left-3 top-3 h-5 w-5 text-[var(--text-secondary)]"
          />
          <input
            ref={searchRef}
            aria-label="Search transactions"
            className={`${fieldClass} pl-10 pr-11`}
            placeholder="Search merchant, title, account, or note…"
            value={filters.q}
            onChange={(event) => updateFilters({ q: event.target.value })}
          />
          {filters.q && (
            <button
              aria-label="Clear search"
              className="absolute right-1 top-1 rounded-lg p-2"
              onClick={() => updateFilters({ q: "" })}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {(["all", "expense", "income"] as const).map((type) => (
            <button
              key={type}
              aria-pressed={filters.type === type}
              className={chipClass}
              style={chipStyle(filters.type === type)}
              onClick={() => updateFilters({ type })}
            >
              {type === "expense" ? (
                <ArrowUpRight aria-hidden className="h-4 w-4" />
              ) : type === "income" ? (
                <ArrowDownLeft aria-hidden className="h-4 w-4" />
              ) : null}
              {type === "expense"
                ? "Spent"
                : type === "income"
                  ? "Received"
                  : "All"}
            </button>
          ))}
          <button
            aria-pressed={filters.review}
            className={chipClass}
            style={chipStyle(filters.review)}
            onClick={() => updateFilters({ review: !filters.review })}
          >
            Needs review{!loading && reviewCount > 0 ? ` (${reviewCount})` : ""}
          </button>
          <button
            className={chipClass}
            style={chipStyle(activeCount > 0)}
            aria-haspopup="dialog"
            disabled={!accounts || !categories}
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal aria-hidden className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="font-semibold">{activeCount}</span>
            )}
          </button>
          <div className="flex flex-1 items-center justify-end gap-2">
            <select
              aria-label="Sort transactions"
              className="min-h-10 max-w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
              value={filters.sort}
              onChange={(event) =>
                updateFilters({
                  sort: event.target.value as ActivityFilters["sort"],
                })
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
            <button
              aria-label={`Change view, currently ${viewMode}`}
              title={`View: ${viewMode}`}
              className="rounded-lg border border-[var(--border)] p-2.5"
              onClick={() => {
                const next =
                  viewMode === "cards"
                    ? "table"
                    : viewMode === "table"
                      ? "extended"
                      : "cards";
                setViewMode(next);
                try {
                  localStorage.setItem("tallyup.activityViewMode", next);
                } catch {
                  /* Storage is optional. */
                }
              }}
            >
              {viewMode === "cards" ? (
                <LayoutList className="h-4 w-4" />
              ) : (
                <Table2 className="h-4 w-4" />
              )}
            </button>
            <button
              aria-label="Select transactions"
              aria-pressed={selectMode}
              className="rounded-lg border p-2.5"
              style={chipStyle(selectMode)}
              onClick={() => setSelectMode(!selectMode)}
            >
              <CheckSquare className="h-4 w-4" />
            </button>
          </div>
        </div>
        {hasFilters && (
          <div
            className="flex max-h-24 shrink-0 flex-wrap items-center gap-2 overflow-y-auto"
            aria-label="Active filters"
          >
            {chips.map((chip) => (
              <button
                key={chip.key}
                aria-label={`Remove ${chip.label} filter`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-subtle)] px-3 py-1.5 text-xs"
                onClick={chip.remove}
              >
                {chip.label}
                <X aria-hidden className="h-3 w-3" />
              </button>
            ))}
            <button
              className="px-2 py-1.5 text-xs underline"
              onClick={() => updateFilters(emptyFilters)}
            >
              Clear all filters
            </button>
          </div>
        )}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-secondary)]"
          role="status"
          aria-live="polite"
        >
          <span>
            {loading
              ? "Loading the full date range…"
              : `${entries.length.toLocaleString()} transaction${entries.length === 1 ? "" : "s"}`}{" "}
            · {label}
          </span>
          {!loading && (
            <span title="Amounts of matching transactions, including pending and excluded entries. Transfers are not counted here.">
              Matching activity: spent{" "}
              <strong className="text-[var(--text)]">
                {money.format(totals.spent / 100)}
              </strong>{" "}
              · received{" "}
              <strong className="text-[var(--text)]">
                {money.format(totals.received / 100)}
              </strong>
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] p-12 text-sm text-[var(--text-secondary)]">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              Loading transactions
              {results.length
                ? ` (${results.length.toLocaleString()} so far)`
                : ""}
              …
            </div>
          ) : !entries.length ? (
            <EmptyState
              title={
                hasFilters
                  ? "No matching transactions"
                  : "No activity in this period"
              }
              subtitle={
                hasFilters
                  ? "Try removing a filter or choosing a different date range."
                  : "Choose another date range or log your first transaction."
              }
              action={
                hasFilters ? (
                  <button
                    className="btn-primary"
                    onClick={() => updateFilters(emptyFilters)}
                  >
                    Clear all filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ActivityTable
              key={resultKey}
              entries={entries}
              displayLimit={displayCount}
              viewMode={viewMode}
              typeFilter={filters.type}
              onDelete={(id) => deleteEntry({ id })}
              onSavePattern={(entry) => {
                if (entry.type !== "transfer")
                  setPatternEntry(entry as EditableEntry);
              }}
              externalSelectMode={selectMode}
              onSelectModeChange={setSelectMode}
              hasMore={displayCount < entries.length}
              onLoadMore={() =>
                setDisplay({ key: resultKey, count: displayCount + 60 })
              }
            />
          )}
        </div>
        {patternEntry && (
          <RecurringModal
            entry={patternEntry}
            onClose={() => setPatternEntry(null)}
            onCreated={() => setPatternEntry(null)}
          />
        )}
        {editEntry && editEntry.type !== "transfer" && (
          <EditEntryModal
            key={editEntry._id}
            entry={editEntry as EditableEntry}
            onClose={closeEdit}
            onSaved={closeEdit}
            onDeleted={closeEdit}
          />
        )}
        {editId && (editEntry === null || editEntry?.type === "transfer") && (
          <div
            role="status"
            className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 text-sm"
          >
            <span>
              {editEntry?.type === "transfer"
                ? "Manage this transaction in Transfers."
                : "This transaction is no longer available."}
            </span>
            <button className="underline" onClick={closeEdit}>
              Dismiss
            </button>
          </div>
        )}
        {filtersOpen && (
          <ActivityFiltersPanel
            filters={filters}
            entries={results}
            accounts={accounts ?? []}
            categories={categories ?? []}
            loading={loading}
            onClose={() => setFiltersOpen(false)}
            onApply={(next) => {
              updateFilters(next);
              setFiltersOpen(false);
            }}
          />
        )}
      </SignedIn>
    </div>
  );
}
