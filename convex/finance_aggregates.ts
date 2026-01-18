import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

export type MonthInput = { year: number; month: number };

type Ctx = QueryCtx | MutationCtx;

type CashflowResult = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

type SpendByCategoryRow = {
  category: string;
  amountCents: number;
};

type UpcomingBill = {
  name: string;
  expectedDate: number;
  expectedAmountCents?: number;
};

type Anomaly = {
  category: string;
  recentAverageCents: number;
  baselineAverageCents: number;
  deltaCents: number;
  reason: string;
};

type DrilldownItem = {
  date: number;
  amountCents: number;
  type: "expense" | "income" | "transfer";
  category?: string;
  merchant?: string;
  entryType?: string;
};

function getMonthBounds(month: MonthInput): { start: number; end: number } {
  const start = Date.UTC(month.year, month.month - 1, 1, 0, 0, 0, 0);
  const end = Date.UTC(month.year, month.month, 1, 0, 0, 0, 0);
  return { start, end };
}

function resolveCategory(entry: { category?: string | null; bucket?: string | null }): string {
  return (entry.category ?? entry.bucket ?? "Uncategorized").trim() || "Uncategorized";
}

function shouldCountCashflow(entry: {
  type: "expense" | "income" | "transfer";
  excludeFromTotals?: boolean;
  excludeFromCashFlow?: boolean;
  entryType?: string | null;
  status?: string | null;
}): boolean {
  if (entry.excludeFromTotals) return false;
  if (entry.excludeFromCashFlow) return false;
  if (entry.type === "transfer") return false;
  if (entry.entryType === "transfer" || entry.entryType === "payment") return false;
  if (entry.status && entry.status !== "posted") return false;
  return true;
}

export async function computeMonthlyCashflow(
  ctx: Ctx,
  userId: string,
  month: MonthInput
): Promise<CashflowResult> {
  const { start, end } = getMonthBounds(month);
  const rows = await ctx.db
    .query("entries")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", start).lt("date", end))
    .order("desc")
    .take(5000);

  let incomeCents = 0;
  let expenseCents = 0;

  for (const entry of rows) {
    if (!shouldCountCashflow(entry)) continue;
    if (entry.type === "income") incomeCents += entry.amountCents;
    if (entry.type === "expense") expenseCents += entry.amountCents;
  }

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
  };
}

