"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { centsToDollars, CONTEXT_TAGS } from "@/components/utils";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useTimeRange } from "@/components/TimeRangeProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTabs } from "@/components/PersistentTabs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
  methodOrAccount?: string;
  needsReview?: boolean;
  recurringRuleId?: string;
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

interface AlertItem {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  severity: "warning" | "info" | "danger";
  title: string;
  description: string;
  link: string;
}

interface RecurringRule {
  _id: string;
  type: "expense" | "income";
  displayName?: string;
  category?: string;
  bucket?: string;
  amountCents?: number;
  minAmountCents?: number;
  maxAmountCents?: number;
  cadenceType?: string;
  active: boolean;
  confidence: number;
  lastMatchedAt?: number;
}

interface RecurringPatternDisplay {
  id: string;
  name: string;
  type: "expense" | "income";
  amount: string;
  cadence: string;
  matchCount: number;
  sparklineData: number[];
  lastSeen: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MIN_DAYS_FOR_TRENDS = 7;
const MIN_TRANSACTIONS_FOR_INSIGHT = 5;
const INSIGHT_MIN_DELTA_CENTS = 5000; // $50
const INSIGHT_MIN_PERCENT = 15;

const CHART_COLORS = [
  "#2F6F85", "#6F9EA8", "#10B981", "#F59E0B", "#EC4899", 
  "#C87A5A", "#F97316", "#84CC16", "#EF4444", "#3B82F6"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const router = useRouter();
  const { setActiveTab } = useTabs();
  const { startDate, endDate, label, prevStartDate, prevEndDate, prevLabel } = useTimeRange();
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showNetOnly, setShowNetOnly] = useState(false);
  const [lensSheetOpen, setLensSheetOpen] = useState(false);
  
  // Tooltip state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Drill-down navigation: navigate to Activity with pre-applied filters
  const drillDown = useCallback((filters: {
    type?: "income" | "expense";
    category?: string;
    tag?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.category) params.set("category", filters.category);
    if (filters.tag) params.set("tag", filters.tag);
    
    // Navigate to activity tab with filters
    const url = params.toString() ? `/activity?${params.toString()}` : "/activity";
    router.push(url);
    setActiveTab("activity");
  }, [router, setActiveTab]);

