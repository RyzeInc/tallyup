"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import { centsToDollars, CONTEXT_TAGS } from "@/components/utils";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useTimeRange } from "@/components/TimeRangeProvider";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type TypeFilter = "all" | "income" | "expense";

interface Entry {
  _id: string;
  type: "expense" | "income";
  category?: string;
  tags?: string[];
  note?: string;
  amountCents: number;
  date: number;
  excludeFromTotals?: boolean;
}

interface InsightCard {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  label: string;
  value: string;
  statement: string;
  link: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MIN_DAYS_FOR_TRENDS = 7;
const MIN_TRANSACTIONS_FOR_INSIGHT = 5;
const INSIGHT_MIN_DELTA_CENTS = 5000; // $50
const INSIGHT_MIN_PERCENT = 15;

// ─────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function medianAbs(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].map(Math.abs).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function volatilityLabel(netStdDev: number, netMedian: number): "Low" | "Medium" | "High" {
  if (netMedian === 0) return "Low";
  const ratio = netStdDev / netMedian;
  if (ratio <= 0.5) return "Low";
  if (ratio <= 1.0) return "Medium";
  return "High";
}

function formatDelta(current: number, previous: number): { dollar: string; percent: string; direction: "up" | "down" | "neutral" } {
  const diff = current - previous;
  const pct = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : current !== 0 ? 100 : 0;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
  const dollarSign = diff >= 0 ? "+" : "";
  return {
    dollar: `${dollarSign}${centsToDollars(diff)}`,
    percent: `${diff >= 0 ? "+" : ""}${pct.toFixed(0)}%`,
    direction,
  };
}

