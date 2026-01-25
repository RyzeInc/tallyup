"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { centsToDollars, formatMoney, getCategoryDisplayName, getDateRangeFromPreset, DateRangePreset } from "@/components/utils";
import * as Lucide from "lucide-react";
import EditEntryModal from "@/components/EditEntryModal";
import { useTabs } from "@/components/PersistentTabs";
import LocalDateRangePicker from "@/components/LocalDateRangePicker";
import Link from "next/link";

// New dashboard modules
import {
  UpcomingBillsModule,
  PaydayCountdownModule,
  SafeToSpendModule,
  BudgetHealthRingsModule,
} from "@/components/dashboard";

/**
 * Dashboard - Financial overview at a glance
 * 
 * Structure:
 * 1. Net money hero (income - expenses)
 * 2. Safe-to-Spend + Payday countdown
 * 3. Budget health rings
 * 4. Upcoming bills
 * 5. Recent activity
 * 6. Category breakdown
 */

type Entry = Doc<"entries">;
type EditableEntry = Entry & { type: "expense" | "income" };

const COLORS = ["#2F6F85", "#10B981", "#F59E0B", "#6F9EA8", "#EC4899", "#C87A5A"];

function isEditableEntry(entry: Entry): entry is EditableEntry {
  return entry.type === "expense" || entry.type === "income";
}

