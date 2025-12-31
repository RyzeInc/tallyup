"use client";

import { SignedIn, SignedOut, useUser, SignOutButton, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import Link from "next/link";
import { useTimeRange } from "@/components/TimeRangeProvider";
import TimeRangeControl from "@/components/TimeRangeControl";
import TimeRangeBadge from "@/components/TimeRangeBadge";
import { useTheme, APPEARANCE_OPTIONS } from "@/components/ThemeProvider";
import { centsToDollars, EXPENSE_SPACES, INCOME_SPACES, CONTEXT_TAGS } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";

type ExpenseSpace = typeof EXPENSE_SPACES[number];
type IncomeSpace = typeof INCOME_SPACES[number];
type ContextTag = typeof CONTEXT_TAGS[number];

function isExpenseSpace(x: string): x is ExpenseSpace {
  return (EXPENSE_SPACES as readonly string[]).includes(x);
}

function isIncomeSpace(x: string): x is IncomeSpace {
  return (INCOME_SPACES as readonly string[]).includes(x);
}

function isContextTag(x: string): x is ContextTag {
  return (CONTEXT_TAGS as readonly string[]).includes(x);
}

type SettingsSection = "main" | "categories" | "export" | "privacy" | "help" | "theme" | "notifications";

// Keys for localStorage
const PINNED_EXPENSE_KEY = "tallyup.pinnedExpenseCategories";
const PINNED_INCOME_KEY = "tallyup.pinnedIncomeCategories";
const HIDDEN_TAGS_KEY = "tallyup.hiddenTags";
const PINNED_TAGS_KEY = "tallyup.pinnedTags";
const REVIEW_REMINDER_KEY = "tallyup.reviewReminder";

export default function SettingsPage() {
  const { user } = useUser();
  const { startDate, endDate, label, timeRange } = useTimeRange();
  const { theme, setTheme: changeTheme } = useTheme();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>("main");
  const exportLabel = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString()}-${end.toLocaleDateString()}`;
  }, [startDate, endDate]);

  // Category/tag management state
  const [pinnedExpense, setPinnedExpense] = useState<ExpenseSpace[]>([]);
  const [pinnedIncome, setPinnedIncome] = useState<IncomeSpace[]>([]);
  const [pinnedTags, setPinnedTags] = useState<ContextTag[]>([]);
  const [hiddenTags, setHiddenTags] = useState<ContextTag[]>([]);

  useEffect(() => {
    try {
      const pe = localStorage.getItem(PINNED_EXPENSE_KEY);
      if (pe) setPinnedExpense(((JSON.parse(pe) as string[]) ?? []).filter(isExpenseSpace));
      const pi = localStorage.getItem(PINNED_INCOME_KEY);
      if (pi) setPinnedIncome(((JSON.parse(pi) as string[]) ?? []).filter(isIncomeSpace));
      const pt = localStorage.getItem(PINNED_TAGS_KEY);
      if (pt) setPinnedTags(((JSON.parse(pt) as string[]) ?? []).filter(isContextTag));
      const ht = localStorage.getItem(HIDDEN_TAGS_KEY);
      if (ht) setHiddenTags(((JSON.parse(ht) as string[]) ?? []).filter(isContextTag));
    } catch {}
  }, []);

  const togglePinExpense = useCallback((cat: ExpenseSpace) => {
    setPinnedExpense((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      try { localStorage.setItem(PINNED_EXPENSE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const togglePinIncome = useCallback((cat: IncomeSpace) => {
    setPinnedIncome((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      try { localStorage.setItem(PINNED_INCOME_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const togglePinTag = useCallback((tag: ContextTag) => {
    setPinnedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      try { localStorage.setItem(PINNED_TAGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggleHideTag = useCallback((tag: ContextTag) => {
    setHiddenTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      try { localStorage.setItem(HIDDEN_TAGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Privacy settings
  const [hideAmounts, setHideAmounts] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  useEffect(() => {
    try {
      setHideAmounts(localStorage.getItem("tallyup.hideAmounts") === "1");
      setRequireAuth(localStorage.getItem("tallyup.requireAuth") === "1");
    } catch {}
  }, []);
  function toggleHideAmounts() {
    const next = !hideAmounts;
    setHideAmounts(next);
    try { localStorage.setItem("tallyup.hideAmounts", next ? "1" : "0"); } catch {}
  }
  function toggleRequireAuth() {
    const next = !requireAuth;
    setRequireAuth(next);
    try { localStorage.setItem("tallyup.requireAuth", next ? "1" : "0"); } catch {}
  }

  // Export data - driven by global time range
  const entries = useQuery(api.entries.listEntries, { timeRange, limit: 5000 }) as any[] | undefined;
  const accounts = useQuery(api.accounts.listAccounts, { includeArchived: true }) as any[] | undefined;
  const [exporting, setExporting] = useState(false);
  async function exportCSV() {
    if (!entries) return;
    setExporting(true);
    try {
      const accountMap = new Map((accounts ?? []).map((acc) => [acc._id, acc.name]));
      const rows = [["Date", "Type", "Category", "Amount", "Tags", "Note", "Method/Account", "AccountId", "AccountName"]];
      for (const e of entries) {
        const accountName = e.accountId ? accountMap.get(e.accountId) ?? "" : "";
        rows.push([
          new Date(e.date).toLocaleDateString(),
          e.type,
          e.category ?? "",
          centsToDollars(e.amountCents),
          (e.tags ?? []).join("; "),
          e.note ?? "",
          e.methodOrAccount ?? "",
          e.accountId ?? "",
          accountName,
        ]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tallyup-export-${exportLabel.replace(/\s/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export complete", { description: `${entries.length} transactions exported` });
    } catch (e: any) {
      toast.error("Export failed", { description: e?.message ?? "Unknown error" });
    } finally {
      setExporting(false);
    }
  }

  // Help actions
  function resetFilters() {
    try {
      localStorage.removeItem("tallyup.timeRange");
    } catch {}
    window.location.href = "/activity";
  }

  function resetOnboarding() {
    try {
      localStorage.removeItem("tallyup.onboarding");
      localStorage.removeItem("tallyup.tips");
    } catch {}
    alert("Onboarding tips have been reset.");
  }

  // Render section
  if (activeSection !== "main") {
    return (
      <div className="space-y-4 pb-4">
        {/* Back header */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setActiveSection("main")}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            <Lucide.ChevronLeft className="h-4 w-4" />
            Back to Settings
          </button>
        </div>

        {/* Categories & Tags */}
        {activeSection === "categories" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Categories & Tags</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Manage your category sets and context tags
              </p>
            </div>

            {/* Expense Categories */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--danger)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Expense Categories</h3>
                <span className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>
                  Tap ⭐ to pin to top
                </span>
              </div>
              <div className="space-y-2">
                {/* Show pinned first, then rest */}
                {[...pinnedExpense.filter(c => EXPENSE_SPACES.includes(c)), ...EXPENSE_SPACES.filter(c => !pinnedExpense.includes(c))].map((cat, i) => {
                  const isPinned = pinnedExpense.includes(cat);
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ backgroundColor: isPinned ? "var(--accent-subtle)" : "var(--surface-subtle)" }}
                    >
                      <div className="flex items-center gap-3">
                        <Lucide.GripVertical className="h-4 w-4 cursor-grab" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm" style={{ color: "var(--text)" }}>{cat}</span>
                        {isPinned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                            Pinned
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => togglePinExpense(cat)}
                        className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                        title={isPinned ? "Unpin" : "Pin to top"}
                      >
                        <Lucide.Star className="h-4 w-4" style={{ color: isPinned ? "var(--warning)" : "var(--text-tertiary)" }} fill={isPinned ? "var(--warning)" : "none"} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Income Categories */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Income Categories</h3>
                <span className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>
                  Tap ⭐ to pin to top
                </span>
              </div>
              <div className="space-y-2">
                {[...pinnedIncome.filter(c => INCOME_SPACES.includes(c)), ...INCOME_SPACES.filter(c => !pinnedIncome.includes(c))].map((cat, i) => {
                  const isPinned = pinnedIncome.includes(cat);
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ backgroundColor: isPinned ? "var(--accent-subtle)" : "var(--surface-subtle)" }}
                    >
                      <div className="flex items-center gap-3">
                        <Lucide.GripVertical className="h-4 w-4 cursor-grab" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm" style={{ color: "var(--text)" }}>{cat}</span>
                        {isPinned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                            Pinned
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => togglePinIncome(cat)}
                        className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                        title={isPinned ? "Unpin" : "Pin to top"}
                      >
                        <Lucide.Star className="h-4 w-4" style={{ color: isPinned ? "var(--warning)" : "var(--text-tertiary)" }} fill={isPinned ? "var(--warning)" : "none"} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Context Tags */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lucide.Tags className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Context Tags</h3>
                </div>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  ⭐ Pin · 👁 Hide
                </span>
              </div>
              <div className="space-y-2">
                {/* Show pinned first, then visible, then hidden */}
                {[
                  ...pinnedTags.filter(t => CONTEXT_TAGS.includes(t) && !hiddenTags.includes(t)),
                  ...CONTEXT_TAGS.filter(t => !pinnedTags.includes(t) && !hiddenTags.includes(t)),
                  ...hiddenTags.filter(t => CONTEXT_TAGS.includes(t)),
                ].map((tag) => {
                  const isPinned = pinnedTags.includes(tag);
                  const isHidden = hiddenTags.includes(tag);
                  return (
                    <div
                      key={tag}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{
                        backgroundColor: isHidden ? "var(--surface)" : isPinned ? "var(--accent-subtle)" : "var(--surface-subtle)",
                        opacity: isHidden ? 0.5 : 1,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Lucide.GripVertical className="h-4 w-4 cursor-grab" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm" style={{ color: "var(--text)", textDecoration: isHidden ? "line-through" : "none" }}>{tag}</span>
                        {isPinned && !isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                            Pinned
                          </span>
                        )}
                        {isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-tertiary)" }}>
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePinTag(tag)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isPinned ? "Unpin" : "Pin to top"}
                          disabled={isHidden}
                        >
                          <Lucide.Star className="h-4 w-4" style={{ color: isPinned ? "var(--warning)" : "var(--text-tertiary)" }} fill={isPinned ? "var(--warning)" : "none"} />
                        </button>
                        <button
                          onClick={() => toggleHideTag(tag)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isHidden ? "Show" : "Hide"}
                        >
                          {isHidden ? (
                            <Lucide.EyeOff className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          ) : (
                            <Lucide.Eye className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
                Hidden tags won't appear in quick-add flows but remain on existing entries.
              </p>
            </div>
          </div>
        )}

        {/* Export */}
        {activeSection === "export" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Export Data</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Download your financial data as a CSV file
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Time Range Selection */}
              <div className="mb-4">
                <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-tertiary)" }}>
                  Time Range
                </label>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
                  <div className="flex items-center gap-2">
                    <TimeRangeBadge />
                    <TimeRangeControl />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                <Lucide.FileText className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {entries ? `${entries.length} transactions will be exported` : "Loading..."}
                </div>
              </div>

              <button
                onClick={exportCSV}
                disabled={!entries || exporting}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {exporting ? (
                  <Lucide.Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lucide.Download className="h-4 w-4" />
                )}
                Export as CSV
              </button>
            </div>
          </div>
        )}

        {/* Privacy & Lock */}
        {activeSection === "privacy" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Privacy & Lock</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Protect your financial data
              </p>
            </div>

            <div
              className="rounded-xl p-4 space-y-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Hide amounts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                    <Lucide.EyeOff className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Hide amounts</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Replace amounts with •••</div>
                  </div>
                </div>
                <button
                  onClick={toggleHideAmounts}
                  className={`relative w-11 h-6 rounded-full transition-colors ${hideAmounts ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${hideAmounts ? "left-6" : "left-1"}`}
                  />
                </button>
              </div>

              {/* Require auth */}
              <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                    <Lucide.Lock className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Require device auth</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>PIN/biometric when opening app</div>
                  </div>
                </div>
                <button
                  onClick={toggleRequireAuth}
                  className={`relative w-11 h-6 rounded-full transition-colors ${requireAuth ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${requireAuth ? "left-6" : "left-1"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help */}
        {activeSection === "help" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Help</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Learn how to use TallyUp effectively
              </p>
            </div>

            {/* How to use */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--accent-subtle)" }}>
                  <Lucide.BookOpen className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>How to use TallyUp</div>
              </div>
              <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>1.</span>
                  <span><strong>Log entries</strong> — Tap + to record spending or income. Choose a category and add context tags.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>2.</span>
                  <span><strong>Review inbox</strong> — Items without a category go to review. Swipe to categorize quickly.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>3.</span>
                  <span><strong>Check insights</strong> — See where your money goes by category or context tag.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>4.</span>
                  <span><strong>Use context tags</strong> — Mark entries as Personal, Shared, Business, Tax-Deductible, etc.</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={resetOnboarding}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Lucide.RefreshCw className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Reset tips & onboarding</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Show all tips again</div>
                </div>
              </button>
              <button
                onClick={resetFilters}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <Lucide.FilterX className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Reset all filters</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Clear Activity filters and time range</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Theme */}
        {activeSection === "theme" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Theme</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Choose your preferred appearance
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-2 gap-3">
                {APPEARANCE_OPTIONS.map(({ value, label, description }) => {
                  const Icon = value === "light" ? Lucide.Sun : Lucide.Moon;
                  return (
                    <button
                      key={value}
                      onClick={() => changeTheme(value)}
                      className={`flex flex-col items-start gap-2 rounded-xl p-4 transition-colors ${
                        theme === value ? "ring-2 ring-[var(--accent)]" : ""
                      }`}
                      style={{
                        backgroundColor: theme === value ? "var(--accent-subtle)" : "var(--surface-subtle)",
                      }}
                    >
                      <Icon className="h-6 w-6" style={{ color: theme === value ? "var(--accent)" : "var(--text-secondary)" }} />
                      <div style={{ textAlign: "left" }}>
                        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: 2 }}>{description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeSection === "notifications" && (
          <NotificationsSection toast={toast} />
        )}
      </div>
    );
  }

  // Main settings view
  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-h1" style={{ color: "var(--text)" }}>More</h1>
        <p className="text-meta mt-1">Settings & preferences</p>
      </div>

      <SignedOut>
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to access settings
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
        {/* User card */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold"
              style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {user?.fullName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "—"}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                {user?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
            <SignOutButton>
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-secondary)" }}>
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>

        {/* Settings menu */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Categories & Tags */}
          <button
            onClick={() => setActiveSection("categories")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--accent-subtle)" }}>
              <Lucide.Tags className="h-5 w-5" style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Categories & Tags</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Manage category sets and context tags</div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Export */}
          <button
            onClick={() => setActiveSection("export")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.1)" }}>
              <Lucide.Download className="h-5 w-5" style={{ color: "var(--success)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Export Data</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Download as CSV</div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Privacy & Lock */}
          <button
            onClick={() => setActiveSection("privacy")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
              <Lucide.Shield className="h-5 w-5" style={{ color: "var(--warning)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Privacy & Lock</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Hide amounts, require auth</div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Help */}
          <button
            onClick={() => setActiveSection("help")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Lucide.HelpCircle className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Help</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>How to use TallyUp, reset tips</div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Theme */}
          <button
            onClick={() => setActiveSection("theme")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Lucide.Palette className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Theme</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {theme === "light" ? "Light" : "Dim (Beta)"}
              </div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setActiveSection("notifications")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Lucide.Bell className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Review Reminders</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Weekly review notifications</div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        {/* Recurring link */}
        <Link
          href="/recurring"
          className="block rounded-xl p-4 transition-colors hover:bg-[var(--surface-subtle)]"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Lucide.Repeat className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Recurring Patterns</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Manage detected recurring entries</div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </div>
        </Link>
      </SignedIn>
    </div>
  );
}

/**
 * Notifications Settings Section
 */
function NotificationsSection({ toast }: { toast: ReturnType<typeof useToast> }) {
  // Convex integration for preferences
  const preferences = useQuery(api.preferences.getUserPreferences, {});
  const upsertPreferences = useMutation(api.preferences.upsertUserPreferences);
  
  // Local state (initialized from Convex or defaults)
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState("Sunday");
  const [time, setTime] = useState("18:00");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [saving, setSaving] = useState(false);

  // Sync state from Convex preferences
  useEffect(() => {
    if (preferences) {
      setEnabled(preferences.reviewReminderEnabled ?? false);
      setDay(preferences.reviewReminderDay ?? "Sunday");
      setTime(preferences.reviewReminderTime ?? "18:00");
    }
    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, [preferences]);

  async function requestPermission() {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported", { description: "Your browser doesn't support notifications" });
      return;
    }
    
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === "granted") {
      toast.success("Notifications enabled!");
      // Show a test notification
      new Notification("TallyUp", {
        body: "You'll now receive weekly review reminders",
        icon: "/icons/icon-192.png",
      });
    } else {
      toast.error("Permission denied", { description: "You can enable notifications in your browser settings" });
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      // Save to Convex
      await upsertPreferences({
        reviewReminderEnabled: enabled,
        reviewReminderDay: day,
        reviewReminderTime: time,
        reviewReminderFrequency: "weekly",
      });
      
      // Also save to localStorage as backup for service worker
      localStorage.setItem(REVIEW_REMINDER_KEY, JSON.stringify({ enabled, day, time }));
      
      toast.success("Reminder settings saved");
      
      // Schedule notification via service worker
      if (enabled && notificationPermission === "granted" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.active?.postMessage({
            type: "SCHEDULE_REVIEW_REMINDER",
            payload: { day, time },
          });
        });
      }
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    // Immediately save toggle state
    try {
      await upsertPreferences({ reviewReminderEnabled: next });
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Review Reminders</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Get a gentle nudge to review and clean up your money log
        </p>
      </div>

      {/* Permission status */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Notification Permission
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {notificationPermission === "granted" && "Enabled ✓"}
              {notificationPermission === "denied" && "Blocked (check browser settings)"}
              {notificationPermission === "default" && "Not yet requested"}
              {notificationPermission === "unsupported" && "Not supported by your browser"}
            </div>
          </div>
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <button
              onClick={requestPermission}
              className="text-sm font-medium px-4 py-2 rounded-lg"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Enable
            </button>
          )}
        </div>
      </div>

      {/* Reminder settings */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Weekly Review Reminder
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              2 minutes to review flagged items and uncategorized entries
            </div>
          </div>
          <button
            onClick={toggleEnabled}
            className="relative w-12 h-7 rounded-full transition-colors"
            style={{
              backgroundColor: enabled ? "var(--accent)" : "var(--border)",
            }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full transition-transform"
              style={{
                backgroundColor: "white",
                left: enabled ? "24px" : "4px",
              }}
            />
          </button>
        </div>

        {enabled && (
          <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Day
                </label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                >
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {saving ? "Saving..." : "Save Reminder"}
            </button>
          </div>
        )}
      </div>

      {/* Reflective copy */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)" }}
      >
        <div className="flex gap-3">
          <Lucide.Lightbulb className="h-5 w-5 flex-shrink-0" style={{ color: "var(--warning)" }} />
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text)" }}>Why weekly?</strong> Financial awareness is a habit. 
            A brief weekly review helps you stay in control without becoming obsessive. 
            Just 2 minutes: check flagged items, categorize recent entries, notice any surprises.
          </div>
        </div>
      </div>
    </div>
  );
}