function getDaysBetween(start: number, end: number): number {
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

// ─────────────────────────────────────────────────────────────
// KPI Tooltip Component
// ─────────────────────────────────────────────────────────────
function KpiTooltip({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border p-3 shadow-lg text-xs animate-in fade-in duration-150"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold" style={{ color: "var(--text)" }}>{title}</span>
        <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text)]">
          <Lucide.X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div style={{ color: "var(--text-secondary)" }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { startDate, endDate, label, prevStartDate, prevEndDate, prevLabel } = useTimeRange();
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showNetOnly, setShowNetOnly] = useState(false);
  
  // Tooltip state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Data
  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 2000 }) as Entry[] | undefined;
  const prevEntries = useQuery(api.entries.listEntries, { startDate: prevStartDate, endDate: prevEndDate, limit: 2000 }) as Entry[] | undefined;

  // Days in range
  const daysInRange = useMemo(() => getDaysBetween(startDate, endDate), [startDate, endDate]);
  const hasEnoughDataForTrends = daysInRange >= MIN_DAYS_FOR_TRENDS;

  // Filter entries based on type and tags
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      if (e.excludeFromTotals) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (selectedTags.length > 0) {
        const entryTags = e.tags ?? [];
        // OR logic: entry has at least one selected tag
        if (!selectedTags.some((t) => entryTags.includes(t))) return false;
      }
      return true;
    });
  }, [entries, typeFilter, selectedTags]);

  const filteredPrevEntries = useMemo(() => {
    if (!prevEntries) return [];
    return prevEntries.filter((e) => {
      if (e.excludeFromTotals) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (selectedTags.length > 0) {
        const entryTags = e.tags ?? [];
        if (!selectedTags.some((t) => entryTags.includes(t))) return false;
      }
      return true;
    });
  }, [prevEntries, typeFilter, selectedTags]);

  // ─────────────────────────────────────────────────────────────
  // Computed metrics
  // ─────────────────────────────────────────────────────────────
  const computed = useMemo(() => {
    const all = filteredEntries;
    let income = 0;
    let expense = 0;
    const categorySpend = new Map<string, number>();
    const categoryCount = new Map<string, number>();
    let largestExpense = { amount: 0, note: "", category: "" };
    let reimbursableOutstanding = 0;

    for (const e of all) {
      if (e.type === "income") {
        income += e.amountCents;
      } else {
        expense += e.amountCents;
        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);
        categoryCount.set(c, (categoryCount.get(c) ?? 0) + 1);

        if (e.amountCents > largestExpense.amount) {
          largestExpense = { amount: e.amountCents, note: e.note ?? "", category: c };
        }

        // Reimbursable
        if (e.tags?.includes("Reimbursable")) {
          reimbursableOutstanding += e.amountCents;
        }
      }
    }

    const net = income - expense;
    const topCategory = [...categorySpend.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["None", 0];

    return {
      income,
      expense,
      net,
      topCategory: { name: topCategory[0], amount: topCategory[1] },
      largestExpense,
      reimbursableOutstanding,
      categorySpend,
      categoryCount,
      transactionCount: all.length,
    };
  }, [filteredEntries]);

  const prevComputed = useMemo(() => {
    const all = filteredPrevEntries;
    let income = 0;
    let expense = 0;
    const categorySpend = new Map<string, number>();

    for (const e of all) {
      if (e.type === "income") {
        income += e.amountCents;
      } else {
        expense += e.amountCents;
        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);
      }
    }

    return {
      income,
      expense,
      net: income - expense,
      categorySpend,
      transactionCount: all.length,
    };
  }, [filteredPrevEntries]);

  // ─────────────────────────────────────────────────────────────
  // Time-series data for Net Trend chart
  // ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!filteredEntries.length) return [];

    // Determine granularity
    const useWeekly = daysInRange > 45;
    const useMonthly = daysInRange > 365;

    const buckets = new Map<string, { income: number; expense: number; date: number }>();

    for (const e of filteredEntries) {
      const d = new Date(e.date);
      let key: string;
      let bucketDate: number;

      if (useMonthly) {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        bucketDate = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      } else if (useWeekly) {
        // Start of week (Monday)
        const day = d.getDay();
        const diff = (day + 6) % 7;
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - diff);
        weekStart.setHours(0, 0, 0, 0);
        key = weekStart.toISOString().split("T")[0];
        bucketDate = weekStart.getTime();
      } else {
        key = d.toISOString().split("T")[0];
        bucketDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }

      if (!buckets.has(key)) {
        buckets.set(key, { income: 0, expense: 0, date: bucketDate });
      }
      const bucket = buckets.get(key)!;
      if (e.type === "income") {
        bucket.income += e.amountCents;
      } else {
        bucket.expense += e.amountCents;
      }
    }

    return [...buckets.entries()]
      .sort((a, b) => a[1].date - b[1].date)
      .map(([key, val]) => ({
        date: key,
        dateTs: val.date,
        income: val.income,
        expense: val.expense,
        net: val.income - val.expense,
      }));
  }, [filteredEntries, daysInRange]);

  // Volatility calculation
  const volatility = useMemo(() => {
    if (chartData.length < 3) return null;
    const netValues = chartData.map((d) => d.net);
    const netStd = stdDev(netValues);
    const netMed = medianAbs(netValues);
    return {
      label: volatilityLabel(netStd, netMed),
      stdDev: netStd,
    };
  }, [chartData]);

  // ─────────────────────────────────────────────────────────────
  // "What changed?" Insight Cards
  // ─────────────────────────────────────────────────────────────
  const insightCards = useMemo(() => {
    const cards: InsightCard[] = [];
    const bothPeriodsHaveData =
      computed.transactionCount >= MIN_TRANSACTIONS_FOR_INSIGHT &&
      prevComputed.transactionCount >= MIN_TRANSACTIONS_FOR_INSIGHT;

    if (!bothPeriodsHaveData) return cards;

    // 1. Category delta insights
    for (const [cat, currentAmt] of computed.categorySpend.entries()) {
      const prevAmt = prevComputed.categorySpend.get(cat) ?? 0;
      const delta = currentAmt - prevAmt;
      const pctDelta = prevAmt > 0 ? ((delta / prevAmt) * 100) : (currentAmt > 0 ? 100 : 0);

      if (Math.abs(delta) >= INSIGHT_MIN_DELTA_CENTS && Math.abs(pctDelta) >= INSIGHT_MIN_PERCENT) {
        const isUp = delta > 0;
        cards.push({
          id: `cat-${cat}`,
          icon: isUp ? Lucide.TrendingUp : Lucide.TrendingDown,
          iconColor: isUp ? "var(--danger)" : "var(--success)",
          label: cat,
          value: `${isUp ? "+" : ""}${pctDelta.toFixed(0)}%`,
          statement: `${isUp ? "up" : "down"} vs ${prevLabel}`,
          link: `/activity?category=${encodeURIComponent(cat)}`,
        });
      }
    }

    // 2. New category (exists now but not in previous period)
    for (const [cat] of computed.categorySpend.entries()) {
      if (!prevComputed.categorySpend.has(cat) && (computed.categorySpend.get(cat) ?? 0) >= INSIGHT_MIN_DELTA_CENTS) {
        cards.push({
          id: `new-${cat}`,
          icon: Lucide.Sparkles,
          iconColor: "var(--accent)",
          label: "New category",
          value: cat,
          statement: `first time in ${prevLabel}`,
          link: `/activity?category=${encodeURIComponent(cat)}`,
        });
      }
    }

    // 3. Spending timing (% spent before mid-month)
    if (daysInRange >= 14) {
      const midDate = startDate + (endDate - startDate) / 2;
      let spentBeforeMid = 0;
      for (const e of filteredEntries) {
        if (e.type === "expense" && e.date < midDate) {
          spentBeforeMid += e.amountCents;
        }
      }
      const pctBeforeMid = computed.expense > 0 ? (spentBeforeMid / computed.expense) * 100 : 0;
      if (pctBeforeMid >= 60) {
        cards.push({
          id: "timing-squeeze",
          icon: Lucide.Clock,
          iconColor: "var(--warning)",
          label: "Early spending",
          value: `${pctBeforeMid.toFixed(0)}%`,
          statement: "spent in first half of period",
          link: "/activity",
        });
      }
    }

    // Limit to 4 most relevant
    return cards.slice(0, 4);
  }, [computed, prevComputed, prevLabel, daysInRange, startDate, endDate, filteredEntries]);

  // ─────────────────────────────────────────────────────────────
  // Deltas for KPIs
  // ─────────────────────────────────────────────────────────────
  const deltas = useMemo(() => ({
    income: formatDelta(computed.income, prevComputed.income),
    expense: formatDelta(computed.expense, prevComputed.expense),
    net: formatDelta(computed.net, prevComputed.net),
  }), [computed, prevComputed]);

  // ─────────────────────────────────────────────────────────────
  // Toggle tag selection
  // ─────────────────────────────────────────────────────────────
  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {label} at a glance
          </p>
        </div>
        <GlobalDateRangePicker showAllPresets />
      </div>

      <SignedOut>
        <div
          className="rounded-xl border p-6 text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to view your dashboard
          </div>
          <SignInButton mode="modal">
            <button
              className="rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {!entries ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            <div className="h-64 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
          </div>
        ) : (
          <>
            {/* ─────────────────────────────────────────────────────────────
                Global Filters Bar
            ───────────────────────────────────────────────────────────── */}
            <div className="space-y-3">
              {/* Type filter */}
              <div
                className="grid grid-cols-3 gap-1 p-1 rounded-xl"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {(["all", "income", "expense"] as TypeFilter[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      typeFilter === type ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : ""
                    }`}
                    style={{ color: typeFilter === type ? undefined : "var(--text)" }}
                  >
                    {type === "all" && <Lucide.LayoutGrid className="h-4 w-4" />}
                    {type === "income" && <Lucide.ArrowDownLeft className="h-4 w-4" />}
                    {type === "expense" && <Lucide.ArrowUpRight className="h-4 w-4" />}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tag lens chips */}
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                        isSelected
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                          : "bg-[var(--surface)] border-[var(--border)]"
                      }`}
                      style={{ color: isSelected ? undefined : "var(--text-secondary)" }}
                    >
                      {tag}
                    </button>
                  );
                })}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="rounded-full px-2 py-1.5 text-xs font-medium transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <Lucide.X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                A. "This Period At a Glance" - KPI Tiles
            ───────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Income */}
              <div className="relative">
                <Link
                  href="/activity?type=income"
                  className="block rounded-xl border p-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                      Income
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTooltip(activeTooltip === "income" ? null : "income");
                      }}
                      className="p-0.5 rounded hover:bg-[var(--surface-subtle)]"
                    >
                      <Lucide.Info className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                    </button>
                  </div>
                  <div
                    className="mt-1 text-xl font-semibold tabular-nums"
                    style={{ color: "var(--success)", fontFeatureSettings: "'tnum' 1" }}
                  >
                    {centsToDollars(computed.income)}
                  </div>
                  {prevEntries && (
                    <div
                      className="text-[10px] mt-1 flex items-center gap-1"
                      style={{ color: deltas.income.direction === "up" ? "var(--success)" : deltas.income.direction === "down" ? "var(--danger)" : "var(--text-tertiary)" }}
                    >
                      {deltas.income.direction === "up" && <Lucide.TrendingUp className="h-3 w-3" />}
                      {deltas.income.direction === "down" && <Lucide.TrendingDown className="h-3 w-3" />}
                      <span>{deltas.income.dollar}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>({deltas.income.percent})</span>
                    </div>
                  )}
                </Link>
                <KpiTooltip
                  open={activeTooltip === "income"}
                  onClose={() => setActiveTooltip(null)}
                  title="Income"
                >
                  <div className="space-y-1">
                    <div>Sum of all income transactions in period</div>
                    <div className="font-medium" style={{ color: "var(--text)" }}>
                      {prevLabel}: {centsToDollars(prevComputed.income)}
                    </div>
                  </div>
                </KpiTooltip>
              </div>

              {/* Expenses */}
              <div className="relative">
                <Link
                  href="/activity?type=expense"
                  className="block rounded-xl border p-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                      Expenses
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTooltip(activeTooltip === "expenses" ? null : "expenses");
                      }}
                      className="p-0.5 rounded hover:bg-[var(--surface-subtle)]"
                    >
                      <Lucide.Info className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                    </button>
                  </div>
                  <div
                    className="mt-1 text-xl font-semibold tabular-nums"
                    style={{ color: "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                  >
                    {centsToDollars(computed.expense)}
                  </div>
                  {prevEntries && (
                    <div
                      className="text-[10px] mt-1 flex items-center gap-1"
                      style={{ color: deltas.expense.direction === "down" ? "var(--success)" : deltas.expense.direction === "up" ? "var(--danger)" : "var(--text-tertiary)" }}
                    >
                      {deltas.expense.direction === "up" && <Lucide.TrendingUp className="h-3 w-3" />}
                      {deltas.expense.direction === "down" && <Lucide.TrendingDown className="h-3 w-3" />}
                      <span>{deltas.expense.dollar}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>({deltas.expense.percent})</span>
                    </div>
                  )}
                </Link>
                <KpiTooltip
                  open={activeTooltip === "expenses"}
                  onClose={() => setActiveTooltip(null)}
                  title="Expenses"
                >
                  <div className="space-y-1">
                    <div>Sum of all expense transactions in period</div>
                    <div className="font-medium" style={{ color: "var(--text)" }}>
                      {prevLabel}: {centsToDollars(prevComputed.expense)}
                    </div>
                  </div>
                </KpiTooltip>
              </div>

              {/* Net */}
              <div className="relative">
                <Link
                  href="/activity"
                  className="block rounded-xl border p-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                      Net
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTooltip(activeTooltip === "net" ? null : "net");
                      }}
                      className="p-0.5 rounded hover:bg-[var(--surface-subtle)]"
                    >
                      <Lucide.Info className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                    </button>
                  </div>
                  <div
                    className="mt-1 text-xl font-semibold tabular-nums"
                    style={{ color: computed.net >= 0 ? "var(--success)" : "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                  >
                    {computed.net >= 0 ? "+" : ""}{centsToDollars(computed.net)}
                  </div>
                  {prevEntries && (
                    <div
                      className="text-[10px] mt-1 flex items-center gap-1"
                      style={{ color: deltas.net.direction === "up" ? "var(--success)" : deltas.net.direction === "down" ? "var(--danger)" : "var(--text-tertiary)" }}
                    >
                      {deltas.net.direction === "up" && <Lucide.TrendingUp className="h-3 w-3" />}
                      {deltas.net.direction === "down" && <Lucide.TrendingDown className="h-3 w-3" />}
                      <span>{deltas.net.dollar}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>({deltas.net.percent})</span>
                    </div>
                  )}
                </Link>
                <KpiTooltip
                  open={activeTooltip === "net"}
                  onClose={() => setActiveTooltip(null)}
                  title="Net"
                >
                  <div className="space-y-1">
                    <div>Income − Expenses</div>
                    <div className="font-medium" style={{ color: "var(--text)" }}>
                      {prevLabel}: {prevComputed.net >= 0 ? "+" : ""}{centsToDollars(prevComputed.net)}
                    </div>
                  </div>
                </KpiTooltip>
              </div>

              {/* Top Category (Spend) */}
              <div className="relative">
                <Link
                  href={computed.topCategory.name !== "None" ? `/activity?category=${encodeURIComponent(computed.topCategory.name)}` : "/activity"}
                  className="block rounded-xl border p-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    Top Category
                  </div>
                  <div
                    className="mt-1 text-base font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {computed.topCategory.name}
                  </div>
                  <div className="text-xs mt-0.5 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {centsToDollars(computed.topCategory.amount)}
                  </div>
                </Link>
              </div>

              {/* Largest Expense */}
              <div className="relative">
                <Link
                  href="/activity?type=expense"
                  className="block rounded-xl border p-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    Largest Expense
                  </div>
                  <div
                    className="mt-1 text-xl font-semibold tabular-nums"
                    style={{ color: "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                  >
                    {computed.largestExpense.amount > 0 ? centsToDollars(computed.largestExpense.amount) : "—"}
                  </div>
                  {computed.largestExpense.category && (
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
                      {computed.largestExpense.category}
                    </div>
                  )}
                </Link>
              </div>

              {/* Reimbursable Outstanding */}
              <div className="relative">
                <Link
                  href="/activity?tag=Reimbursable"
                  className="block rounded-xl border p-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    Reimbursable
                  </div>
                  <div
                    className="mt-1 text-xl font-semibold tabular-nums"
                    style={{ color: "var(--warning)", fontFeatureSettings: "'tnum' 1" }}
                  >
                    {centsToDollars(computed.reimbursableOutstanding)}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    outstanding
                  </div>
                </Link>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                B. Net Trend Chart
            ───────────────────────────────────────────────────────────── */}
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lucide.LineChart className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    Net Trend
                  </span>
                </div>
                <button
                  onClick={() => setShowNetOnly(!showNetOnly)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors border ${
                    showNetOnly
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-transparent"
                      : "bg-[var(--surface)] border-[var(--border)]"
                  }`}
                  style={{ color: showNetOnly ? undefined : "var(--text-secondary)" }}
                >
                  Net only
                </button>
              </div>

              {!hasEnoughDataForTrends ? (
                <div className="py-8 text-center">
                  <Lucide.Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    Not enough history yet
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    Trends require at least {MIN_DAYS_FOR_TRENDS} days of data
                  </div>
                </div>
              ) : chartData.length < 3 ? (
                <div className="py-8 text-center">
                  <Lucide.BarChart3 className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    Not enough data points
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    Need at least 3 time buckets to show trends
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
                        <CartesianGrid vertical={false} strokeOpacity={0.08} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(d: string) => {
                            try {
                              const dt = new Date(d);
                              return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                            } catch {
                              return d;
                            }
                          }}
                          style={{ fontSize: 10 }}
                          tick={{ fill: "var(--text-tertiary)" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `$${(v / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                          style={{ fontSize: 10 }}
                          tick={{ fill: "var(--text-tertiary)" }}
                          width={50}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--surface)",
                            borderColor: "var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number, name: string) => [
                            centsToDollars(value),
                            name.charAt(0).toUpperCase() + name.slice(1),
                          ]}
                          labelFormatter={(label: string) => {
                            try {
                              const dt = new Date(label);
                              return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                            } catch {
                              return label;
                            }
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={30}
                          formatter={(value: string) => (
                            <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                              {value.charAt(0).toUpperCase() + value.slice(1)}
                            </span>
                          )}
                        />
                        {!showNetOnly && (
                          <>
                            <Line
                              type="monotone"
                              dataKey="income"
                              stroke="var(--success)"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="expense"
                              stroke="var(--danger)"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          </>
                        )}
                        <Line
                          type="monotone"
                          dataKey="net"
                          stroke="var(--accent)"
                          strokeWidth={showNetOnly ? 3 : 2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Derived metrics under chart */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    {volatility && (
                      <div className="flex items-center gap-1.5">
                        <Lucide.Activity className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Volatility:</span>
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: volatility.label === "Low" ? "var(--success)" : volatility.label === "Medium" ? "var(--warning)" : "var(--danger)",
                          }}
                        >
                          {volatility.label}
                        </span>
                      </div>
                    )}
                    {daysInRange > 0 && computed.net !== 0 && (
                      <div className="flex items-center gap-1.5">
                        <Lucide.Target className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Run-rate:</span>
                        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                          {centsToDollars(Math.round((computed.net / daysInRange) * 30))}/mo
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                C. "What changed?" Insight Strip
            ───────────────────────────────────────────────────────────── */}
            {insightCards.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lucide.Lightbulb className="h-4 w-4" style={{ color: "var(--warning)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    What changed?
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
                  {insightCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <Link
                        key={card.id}
                        href={card.link}
                        className="flex-shrink-0 w-44 snap-start rounded-xl border p-3 transition-colors hover:opacity-90"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4" style={{ color: card.iconColor }} />
                          <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                            {card.label}
                          </span>
                        </div>
                        <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                          {card.value}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          {card.statement}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for insights */}
            {insightCards.length === 0 && computed.transactionCount >= MIN_TRANSACTIONS_FOR_INSIGHT && prevComputed.transactionCount < MIN_TRANSACTIONS_FOR_INSIGHT && (
              <div
                className="rounded-xl border p-4 text-center"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <Lucide.Lightbulb className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Insights coming soon
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Need more data in the previous period to compare
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                Quick Links / Navigation
            ───────────────────────────────────────────────────────────── */}
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: "var(--text-tertiary)" }}>
                Explore
              </div>
              <div className="space-y-1">
                {[
                  { href: "/activity", icon: Lucide.List, label: "All Transactions" },
                  { href: "/recurring", icon: Lucide.Repeat, label: "Recurring Patterns" },
                  { href: "/inbox", icon: Lucide.Inbox, label: "Needs Review" },
                  { href: "/summary", icon: Lucide.PieChart, label: "Category Summary" },
                ].map(({ href, icon: Icon, label: linkLabel }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between py-2.5 px-1 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      <span className="text-sm" style={{ color: "var(--text)" }}>{linkLabel}</span>
                    </div>
                    <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </SignedIn>
    </div>
  );
}