export async function computeSpendByCategory(
  ctx: Ctx,
  userId: string,
  month: MonthInput
): Promise<SpendByCategoryRow[]> {
  const { start, end } = getMonthBounds(month);
  const rows = await ctx.db
    .query("entries")
    .withIndex("by_user_type_date", (q) =>
      q.eq("userId", userId).eq("type", "expense").gte("date", start).lt("date", end)
    )
    .order("desc")
    .take(5000);

  const totals = new Map<string, number>();

  for (const entry of rows) {
    if (!shouldCountCashflow(entry)) continue;
    const category = resolveCategory(entry);
    totals.set(category, (totals.get(category) ?? 0) + entry.amountCents);
  }

  return [...totals.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export async function computeUpcomingBills(
  ctx: Ctx,
  userId: string,
  horizonDays: number
): Promise<UpcomingBill[]> {
  const now = Date.now();
  const end = now + horizonDays * DAY_MS;

  const rows = await ctx.db
    .query("expectedCharges")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("expectedDate", now).lt("expectedDate", end)
    )
    .order("asc")
    .take(200);

  const active = rows.filter((row) => row.state === "upcoming" || row.state === "due");
  const ruleIds = Array.from(new Set(active.map((row) => row.ruleId)));
  const ruleRows = await Promise.all(ruleIds.map((id) => ctx.db.get(id)));
  const ruleMap = new Map(ruleRows.filter(Boolean).map((rule) => [rule!._id, rule!]));

  return active
    .map((row) => {
      const rule = ruleMap.get(row.ruleId);
      const name = (rule?.displayName ?? rule?.name ?? "Upcoming bill").trim() || "Upcoming bill";
      return {
        name,
        expectedDate: row.expectedDate,
        expectedAmountCents: row.expectedAmountCents ?? undefined,
      };
    })
    .sort((a, b) => a.expectedDate - b.expectedDate);
}

export async function computeAnomalies(ctx: Ctx, userId: string): Promise<Anomaly[]> {
  const now = Date.now();
  const recentStart = now - 30 * DAY_MS;
  const baselineStart = now - 120 * DAY_MS;

  const rows = await ctx.db
    .query("entries")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("date", baselineStart).lt("date", now)
    )
    .order("desc")
    .take(5000);

  const recentTotals = new Map<string, { sum: number; count: number }>();
  const baselineTotals = new Map<string, { sum: number; count: number }>();

  for (const entry of rows) {
    if (entry.type !== "expense") continue;
    if (!shouldCountCashflow(entry)) continue;
    const category = resolveCategory(entry);
    const target = entry.date >= recentStart ? recentTotals : baselineTotals;
    const current = target.get(category) ?? { sum: 0, count: 0 };
    current.sum += entry.amountCents;
    current.count += 1;
    target.set(category, current);
  }

  const anomalies: Anomaly[] = [];

  for (const [category, recent] of recentTotals.entries()) {
    const baseline = baselineTotals.get(category);
    if (!baseline || baseline.count < 3 || recent.count < 2) continue;

    const recentAvg = Math.round(recent.sum / Math.max(1, recent.count));
    const baselineAvg = Math.round(baseline.sum / Math.max(1, baseline.count));
    if (baselineAvg <= 0) continue;

    const delta = recentAvg - baselineAvg;
    if (recentAvg >= baselineAvg * 2 && delta >= 5000) {
      anomalies.push({
        category,
        recentAverageCents: recentAvg,
        baselineAverageCents: baselineAvg,
        deltaCents: delta,
        reason: "Recent average spend is materially higher than prior baseline.",
      });
    }
  }

  return anomalies.sort((a, b) => b.deltaCents - a.deltaCents).slice(0, 5);
}

function includesKeyword(value: string | undefined | null, keyword: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(keyword);
}

function isTransferLike(entry: Doc<"entries">): boolean {
  if (entry.type === "transfer") return true;
  if (entry.entryType === "transfer") return true;
  const category = resolveCategory(entry).toLowerCase();
  if (category.includes("transfer")) return true;
  if (entry.tags?.some((tag) => tag.includes("transfer"))) return true;
  return false;
}

function isFeeLike(entry: Doc<"entries">): boolean {
  if (entry.entryType === "fee") return true;
  const category = resolveCategory(entry).toLowerCase();
  return category.includes("fee") || category.includes("fees");
}

function isCashLike(entry: Doc<"entries">): boolean {
  return (
    includesKeyword(entry.merchantNormalized, "atm") ||
    includesKeyword(entry.merchant, "atm") ||
    includesKeyword(entry.note, "cash") ||
    includesKeyword(entry.title, "cash")
  );
}

export async function computeTransactionDrilldown(
  ctx: Ctx,
  userId: string,
  windowDays: number
): Promise<DrilldownItem[]> {
  const now = Date.now();
  const start = now - windowDays * DAY_MS;
  const rows = await ctx.db
    .query("entries")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", start).lt("date", now))
    .order("desc")
    .take(500);

  const flagged = rows.filter((entry) => {
    if (entry.type !== "expense" && entry.type !== "income" && entry.type !== "transfer") return false;
    if (isTransferLike(entry)) return true;
    if (isFeeLike(entry)) return true;
    if (isCashLike(entry)) return true;
    if (entry.entryType === "refund") return true;
    return false;
  });

  const largestExpenses = rows
    .filter((entry) => entry.type === "expense" && !isTransferLike(entry))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 12);

  const combined = new Map<string, Doc<"entries">>();
  for (const entry of [...flagged, ...largestExpenses]) {
    combined.set(entry._id, entry);
  }

  return [...combined.values()]
    .sort((a, b) => b.date - a.date)
    .slice(0, 25)
    .map((entry) => ({
      date: entry.date,
      amountCents: entry.amountCents,
      type: entry.type,
      category: resolveCategory(entry),
      merchant: entry.merchantNormalized ?? entry.merchant ?? undefined,
      entryType: entry.entryType ?? undefined,
    }));
}
