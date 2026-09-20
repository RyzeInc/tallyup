"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Lucide from "lucide-react";
const { ChevronDown, Search, X } = Lucide;
import type { Doc } from "convex/_generated/dataModel";
import {
  ActivityFilters as Filters,
  amountRangeError,
  emptyFilters,
  filterActivityEntries,
} from "@/lib/activity/filters";

type Option = { value: string; label: string; detail?: string };
export const fieldClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]";

function Section({
  title,
  summary,
  children,
  open = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="group border-b border-[var(--border)] py-1"
      open={open || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-medium">{title}</span>
        <span className="max-w-[55%] truncate text-sm text-[var(--text-secondary)]">
          {summary}
        </span>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

function Options({
  options,
  selected,
  onChange,
}: {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="max-h-60 space-y-1 overflow-y-auto overscroll-contain">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--surface-subtle)]"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value),
              )
            }
          />
          <span className="min-w-0 text-sm">
            <span className="block">{option.label}</span>
            {option.detail && (
              <span className="block text-xs text-[var(--text-secondary)]">
                {option.detail}
              </span>
            )}
          </span>
        </label>
      ))}
      {!options.length && (
        <p className="py-3 text-sm text-[var(--text-secondary)]">
          No matching options.
        </p>
      )}
    </div>
  );
}

