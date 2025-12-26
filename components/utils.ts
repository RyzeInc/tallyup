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

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "week"
  | "last-week"
  | "month"
  | "last-month"
  | "year"
  | "last-year"
  | "custom";

export interface DateRange {
  startDate: number;
  endDate: number;
  label: string;
}

export function getDateRangeFromPreset(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  switch (preset) {
    case "today":
      return { startDate: todayStart, endDate: Date.now() + 1, label: "Today" };

    case "yesterday": {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return { startDate: start, endDate: end, label: "Yesterday" };
    }

    case "week":
      return { startDate: startOfWeekLocalTs(now), endDate: Date.now() + 1, label: "This Week" };

    case "last-week": {
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      const start = startOfWeekLocalTs(lastWeekDate);
      const end = start + 7 * 24 * 60 * 60 * 1000;
      return { startDate: start, endDate: end, label: "Last Week" };
    }

    case "month":
      return { startDate: startOfMonthLocalTs(now), endDate: Date.now() + 1, label: "This Month" };

    case "last-month": {
      const lastMonthDate = new Date(now);
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const start = startOfMonthLocalTs(lastMonthDate);
      const endMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startDate: start, endDate: endMonth, label: "Last Month" };
    }

    case "year":
      return { startDate: startOfYearLocalTs(now), endDate: Date.now() + 1, label: "This Year" };

    case "last-year": {
      const lastYearDate = new Date(now);
      lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
      const start = startOfYearLocalTs(lastYearDate);
      const end = new Date(now.getFullYear(), 0, 1).getTime();
      return { startDate: start, endDate: end, label: "Last Year" };
    }

    case "custom":
    default: {
      const s = yyyymmddToLocalMidnightTs(customFrom ?? todayYYYYMMDD());
      const e = yyyymmddToLocalMidnightTs(customTo ?? todayYYYYMMDD()) + 24 * 60 * 60 * 1000;
      return { startDate: Math.min(s, e), endDate: Math.max(s, e), label: `${customFrom} – ${customTo}` };
    }
  }
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
