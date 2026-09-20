import { describe, it, expect, vi } from "vitest";
import { getDashboardData } from "../convex/dashboard";
import type { QueryCtx } from "../convex/_generated/server";

type DashboardData = {
  reviewCount: number;
  safeToSpend: { pendingExpensesCents: number; pendingIncomeCents: number };
  periodComparison: {
    current: { incomeCents: number; expenseCents: number };
    previous: { incomeCents: number; expenseCents: number };
  };
};

const run = (
  getDashboardData as unknown as {
    _handler: (ctx: QueryCtx, args: unknown) => Promise<DashboardData>;
  }
)._handler;

type Row = Record<string, unknown>;

/**
 * Serves entries by the date window each query asks for, so the handler's own
 * period arithmetic is what is under test rather than a stubbed answer.
 */
function context(entries: Row[]) {
  const windows: { start: number; end: number }[] = [];
  const db = {
    get: vi.fn().mockResolvedValue(null),
    query: vi.fn((table: string) => {
      let start = -Infinity;
      let end = Infinity;
      let pendingOnly = false;
      let reviewOnly = false;
      let excludeArchived = false;
      const index = {
        eq: vi.fn((field: string, value: unknown) => {
          if (field === "needsReview" && value === true) reviewOnly = true;
          return index;
        }),
        gte: vi.fn((_f: string, value: number) => ((start = value), index)),
        lte: vi.fn((_f: string, value: number) => ((end = value), index)),
        lt: vi.fn((_f: string, value: number) => ((end = value - 1), index)),
      };
      const predicate = {
        eq: vi.fn((field: string, value: unknown) => {
          if (field === "status" && value === "pending") pendingOnly = true;
          return true;
        }),
        neq: vi.fn((field: string, value: unknown) => {
          if (field === "isArchived" && value === true) excludeArchived = true;
          return true;
        }),
        and: vi.fn(() => true),
        or: vi.fn(() => true),
        lte: vi.fn(() => true),
        gte: vi.fn(() => true),
        lt: vi.fn(() => true),
        gt: vi.fn(() => true),
        field: vi.fn((name: string) => name),
      };
      const chain = {
        withIndex: vi.fn((_name: string, fn: (q: typeof index) => unknown) => (fn(index), chain)),
        filter: vi.fn((fn: (q: typeof predicate) => unknown) => (fn(predicate), chain)),
        order: vi.fn(() => chain),
        take: vi.fn(async () => []),
        first: vi.fn(async () => null),
        collect: vi.fn(async () => {
          if (table !== "entries") return [];
          if (!reviewOnly) windows.push({ start, end });
          return entries.filter((entry) => {
            const date = entry.date as number;
            if (!reviewOnly && (date < start || date > end)) return false;
            if (pendingOnly && entry.status !== "pending") return false;
            if (reviewOnly && entry.needsReview !== true) return false;
            if (excludeArchived && entry.isArchived === true) return false;
            return true;
          });
        }),
      };
      return chain;
    }),
  };
  const ctx = {
    auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: "owner" }) },
    db,
  } as unknown as QueryCtx;
  return { ctx, windows };
}

const income = (date: number, extra: Row = {}): Row =>
  ({ _id: `i${date}`, type: "income", amountCents: 100000, date, needsReview: false, ...extra });
const expense = (date: number, extra: Row = {}): Row =>
  ({ _id: `e${date}`, type: "expense", amountCents: 30000, date, needsReview: false, ...extra });

const period = { periodStart: 1000, periodEnd: 2000 };

describe("Dashboard period totals", () => {
  it("leaves archived transactions out of the current period", async () => {
    const { ctx } = context([expense(1500), expense(1600, { isArchived: true })]);
    const data = await run(ctx, period);
    expect(data.periodComparison.current.expenseCents).toBe(30000);
  });

  it("does not count pending charges twice", async () => {
    const { ctx } = context([expense(1500, { status: "pending" })]);
    const data = await run(ctx, period);
    expect(data.periodComparison.current.expenseCents).toBe(0);
    expect(data.safeToSpend.pendingExpensesCents).toBe(30000);
  });

  it("keeps transfers out of income and expense", async () => {
    const { ctx } = context([
      income(1500),
      expense(1600, { excludeFromTotals: true, type: "transfer" }),
    ]);
    const data = await run(ctx, period);
    expect(data.periodComparison.current.incomeCents).toBe(100000);
    expect(data.periodComparison.current.expenseCents).toBe(0);
  });

  it("nets refunds out of period spending", async () => {
    const { ctx } = context([expense(1500), expense(1600, { entryType: "refund", amountCents: 5000 })]);
    const data = await run(ctx, period);
    expect(data.periodComparison.current.expenseCents).toBe(25000);
  });

  it("compares against the caller's previous period, not an assumed one", async () => {
    const { ctx, windows } = context([]);
    await run(ctx, { ...period, prevPeriodStart: 50, prevPeriodEnd: 400 });
    expect(windows).toContainEqual({ start: 50, end: 400 });
  });

  it("falls back to an equal-length window when no comparison is given", async () => {
    const { ctx, windows } = context([]);
    await run(ctx, period);
    expect(windows).toContainEqual({ start: 0, end: 999 });
  });

  it("keeps archived transactions out of the review count", async () => {
    const { ctx } = context([
      expense(1500, { needsReview: true }),
      expense(1600, { needsReview: true, isArchived: true }),
    ]);
    const data = await run(ctx, period);
    expect(data.reviewCount).toBe(1);
  });
});