export default function ActivityFilters({
  filters,
  entries,
  accounts,
  categories,
  loading,
  onApply,
  onClose,
}: {
  filters: Filters;
  entries: Doc<"entries">[];
  accounts: Doc<"accounts">[];
  categories: Doc<"categories">[];
  loading: boolean;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => ({
    ...filters,
    categories: [
      ...new Set(
        filters.categories.flatMap((value) => {
          const matches = categories.filter(
            (category) =>
              category._id === value ||
              ((filters.type === "all" ||
                category.categoryType === filters.type) &&
                [category.name, category.slug].some(
                  (label) => label?.toLowerCase() === value.toLowerCase(),
                )),
          );
          return matches.length
            ? matches.map((category) => String(category._id))
            : [value];
        }),
      ),
    ],
  }));
  const [categorySearch, setCategorySearch] = useState("");
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    node?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const update = (patch: Partial<Filters>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const selectedSummary = (values: string[], fallback: string) =>
    values.length ? `${values.length} selected` : fallback;
  const accountOptions: Option[] = accounts.map((account) => ({
    value: account._id,
    label: account.name,
    detail: [
      account.institutionName,
      account.last4 && `••${account.last4}`,
      account.isArchived && "Archived",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  accountOptions.push({
    value: "__unlinked__",
    label: "No account assigned",
    detail: "Payment methods that match no account of yours",
  });
  const categoryOptions = useMemo(() => {
    const byId = new Map(
      categories.map((category) => [category._id, category]),
    );
    const options = categories
      .filter(
        (category) =>
          draft.type === "all" ||
          category.categoryType === draft.type ||
          draft.categories.includes(category._id),
      )
      .map((category) => ({
        value: String(category._id),
        label: category.name,
        detail: [
          category.categoryType === "income"
            ? "Income"
            : category.categoryType === "transfer"
              ? "Transfer"
              : "Spending",
          category.parentId
            ? byId.get(category.parentId)?.name
            : "Includes subcategories",
          category.archived && "Archived",
        ]
          .filter(Boolean)
          .join(" · "),
      }));
    // Keep historical labels and drill-down selections available even without a catalog record.
    const known = new Set(
      categories.flatMap((category) => [
        String(category._id),
        category.name.toLowerCase(),
      ]),
    );
    for (const entry of entries) {
      const value = entry.categoryId ?? entry.category ?? entry.bucket;
      if (value && !known.has(value.toLowerCase())) {
        known.add(value.toLowerCase());
        options.push({ value, label: value, detail: "From your activity" });
      }
    }
    options.push({
      value: "__uncategorized__",
      label: "Uncategorized",
      detail: "No category assigned",
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    const query = categorySearch.trim().toLowerCase();
    return options.filter((option) =>
      `${option.label} ${option.detail}`.toLowerCase().includes(query),
    );
  }, [categories, entries, draft.type, draft.categories, categorySearch]);
  const tags = [
    ...new Set([
      ...entries.flatMap((entry) => [
        ...(entry.tags ?? []),
        ...(entry.contextTags ?? []),
        ...(entry.intentTags ?? []),
      ]),
      ...draft.tags,
    ]),
  ].sort();
  const methods = [
    ...new Set([
      ...entries
        .map((entry) => entry.methodOrAccount?.trim())
        .filter((value): value is string => !!value),
      ...draft.methods.filter((value) => value !== "__unspecified__"),
    ]),
  ].sort();
  const error = amountRangeError(draft);
  const count = useMemo(
    () => filterActivityEntries(entries, draft, categories, accounts).length,
    [entries, draft, categories, accounts],
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="activity-filters-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 mt-auto w-full max-w-none rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-xl backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      <form
        className="flex max-h-[85dvh] flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!error) onApply(draft);
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 id="activity-filters-title" className="text-lg font-semibold">
              Filter activity
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Start with an account, then narrow it down.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close filters"
            className="rounded-lg p-2 hover:bg-[var(--surface-subtle)]"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-5">
          <Section
            title="Accounts"
            summary={selectedSummary(draft.accounts, "All accounts")}
            open
          >
            <Options
              options={accountOptions}
              selected={draft.accounts}
              onChange={(accounts) => update({ accounts })}
            />
          </Section>
          <Section
            title="Categories"
            summary={selectedSummary(draft.categories, "All categories")}
          >
            <div className="relative mb-2">
              <Search
                className="absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]"
                aria-hidden
              />
              <input
                aria-label="Find a category"
                placeholder="Find a category…"
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                className={`${fieldClass} pl-9`}
              />
            </div>
            <Options
              options={categoryOptions}
              selected={draft.categories}
              onChange={(categories) => update({ categories })}
            />
          </Section>
          <Section
            title="Amount"
            summary={
              draft.min || draft.max
                ? `$${draft.min || "0"} – ${draft.max ? `$${draft.max}` : "Any"}`
                : "Any amount"
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                Minimum ($)
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={draft.min}
                  onChange={(event) => update({ min: event.target.value })}
                  aria-invalid={!!error}
                  aria-describedby={error ? "amount-error" : undefined}
                />
              </label>
              <label className="space-y-1 text-sm">
                Maximum ($)
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Any"
                  value={draft.max}
                  onChange={(event) => update({ max: event.target.value })}
                  aria-invalid={!!error}
                  aria-describedby={error ? "amount-error" : undefined}
                />
              </label>
            </div>
            {error && (
              <p
                id="amount-error"
                role="alert"
                className="mt-2 text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}
          </Section>
          <Section
            title="Tags"
            summary={selectedSummary(draft.tags, "Any tag")}
          >
            <Options
              options={tags.map((tag) => ({ value: tag, label: tag }))}
              selected={draft.tags}
              onChange={(tags) => update({ tags })}
            />
          </Section>
          <Section
            title="Payment method"
            summary={selectedSummary(draft.methods, "Any method")}
          >
            <p className="mb-2 text-xs text-[var(--text-secondary)]">
              Payment labels such as cash or debit. Use Accounts to choose a
              specific bank account.
            </p>
            <Options
              options={[
                ...methods.map((method) => ({ value: method, label: method })),
                { value: "__unspecified__", label: "No payment method" },
              ]}
              selected={draft.methods}
              onChange={(methods) => update({ methods })}
            />
          </Section>
        </div>
        <footer className="flex shrink-0 items-center gap-3 border-t border-[var(--border)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="rounded-xl px-3 py-3 text-sm underline"
            onClick={() => setDraft({ ...emptyFilters })}
          >
            Reset all
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={!!error}
          >
            {loading
              ? "Apply filters"
              : `Show ${count.toLocaleString()} transaction${count === 1 ? "" : "s"}`}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
