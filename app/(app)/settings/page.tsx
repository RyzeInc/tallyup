"use client";

import { SignedIn, SignedOut, useUser, SignOutButton, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import Link from "next/link";
import { useTimeRange } from "@/components/TimeRangeProvider";
import { useTheme } from "@/components/ThemeProvider";
import { centsToDollars, EXPENSE_SPACES, INCOME_SPACES, CONTEXT_TAGS } from "@/components/utils";

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

type SettingsSection = "main" | "categories" | "export" | "privacy" | "help" | "theme";

// Keys for localStorage
const PINNED_EXPENSE_KEY = "tallyup.pinnedExpenseCategories";
const PINNED_INCOME_KEY = "tallyup.pinnedIncomeCategories";
const HIDDEN_TAGS_KEY = "tallyup.hiddenTags";
const PINNED_TAGS_KEY = "tallyup.pinnedTags";
const CATEGORY_ORDER_KEY = "tallyup.categoryOrder";

export default function SettingsPage() {
  const { user } = useUser();
  const { startDate, endDate, label } = useTimeRange();
  const { theme, setTheme: changeTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>("main");

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

  const moveItem = useCallback((list: string[], from: number, to: number) => {
    const result = [...list];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
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

  // Export data
  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 5000 }) as any[] | undefined;
  const [exporting, setExporting] = useState(false);
  async function exportCSV() {
    if (!entries) return;
    setExporting(true);
    try {
      const rows = [["Date", "Type", "Category", "Amount", "Tags", "Note", "Method/Account"]];
      for (const e of entries) {
        rows.push([
          new Date(e.date).toLocaleDateString(),
          e.type,
          e.category ?? "",
          centsToDollars(e.amountCents),
          (e.tags ?? []).join("; "),
          e.note ?? "",
          e.methodOrAccount ?? "",
        ]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tallyup-export-${label.replace(/\s/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--accent-subtle)" }}>
                  <Lucide.Calendar className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Time Range</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</div>
                </div>
              </div>

              <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                {entries ? `${entries.length} transactions will be exported` : "Loading..."}
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
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "system" as const, label: "System", icon: Lucide.Monitor },
                  { key: "light" as const, label: "Light", icon: Lucide.Sun },
                  { key: "dark" as const, label: "Dark", icon: Lucide.Moon },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => changeTheme(key)}
                    className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${
                      theme === key ? "ring-2 ring-[var(--accent)]" : ""
                    }`}
                    style={{
                      backgroundColor: theme === key ? "var(--accent-subtle)" : "var(--surface-subtle)",
                    }}
                  >
                    <Icon className="h-6 w-6" style={{ color: theme === key ? "var(--accent)" : "var(--text-secondary)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
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
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Lucide.Palette className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Theme</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {theme === "system" ? "System" : theme === "light" ? "Light" : "Dark"}
              </div>
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
