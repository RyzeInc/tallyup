import { resolveRange } from "@/src/lib/timeRange/resolve";
import type { PresetSelectionKey } from "@/src/lib/timeRange/types";

export type EntryType = "expense" | "income";

export const DEFAULT_BUCKETS = ["Personal", "Work", "Household", "Side/Hustle", "Other"] as const;
export const DEFAULT_TAGS = ["Deductible", "Reimbursable", "Subscription", "Shared", "Medical"] as const;

// Dynamic space options based on entry type
export const INCOME_SPACES = [
  "Wages & Salary",
  "Contract / Freelance",
  "Business Revenue",
  "Investment Income",
  "Transfers",
] as const;

export const EXPENSE_SPACES = [
  "Housing",
  "Utilities",
  "Food",
  "Transportation",
  "Health",
  "Insurance",
  "Debt",
  "Subscriptions",
  "Personal Care",
  "Entertainment",
  "Education",
  "Gifts & Giving",
  "Savings & Investing",
  "Miscellaneous",
] as const;

// Context tags - life/work/tax context (who/what flow)
export const CONTEXT_TAGS = [
  "Personal",
  "Shared",
  "Household",
  "Partner",
  "Dependent",
  "Business",
  "Client",
  "Reimbursable",
  "Tax-Deductible",
] as const;

// Intent tags - planning/volatility context (why/how)
export const INTENT_TAGS = [
  "Essential",
  "Discretionary",
  "Planned",
  "Unexpected",
  "One-time",
  "Recurring",
] as const;

export function dollarsToCents(input: string): number | null {
  const clean = input.replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

/**
 * Format money with options for sign display and negative formatting
 * @param cents - Amount in cents
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export type SignMode = "auto" | "always" | "never" | "accounting";
export interface FormatMoneyOptions {
  signMode?: SignMode; // 'auto' shows minus for negative, 'always' shows +/-, 'never' hides sign, 'accounting' uses parens
  compact?: boolean; // Use K/M suffixes for large amounts
}

export function formatMoney(cents: number, options: FormatMoneyOptions = {}): string {
  const { signMode = "auto", compact = false } = options;
  const abs = Math.abs(cents);
  const isNegative = cents < 0;

  let formatted: string;
  
  if (compact && abs >= 100000) { // $1000+
    if (abs >= 10000000) { // $100K+
      formatted = `$${(abs / 10000000).toFixed(1)}M`;
    } else {
      formatted = `$${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}K`;
    }
  } else {
    formatted = `$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  switch (signMode) {
    case "always":
      return isNegative ? `-${formatted}` : `+${formatted}`;
    case "never":
      return formatted;
    case "accounting":
      return isNegative ? `(${formatted})` : formatted;
    case "auto":
    default:
      return isNegative ? `-${formatted}` : formatted;
  }
}

/**
 * Format a timestamp as a relative date label (Today, Yesterday, or formatted date)
 * @param ms - Timestamp in milliseconds
 * @param options - Formatting options
 * @returns Formatted date string
 */
export interface FormatDateOptions {
  includeTime?: boolean;
  relative?: boolean; // Use "Today", "Yesterday" for recent dates
  format?: "short" | "medium" | "long"; // Dec 26 vs December 26 vs December 26, 2024
}

export function formatDateLabel(ms: number, options: FormatDateOptions = {}): string {
  const { includeTime = false, relative = true, format = "short" } = options;
  const date = new Date(ms);
  const now = new Date();
  
  // Get midnight timestamps for comparison
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayMidnight = todayMidnight - 86400000;
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  let dateStr: string;

  if (relative && dateMidnight === todayMidnight) {
    dateStr = "Today";
  } else if (relative && dateMidnight === yesterdayMidnight) {
    dateStr = "Yesterday";
  } else {
    const formatOptions: Intl.DateTimeFormatOptions = 
      format === "long" 
        ? { month: "long", day: "numeric", year: "numeric" }
        : format === "medium"
        ? { month: "long", day: "numeric" }
        : { month: "short", day: "numeric" };
    
    // Add year if not current year
    if (date.getFullYear() !== now.getFullYear() && format !== "long") {
      formatOptions.year = "numeric";
    }
    
    dateStr = date.toLocaleDateString("en-US", formatOptions);
  }

  if (includeTime) {
    const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${dateStr} at ${timeStr}`;
  }

  return dateStr;
}

/**
 * Format a date for grouping (Week of Dec 23, December 2024, etc.)
 */
export function formatGroupDate(ms: number, groupBy: "day" | "week" | "month" | "year"): string {
  const date = new Date(ms);
  
  switch (groupBy) {
    case "day":
      return formatDateLabel(ms);
    case "week": {
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - day);
      return `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    case "month":
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    case "year":
      return date.getFullYear().toString();
    default:
      return formatDateLabel(ms);
  }
}

export function todayYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function yyyymmddToLocalMidnightTs(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}

export function startOfWeekLocalTs(now = new Date()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonthLocalTs(now = new Date()): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfYearLocalTs(now = new Date()): number {
  const d = new Date(now);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function uniqCaseInsensitive(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const t = (v ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function cacheKey(userId: string, type: EntryType, bucket?: string) {
  const b = (bucket ?? "all").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `tallyup_categories_${userId}_${type}_${b}`;
}

export type DateRangePreset = PresetSelectionKey;

function formatYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDateRangeFromPreset(
  preset: DateRangePreset,
  now: Date = new Date()
): { from: string; to: string; fromMs: number; toMs: number } {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const range = resolveRange({ kind: "preset", key: preset }, now, timezone);
  const inclusiveTo = new Date(range.to.getTime() - 86400000);
  return {
    from: formatYYYYMMDD(range.from),
    to: formatYYYYMMDD(inclusiveTo),
    fromMs: range.from.getTime(),
    toMs: range.to.getTime(),
  };
}