export default function DashboardPage() {
  const { setActiveTab } = useTabs();
  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [safeToSpendExpanded, setSafeToSpendExpanded] = useState(false);
  
  // Dashboard has its own independent time range (not linked to global)
  // Default to "This Month" for a snapshot of current financial situation
  const [dashboardPreset, setDashboardPreset] = useState<DateRangePreset>(() => {
    if (typeof window === "undefined") return "month";
    try {
      const stored = localStorage.getItem("tallyup.dashboardTimeRange");
      if (stored) {
        const parsed = JSON.parse(stored);
        const preset = parsed?.preset as DateRangePreset | undefined;
        if (
          preset === "today" ||
          preset === "yesterday" ||
          preset === "week" ||
          preset === "last-week" ||
          preset === "month" ||
          preset === "last-month"
        ) {
          return preset;
        }
      }
    } catch {}
    return "month";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("tallyup.dashboardTimeRange", JSON.stringify({ preset: dashboardPreset }));
    } catch {}
  }, [dashboardPreset]);
  
  // Compute date range from dashboard's own preset
  const { startDate, endDate, label } = useMemo(() => {
    return getDateRangeFromPreset(dashboardPreset);
  }, [dashboardPreset]);

  // Fetch dashboard module data (upcoming bills, payday, budgets, safe-to-spend)
  const dashboardData = useQuery(api.dashboard.getDashboardData, {
    periodStart: startDate,
    periodEnd: endDate,
    upcomingDays: 30,
  });

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as Entry[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as Entry[] | undefined;
  const expenseCategories = useQuery(api.categories.listCategories, { categoryType: "expense" });
  const incomeCategories = useQuery(api.categories.listCategories, { categoryType: "income" });
  const allCustomCategories = useMemo(() => {
    const expense = (expenseCategories ?? []) as { _id: string; name: string }[];
    const income = (incomeCategories ?? []) as { _id: string; name: string }[];
    return [...expense, ...income];
  }, [expenseCategories, incomeCategories]);

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return entries
      .filter(isEditableEntry)
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
  }, [entries]);

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;
    const bucketSpend = new Map<string, number>();
    const categorySpend = new Map<string, number>();

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") {
        income += e.amountCents;
      } else if (e.type === "expense") {
        expense += e.amountCents;
      }
      if (e.type === "expense") {
        const b = (e.bucket ?? "Other").trim() || "Other";
        bucketSpend.set(b, (bucketSpend.get(b) ?? 0) + e.amountCents);
        const categoryKey = e.categoryId ?? e.category ?? e.bucket;
        const categoryLabel = getCategoryDisplayName(categoryKey, allCustomCategories);
        categorySpend.set(categoryLabel, (categorySpend.get(categoryLabel) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;
    const bucketRows = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const otherTotal = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [, v]) => s + v, 0);
    const bucketFinal = otherTotal > 0 ? [...bucketRows, ["Other", otherTotal] as const] : bucketRows;
    const topCategory = [...categorySpend.entries()].sort((a, b) => b[1] - a[1])[0];
    return { income, expense, net, bucketFinal, topCategory };
  }, [entries, allCustomCategories]);

  const reviewCount = inbox?.length ?? 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Header Card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-end mb-4">
          {/* Dashboard-specific time range picker (independent from global) */}
          <LocalDateRangePicker
            preset={dashboardPreset}
            label={label}
            onChange={setDashboardPreset}
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "week", label: "This Week" },
              { value: "last-week", label: "Last Week" },
              { value: "month", label: "This Month" },
              { value: "last-month", label: "Last Month" },
            ]}
          />
        </div>

        <SignedOut>
          <div className="text-center py-6">
            <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign in to view your finances
            </div>
            <SignInButton mode="modal">
              <button
                className="rounded-lg px-5 py-2.5 font-semibold text-sm"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!entries || !inbox ? (
            <div className="space-y-4">
              <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              </div>
            </div>
          ) : (
            <>
              {/* Hero: Net Amount */}
              <div className="mb-4">
                <div className="text-micro mb-1" style={{ color: "var(--text-secondary)" }}>
                  {label} Net
                </div>
                <div
                  className="text-kpi tabular-nums"
                  style={{ color: computed.net >= 0 ? "var(--net)" : "var(--danger)" }}
                >
                  {formatMoney(computed.net, { signMode: "always" })}
                </div>
              </div>

              {/* Income / Expense Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-3"
                  style={{ backgroundColor: "var(--success-subtle)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                    <span className="text-micro font-medium" style={{ color: "var(--success)" }}>
                      Income
                    </span>
                  </div>
                  <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {formatMoney(computed.income)}
                  </div>
                </div>

                <div
                  className="rounded-xl p-3"
                  style={{ backgroundColor: "var(--danger-subtle)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--danger)" }} />
                    <span className="text-micro font-medium" style={{ color: "var(--danger)" }}>
                      Expenses
                    </span>
                  </div>
                  <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {formatMoney(computed.expense)}
                  </div>
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </div>

      {/* Review Alert */}
      <SignedIn>
        {reviewCount > 0 && (
          <button
            onClick={() => setActiveTab("activity")}
            className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-colors"
            style={{
              backgroundColor: "var(--warning-subtle)",
              border: "1px solid var(--warning)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--warning)" }}
            >
              <Lucide.Inbox className="h-5 w-5" style={{ color: "#fff" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                {reviewCount} transaction{reviewCount !== 1 ? "s" : ""} to review
              </div>
              <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                Tap to categorize
              </div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          </button>
        )}
      </SignedIn>

      {/* === PHASE 1 DASHBOARD MODULES === */}

      {/* Safe-to-Spend + Payday Row */}
      <SignedIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Safe-to-Spend Module */}
          <SafeToSpendModule
            data={dashboardData?.safeToSpend ?? null}
            isLoading={!dashboardData}
            expanded={safeToSpendExpanded}
            onToggleExpand={() => setSafeToSpendExpanded(!safeToSpendExpanded)}
          />

          {/* Payday Countdown Module */}
          <PaydayCountdownModule
            nextPayday={dashboardData?.nextPayday ?? null}
            upcomingIncome={dashboardData?.upcomingIncome}
            isLoading={!dashboardData}
          />
        </div>
      </SignedIn>

      {/* Budget Health Rings */}
      <SignedIn>
        <BudgetHealthRingsModule
          budgets={dashboardData?.budgetStatus ?? []}
          isLoading={!dashboardData}
          maxItems={5}
        />
      </SignedIn>

      {/* Upcoming Bills */}
      <SignedIn>
        <UpcomingBillsModule
          bills={(dashboardData?.upcomingBills ?? []).filter(b => b.type === "expense")}
          isLoading={!dashboardData}
          maxItems={5}
        />
      </SignedIn>

      {/* === END PHASE 1 MODULES === */}

      {/* Quick Actions */}
      <SignedIn>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActiveTab("budgeting")}
            className="rounded-xl p-4 text-left transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <Lucide.Wallet className="h-6 w-6 mb-2" style={{ color: "var(--primary)" }} />
            <div className="text-body font-medium" style={{ color: "var(--text)" }}>
              Budgets
            </div>
            <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
              Track spending
            </div>
          </button>

          <button
            onClick={() => setActiveTab("goals")}
            className="rounded-xl p-4 text-left transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <Lucide.Target className="h-6 w-6 mb-2" style={{ color: "var(--success)" }} />
            <div className="text-body font-medium" style={{ color: "var(--text)" }}>
              Goals
            </div>
            <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
              Save smarter
            </div>
          </button>
        </div>
      </SignedIn>

      {/* Recent Transactions */}
      <SignedIn>
        {entries && entries.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-h2" style={{ color: "var(--text)" }}>
                Recent
              </h2>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-meta font-medium"
                style={{ color: "var(--primary)" }}
              >
                View all
              </button>
            </div>

            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <button
                  key={entry._id}
                  onClick={() => setEditingEntry(entry)}
                  className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: entry.type === "income" ? "var(--success-subtle)" : "var(--surface-2)",
                    }}
                  >
                    {entry.type === "income" ? (
                      <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                    ) : (
                      <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-body font-medium truncate" style={{ color: "var(--text)" }}>
                      {getCategoryDisplayName(
                        entry.categoryId ?? entry.category ?? entry.bucket ?? entry.note,
                        allCustomCategories
                      )}
                    </div>
                    <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div
                    className="text-body font-medium tabular-nums"
                    style={{ color: entry.type === "income" ? "var(--success)" : "var(--text)" }}
                  >
                    {entry.type === "income" ? "+" : "-"}{centsToDollars(entry.amountCents)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </SignedIn>

      {/* Category Breakdown */}
      <SignedIn>
        {entries && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={() => setBreakdownOpen(!breakdownOpen)}
              className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <div className="text-left">
                <span className="text-h2 block" style={{ color: "var(--text)" }}>
                  Spending by Category
                </span>
                {computed.topCategory && !breakdownOpen && (
                  <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                    Top: {computed.topCategory[0]} — {centsToDollars(computed.topCategory[1])}
                  </span>
                )}
              </div>
              {breakdownOpen ? (
                <Lucide.ChevronDown className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
              ) : (
                <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
              )}
            </button>

            {breakdownOpen && (
              <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                {computed.bucketFinal.length === 0 ? (
                  <div className="pt-4 text-meta">No spending yet.</div>
                ) : (
                  <div className="pt-3 space-y-3">
                    {computed.bucketFinal.map(([name, v], i) => {
                      const total = computed.bucketFinal.reduce((s, [, val]) => s + val, 0) || 1;
                      const pct = Math.round((v / total) * 100);
                      return (
                        <Link
                          key={name}
                          href={`/activity?category=${encodeURIComponent(String(name))}`}
                          className="block space-y-1.5 transition-opacity hover:opacity-80"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              <span className="text-body" style={{ color: "var(--text)" }}>{name}</span>
                            </div>
                            <span className="text-body tabular-nums font-semibold" style={{ color: "var(--text)" }}>
                              {centsToDollars(v)}
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: "var(--surface-subtle)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                <Link
                  href="/insights"
                  className="block text-center text-meta font-semibold pt-2"
                  style={{ color: "var(--accent)" }}
                >
                  View all insights →
                </Link>
              </div>
            )}
          </div>
        )}
      </SignedIn>

      {/* Edit Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