  // Data
  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 2000 }) as Entry[] | undefined;
  const prevEntries = useQuery(api.entries.listEntries, { startDate: prevStartDate, endDate: prevEndDate, limit: 2000 }) as Entry[] | undefined;
  const recurringRules = useQuery(api.recurring.listRecurringRules, { limit: 50 }) as RecurringRule[] | undefined;

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
    const tagSpend = new Map<string, number>();
    const paymentMethodSpend = new Map<string, number>();
    const dayOfWeekSpend = new Map<number, number>(); // 0-6
    const dayOfMonthSpend = new Map<number, number>(); // 1-31
    let largestExpense = { amount: 0, note: "", category: "", id: "" };
    let reimbursableOutstanding = 0;
    let needsReviewCount = 0;
    let recurringCount = 0;

    for (const e of all) {
      if (e.type === "income") {
        income += e.amountCents;
      } else {
        expense += e.amountCents;
        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);
        categoryCount.set(c, (categoryCount.get(c) ?? 0) + 1);

        if (e.amountCents > largestExpense.amount) {
          largestExpense = { amount: e.amountCents, note: e.note ?? "", category: c, id: e._id };
        }

        // Tag breakdown
        if (e.tags?.length) {
          for (const tag of e.tags) {
            tagSpend.set(tag, (tagSpend.get(tag) ?? 0) + e.amountCents);
          }
        } else {
          tagSpend.set("Untagged", (tagSpend.get("Untagged") ?? 0) + e.amountCents);
        }

        // Reimbursable
        if (e.tags?.includes("Reimbursable")) {
          reimbursableOutstanding += e.amountCents;
        }

        // Payment method
        const method = (e.methodOrAccount ?? "Unknown").trim() || "Unknown";
        paymentMethodSpend.set(method, (paymentMethodSpend.get(method) ?? 0) + e.amountCents);

        // Day of week
        const d = new Date(e.date);
        const dow = d.getDay();
        dayOfWeekSpend.set(dow, (dayOfWeekSpend.get(dow) ?? 0) + e.amountCents);

        // Day of month
        const dom = d.getDate();
        dayOfMonthSpend.set(dom, (dayOfMonthSpend.get(dom) ?? 0) + e.amountCents);
      }

      // Counts
      if (e.needsReview) needsReviewCount++;
      if (e.recurringRuleId) recurringCount++;
    }

    const net = income - expense;
    const topCategory = [...categorySpend.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["None", 0];

    // Top categories for charts
    const topCategories = [...categorySpend.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, amount], i) => ({ name, amount, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Top tags for charts
    const topTags = [...tagSpend.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, amount], i) => ({ name, amount, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Payment methods for charts
    const topPaymentMethods = [...paymentMethodSpend.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount], i) => ({ name, amount, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Day of week data (sorted Sun-Sat)
    const dayOfWeekData = DAY_NAMES.map((name, i) => ({
      name,
      amount: dayOfWeekSpend.get(i) ?? 0,
    }));

    // Day of month data
    const dayOfMonthData = Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      amount: dayOfMonthSpend.get(i + 1) ?? 0,
    }));

    return {
      income,
      expense,
      net,
      topCategory: { name: topCategory[0], amount: topCategory[1] },
      largestExpense,
      reimbursableOutstanding,
      categorySpend,
      categoryCount,
      tagSpend,
      paymentMethodSpend,
      topCategories,
      topTags,
      topPaymentMethods,
      dayOfWeekData,
      dayOfMonthData,
      needsReviewCount,
      recurringCount,
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
  // Alerts & Guardrails
  // ─────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const items: AlertItem[] = [];

    // 1. Needs review items
    if (computed.needsReviewCount > 0) {
      items.push({
        id: "needs-review",
        icon: Lucide.AlertCircle,
        severity: "warning",
        title: `${computed.needsReviewCount} item${computed.needsReviewCount > 1 ? "s" : ""} need review`,
        description: "Uncategorized transactions awaiting classification",
        link: "/inbox",
      });
    }

    // 2. Large single expense (outlier detection)
    if (computed.largestExpense.amount > 0) {
      const avgExpense = computed.expense / Math.max(1, computed.transactionCount);
      if (computed.largestExpense.amount > avgExpense * 5 && computed.largestExpense.amount >= 10000) {
        items.push({
          id: "large-expense",
          icon: Lucide.AlertTriangle,
          severity: "info",
          title: `Large expense: ${centsToDollars(computed.largestExpense.amount)}`,
          description: computed.largestExpense.category,
          link: "/activity?type=expense",
        });
      }
    }

    // 3. No income in period
    if (computed.income === 0 && computed.expense > 0 && daysInRange >= 7) {
      items.push({
        id: "no-income",
        icon: Lucide.TrendingDown,
        severity: "danger",
        title: "No income recorded",
        description: `No income logged in ${label}`,
        link: "/log",
      });
    }

    // 4. Spending spike vs previous period
    if (prevComputed.expense > 0 && computed.expense > prevComputed.expense * 1.5) {
      items.push({
        id: "spending-spike",
        icon: Lucide.Flame,
        severity: "warning",
        title: "Spending spike detected",
        description: `+${((computed.expense / prevComputed.expense - 1) * 100).toFixed(0)}% vs ${prevLabel}`,
        link: "/activity?type=expense",
      });
    }

    return items.slice(0, 4);
  }, [computed, prevComputed, daysInRange, label, prevLabel]);

  // ─────────────────────────────────────────────────────────────
  // Recent Activity (last 10 transactions)
  // ─────────────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);
  }, [entries]);

  // ─────────────────────────────────────────────────────────────
  // Category pie chart data
  // ─────────────────────────────────────────────────────────────
  const categoryPieData = useMemo(() => {
    if (computed.topCategories.length === 0) return [];
    const total = computed.topCategories.reduce((sum, c) => sum + c.amount, 0);
    return computed.topCategories.map((c) => ({
      ...c,
      percent: total > 0 ? Math.round((c.amount / total) * 100) : 0,
    }));
  }, [computed.topCategories]);

  // ─────────────────────────────────────────────────────────────
  // Recurring Patterns for sparkline widget
  // ─────────────────────────────────────────────────────────────
  const recurringPatterns = useMemo((): RecurringPatternDisplay[] => {
    if (!recurringRules || !entries) return [];

    // Build entry lookup by recurringRuleId
    const entriesByRule = new Map<string, Entry[]>();
    for (const entry of entries) {
      if (entry.recurringRuleId) {
        const arr = entriesByRule.get(entry.recurringRuleId) || [];
        arr.push(entry);
        entriesByRule.set(entry.recurringRuleId, arr);
      }
    }

    const patterns: RecurringPatternDisplay[] = [];

    for (const rule of recurringRules) {
      const linkedEntries = entriesByRule.get(rule._id) || [];
      const matchCount = linkedEntries.length;

      // Name: prefer displayName, fallback to category/bucket
      const name = rule.displayName || rule.category || rule.bucket || "Unnamed Pattern";

      // Amount: prefer amountCents, else derive from linked entries average
      let amountStr = "—";
      if (rule.amountCents) {
        amountStr = centsToDollars(rule.amountCents);
      } else if (linkedEntries.length > 0) {
        const avgCents = Math.round(linkedEntries.reduce((s, e) => s + e.amountCents, 0) / linkedEntries.length);
        amountStr = "~" + centsToDollars(avgCents);
      }

      // Cadence label
      const cadenceMap: Record<string, string> = {
        weekly: "Weekly",
        biweekly: "Bi-weekly",
        semiMonthly: "Semi-monthly",
        monthly: "Monthly",
        quarterly: "Quarterly",
        yearly: "Yearly",
        custom: "Custom",
      };
      const cadence = rule.cadenceType ? cadenceMap[rule.cadenceType] || rule.cadenceType : "—";

      // Sparkline data: last 6 amounts from linked entries (sorted by date)
      const sortedLinked = [...linkedEntries].sort((a, b) => a.date - b.date);
      const last6 = sortedLinked.slice(-6);
      const sparklineData = last6.map((e) => e.amountCents);
      // Pad with zeros if fewer than 6
      while (sparklineData.length < 6) sparklineData.unshift(0);

      // Last seen (use endDate as reference point for stability)
      let lastSeen = "Never";
      if (linkedEntries.length > 0) {
        const mostRecent = Math.max(...linkedEntries.map((e) => e.date));
        const daysDiff = Math.round((endDate - mostRecent) / (24 * 60 * 60 * 1000));
        if (daysDiff <= 0) lastSeen = "Today";
        else if (daysDiff === 1) lastSeen = "Yesterday";
        else if (daysDiff < 7) lastSeen = `${daysDiff}d ago`;
        else if (daysDiff < 30) lastSeen = `${Math.round(daysDiff / 7)}w ago`;
        else lastSeen = `${Math.round(daysDiff / 30)}mo ago`;
      } else if (rule.lastMatchedAt) {
        const daysDiff = Math.round((endDate - rule.lastMatchedAt) / (24 * 60 * 60 * 1000));
        if (daysDiff <= 0) lastSeen = "Today";
        else if (daysDiff === 1) lastSeen = "Yesterday";
        else if (daysDiff < 7) lastSeen = `${daysDiff}d ago`;
        else if (daysDiff < 30) lastSeen = `${Math.round(daysDiff / 7)}w ago`;
        else lastSeen = `${Math.round(daysDiff / 30)}mo ago`;
      }

      patterns.push({
        id: rule._id,
        name,
        type: rule.type,
        amount: amountStr,
        cadence,
        matchCount,
        sparklineData,
        lastSeen,
      });
    }

    // Sort by match count (more matches first), take top 5
    return patterns.sort((a, b) => b.matchCount - a.matchCount).slice(0, 5);
  }, [recurringRules, entries, endDate]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingBottom: "96px" }}>
      {/* Header */}
      <PageHeader
        title="Insights"
        subtitle={`${label} at a glance`}
        rightSlot={<GlobalDateRangePicker showAllPresets />}
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
            Sign in to view your insights
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {!entries ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ height: "96px", borderRadius: "var(--card-radius)", backgroundColor: "var(--surface-2)" }} className="animate-pulse" />
            <div style={{ height: "192px", borderRadius: "var(--card-radius)", backgroundColor: "var(--surface-2)" }} className="animate-pulse" />
            <div style={{ height: "256px", borderRadius: "var(--card-radius)", backgroundColor: "var(--surface-2)" }} className="animate-pulse" />
          </div>
        ) : (
          <>
            {/* ─────────────────────────────────────────────────────────────
                Global Filters Bar
            ───────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {/* Type filter - Segmented Control */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "4px",
                  padding: "4px",
                  backgroundColor: "var(--surface)",
                  borderRadius: "var(--input-radius)",
                  border: "1px solid var(--border)",
                }}
              >
                {(["all", "income", "expense"] as TypeFilter[]).map((t) => {
                  const isActive = typeFilter === t;
                  const Icon = t === "income" ? Lucide.ArrowDownLeft : t === "expense" ? Lucide.ArrowUpRight : Lucide.LayoutGrid;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "10px 12px",
                        borderRadius: "calc(var(--input-radius) - 4px)",
                        fontSize: "var(--text-meta)",
                        fontWeight: 500,
                        cursor: "pointer",
                        border: "none",
                        transition: "all 150ms ease",
                        backgroundColor: isActive ? "var(--primary)" : "transparent",
                        color: isActive ? "var(--primary-foreground)" : "var(--text)",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                A. "This Period At a Glance" - KPI Tiles
            ───────────────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              {/* Income */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => drillDown({ type: "income" })}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--card-radius)",
                    border: "1px solid var(--border)",
                    padding: "var(--space-3)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "var(--text-micro)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
                      Income
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === "income" ? null : "income");
                      }}
                      style={{ padding: "2px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                    >
                      <Lucide.Info className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "var(--text-xl)",
                      fontWeight: 600,
                      color: "var(--success)",
                      fontFeatureSettings: "'tnum' 1",
                    }}
                  >
                    {centsToDollars(computed.income)}
                  </div>
                  {prevEntries && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "var(--text-micro)",
                        marginTop: "4px",
                        color: deltas.income.direction === "up" ? "var(--success)" : deltas.income.direction === "down" ? "var(--danger)" : "var(--text-tertiary)",
                      }}
                    >
                      {deltas.income.direction === "up" && <Lucide.TrendingUp className="h-3 w-3" />}
                      {deltas.income.direction === "down" && <Lucide.TrendingDown className="h-3 w-3" />}
                      <span>{deltas.income.dollar}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>({deltas.income.percent})</span>
                    </div>
                  )}
                </button>
                <KpiTooltip
                  open={activeTooltip === "income"}
                  onClose={() => setActiveTooltip(null)}
                  title="Income"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div>Sum of all income transactions in period</div>
                    <div style={{ fontWeight: 500, color: "var(--text)" }}>
                      {prevLabel}: {centsToDollars(prevComputed.income)}
                    </div>
                  </div>
                </KpiTooltip>
              </div>

              {/* Expenses */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => drillDown({ type: "expense" })}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--card-radius)",
                    border: "1px solid var(--border)",
                    padding: "var(--space-3)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "var(--text-micro)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
                      Expenses
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === "expenses" ? null : "expenses");
                      }}
                      style={{ padding: "2px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                    >
                      <Lucide.Info className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "var(--text-xl)",
                      fontWeight: 600,
                      color: "var(--danger)",
                      fontFeatureSettings: "'tnum' 1",
                    }}
                  >
                    {centsToDollars(computed.expense)}
                  </div>
                  {prevEntries && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "var(--text-micro)",
                        marginTop: "4px",
                        color: deltas.expense.direction === "down" ? "var(--success)" : deltas.expense.direction === "up" ? "var(--danger)" : "var(--text-tertiary)",
                      }}
                    >
                      {deltas.expense.direction === "up" && <Lucide.TrendingUp className="h-3 w-3" />}
                      {deltas.expense.direction === "down" && <Lucide.TrendingDown className="h-3 w-3" />}
                      <span>{deltas.expense.dollar}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>({deltas.expense.percent})</span>
                    </div>
                  )}
                </button>
                <KpiTooltip
                  open={activeTooltip === "expenses"}
                  onClose={() => setActiveTooltip(null)}
                  title="Expenses"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div>Sum of all expense transactions in period</div>
                    <div style={{ fontWeight: 500, color: "var(--text)" }}>
                      {prevLabel}: {centsToDollars(prevComputed.expense)}
                    </div>
                  </div>
                </KpiTooltip>
              </div>

              {/* Net */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => drillDown({})}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--card-radius)",
                    border: "1px solid var(--border)",
                    padding: "var(--space-3)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "var(--text-micro)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>
                      Net
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === "net" ? null : "net");
                      }}
                      style={{ padding: "2px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                    >
                      <Lucide.Info className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "var(--text-xl)",
                      fontWeight: 600,
                      color: computed.net >= 0 ? "var(--success)" : "var(--danger)",
                      fontFeatureSettings: "'tnum' 1",
                    }}
                  >
                    {computed.net >= 0 ? "+" : ""}{centsToDollars(computed.net)}
                  </div>
                  {prevEntries && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "var(--text-micro)",
                        marginTop: "4px",
                        color: deltas.net.direction === "up" ? "var(--success)" : deltas.net.direction === "down" ? "var(--danger)" : "var(--text-tertiary)",
                      }}
                    >
                      {deltas.net.direction === "up" && <Lucide.TrendingUp className="h-3 w-3" />}
                      {deltas.net.direction === "down" && <Lucide.TrendingDown className="h-3 w-3" />}
                      <span>{deltas.net.dollar}</span>
                      <span style={{ color: "var(--text-tertiary)" }}>({deltas.net.percent})</span>
                    </div>
                  )}
                </button>
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
                <button
                  onClick={() => computed.topCategory.name !== "None" ? drillDown({ type: "expense", category: computed.topCategory.name }) : drillDown({})}
                  className="block w-full text-left rounded-xl border p-3 transition-colors hover:opacity-90"
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
                </button>
              </div>

              {/* Largest Expense */}
              <div className="relative">
                <button
                  onClick={() => drillDown({ type: "expense" })}
                  className="block w-full text-left rounded-xl border p-3 transition-colors hover:opacity-90"
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
                </button>
              </div>

              {/* Reimbursable Outstanding */}
              <div className="relative">
                <button
                  onClick={() => drillDown({ tag: "Reimbursable" })}
                  className="block w-full text-left rounded-xl border p-3 transition-colors hover:opacity-90"
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
                </button>
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
                D. Category Breakdown (Bar + Donut)
            ───────────────────────────────────────────────────────────── */}
            {computed.topCategories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Ranking (Horizontal Bar) */}
                <div
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Lucide.BarChart3 className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Top Categories
                    </span>
                  </div>
                  <div className="space-y-2">
                    {computed.topCategories.slice(0, 6).map((cat) => {
                      const maxAmt = computed.topCategories[0]?.amount ?? 1;
                      const pct = Math.round((cat.amount / maxAmt) * 100);
                      return (
                        <button
                          key={cat.name}
                          onClick={() => drillDown({ type: "expense", category: cat.name })}
                          className="block w-full text-left group"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span style={{ color: "var(--text)" }}>{cat.name}</span>
                            <span className="tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>
                              {centsToDollars(cat.amount)}
                            </span>
                          </div>
                          <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{ backgroundColor: "var(--surface-subtle)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all group-hover:opacity-80"
                              style={{ width: `${pct}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Share (Donut) */}
                <div
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Lucide.PieChart className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Spend Share
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={categoryPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="name"
                          onClick={(data: { name?: string }) => {
                            if (data?.name) {
                              drillDown({ type: "expense", category: data.name });
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {categoryPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--surface)",
                            borderColor: "var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number, name: string) => [centsToDollars(value), name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {categoryPieData.slice(0, 4).map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => drillDown({ type: "expense", category: cat.name })}
                        className="flex items-center gap-1.5 text-[10px] hover:opacity-80"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span style={{ color: "var(--text-secondary)" }}>{cat.name}</span>
                        <span style={{ color: "var(--text-tertiary)" }}>{cat.percent}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                E. Tag Lens Summary (Stacked Bar)
            ───────────────────────────────────────────────────────────── */}
            {computed.topTags.length > 0 && (
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lucide.Tags className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Spend by Tag
                    </span>
                  </div>
                </div>

                {/* Stacked horizontal bar */}
                <div
                  className="h-6 rounded-full overflow-hidden flex"
                  style={{ backgroundColor: "var(--surface-subtle)" }}
                >
                  {computed.topTags.map((tag) => {
                    const pct = computed.expense > 0 ? (tag.amount / computed.expense) * 100 : 0;
                    if (pct < 2) return null;
                    return (
                      <div
                        key={tag.name}
                        title={`${tag.name}: ${centsToDollars(tag.amount)}`}
                        style={{ width: `${pct}%`, backgroundColor: tag.color }}
                        className="h-full transition-opacity hover:opacity-80"
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3">
                  {computed.topTags.slice(0, 6).map((tag) => (
                    <Link
                      key={tag.name}
                      href={`/activity?tag=${encodeURIComponent(tag.name)}`}
                      className="flex items-center gap-1.5 text-xs hover:opacity-80"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span style={{ color: "var(--text)" }}>{tag.name}</span>
                      <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                        {centsToDollars(tag.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                F. Payment Method Mix
            ───────────────────────────────────────────────────────────── */}
            {computed.topPaymentMethods.length > 1 && (
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Lucide.CreditCard className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    Payment Methods
                  </span>
                </div>
                <div style={{ width: "100%", height: 160 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={computed.topPaymentMethods}
                      layout="vertical"
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "var(--surface)",
                          borderColor: "var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [centsToDollars(value), "Spent"]}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {computed.topPaymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                G. Timing Patterns (Day of Week + Day of Month)
            ───────────────────────────────────────────────────────────── */}
            {computed.transactionCount >= 5 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Day of Week */}
                <div
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Lucide.Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Day of Week
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 120 }}>
                    <ResponsiveContainer>
                      <BarChart data={computed.dayOfWeekData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
                        />
                        <YAxis hide />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--surface)",
                            borderColor: "var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number) => [centsToDollars(value), "Spent"]}
                        />
                        <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Day of Month */}
                <div
                  className="rounded-xl border p-4"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Lucide.CalendarDays className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Day of Month
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 120 }}>
                    <ResponsiveContainer>
                      <BarChart data={computed.dayOfMonthData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "var(--text-tertiary)", fontSize: 8 }}
                          interval={4}
                        />
                        <YAxis hide />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--surface)",
                            borderColor: "var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value: number) => [centsToDollars(value), "Spent"]}
                          labelFormatter={(label: number) => `Day ${label}`}
                        />
                        <Bar dataKey="amount" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                H. Alerts & Guardrails
            ───────────────────────────────────────────────────────────── */}
            {alerts.length > 0 && (
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Lucide.ShieldAlert className="h-4 w-4" style={{ color: "var(--warning)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    Alerts & Guardrails
                  </span>
                </div>
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const Icon = alert.icon;
                    const severityColor =
                      alert.severity === "danger" ? "var(--danger)" :
                      alert.severity === "warning" ? "var(--warning)" : "var(--accent)";
                    return (
                      <Link
                        key={alert.id}
                        href={alert.link}
                        className="flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                      >
                        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: severityColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                            {alert.title}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {alert.description}
                          </div>
                        </div>
                        <Lucide.ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                I. Recurring Patterns (sparkline widget)
            ───────────────────────────────────────────────────────────── */}
            {recurringPatterns.length > 0 && (
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lucide.Repeat className="h-4 w-4" style={{ color: "var(--accent)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Recurring Patterns
                    </span>
                  </div>
                  <Link
                    href="/recurring"
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Manage all
                  </Link>
                </div>
                <div className="space-y-3">
                  {recurringPatterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: pattern.type === "income" ? "var(--success-subtle)" : "var(--danger-subtle)",
                        }}
                      >
                        {pattern.type === "income" ? (
                          <Lucide.TrendingUp className="h-4 w-4" style={{ color: "var(--success)" }} />
                        ) : (
                          <Lucide.TrendingDown className="h-4 w-4" style={{ color: "var(--danger)" }} />
                        )}
                      </div>

                      {/* Name & cadence */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                          {pattern.name}
                        </div>
                        <div className="text-xs flex gap-2" style={{ color: "var(--text-secondary)" }}>
                          <span>{pattern.cadence}</span>
                          <span>·</span>
                          <span>{pattern.matchCount} matches</span>
                          <span>·</span>
                          <span>{pattern.lastSeen}</span>
                        </div>
                      </div>

                      {/* Sparkline (mini bar chart) */}
                      <div className="w-16 h-6 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={pattern.sparklineData.map((v, i) => ({ idx: i, val: v }))}
                            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                          >
                            <Bar
                              dataKey="val"
                              fill={pattern.type === "income" ? "var(--success)" : "var(--accent)"}
                              radius={[1, 1, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Amount */}
                      <div
                        className="text-sm font-semibold tabular-nums text-right flex-shrink-0 w-20"
                        style={{ color: pattern.type === "income" ? "var(--success)" : "var(--text)" }}
                      >
                        {pattern.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                J. Recent Activity
            ───────────────────────────────────────────────────────────── */}
            {recentActivity.length > 0 && (
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lucide.Clock className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      Recent Activity
                    </span>
                  </div>
                  <button
                    onClick={() => drillDown({})}
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-1">
                  {recentActivity.slice(0, 5).map((entry) => (
                    <button
                      key={entry._id}
                      onClick={() => drillDown({})}
                      className="flex items-center justify-between w-full py-2 px-1 rounded-lg transition-colors hover:bg-[var(--surface-subtle)] text-left"
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: entry.type === "income" ? "var(--success-subtle)" : "var(--danger-subtle)" }}
                        >
                          {entry.type === "income" ? (
                            <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                          ) : (
                            <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--danger)" }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm truncate" style={{ color: "var(--text)" }}>
                            {entry.category || entry.note || "Uncategorized"}
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                            {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        </div>
                      </div>
                      <div
                        className="text-sm font-medium tabular-nums"
                        style={{ color: entry.type === "income" ? "var(--success)" : "var(--text)" }}
                      >
                        {entry.type === "income" ? "+" : ""}{centsToDollars(entry.amountCents)}
                      </div>
                    </button>
                  ))}
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
