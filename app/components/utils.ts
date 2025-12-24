export type EntryType = "expense" | "income";

export const DEFAULT_BUCKETS = ["Personal", "Work", "Household", "Side/Hustle", "Other"] as const;
export const DEFAULT_TAGS = ["Deductible", "Reimbursable", "Subscription", "Shared", "Medical"] as const;

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
