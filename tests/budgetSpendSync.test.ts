import { describe, it, expect, vi } from "vitest";
import { recomputeBudgetPeriod } from "../convex/budgetEngine";
import type { MutationCtx } from "../convex/_generated/server";

const recompute = (
  recomputeBudgetPeriod as unknown as {
    _handler: (ctx: MutationCtx, args: unknown) => Promise<unknown>;
  }
)._handler;

const period = {
  _id: "period",
  userId: "owner",
  planId: "plan",
  periodStart: 0,
  periodEnd: 1000,
  budgetedCents: 50000,
  carryInCents: 0,
};
const plan = { _id: "plan", userId: "owner", planType: "category", budgetCategoryId: "cat" };

function context(entries: Record<string, unknown>[]) {
  const chain = {
    withIndex: vi.fn(),
    collect: vi.fn(),
  };
  chain.withIndex.mockReturnValue(chain);
  const db = {
    get: vi.fn(async (id: string) => (id === "period" ? period : id === "plan" ? plan : null)),
    query: vi.fn((table: string) => {
      chain.collect.mockResolvedValue(table === "entries" ? entries : []);
      return chain;
    }),
    patch: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  return { ctx: { db } as unknown as MutationCtx, db };
}

const spend = (extra: Record<string, unknown> = {}) => ({
  _id: `e${Math.random()}`,
  userId: "owner",
  type: "expense",
  amountCents: 10000,
  date: 100,
  budgetCategoryId: "cat",
  ...extra,
});

async function spentFor(entries: Record<string, unknown>[]): Promise<number> {
  const c = context(entries);
  await recompute(c.ctx, { periodId: "period" });
  const call = c.db.patch.mock.calls.find(([id]) => id === "period");
  return (call?.[1] as { spentCents: number }).spentCents;
}

describe("Budget period spend", () => {
  it("counts ordinary posted expenses", async () => {
    expect(await spentFor([spend(), spend()])).toBe(20000);
  });

  it("releases spend when a transaction is archived", async () => {
    expect(await spentFor([spend(), spend({ isArchived: true })])).toBe(10000);
  });

  it("leaves pending charges out until they post", async () => {
    expect(await spentFor([spend({ status: "pending" })])).toBe(0);
  });

  it("honours the ignoredForBudgets flag the schema exposes", async () => {
    expect(await spentFor([spend({ ignoredForBudgets: true })])).toBe(0);
    expect(await spentFor([spend({ excludeFromBudgets: true })])).toBe(0);
  });

  it("subtracts refunds from the category they were charged to", async () => {
    expect(await spentFor([spend(), spend({ entryType: "refund", amountCents: 2500 })])).toBe(7500);
  });

  it("ignores transfers and card payments", async () => {
    expect(await spentFor([spend({ entryType: "payment" }), spend({ type: "transfer" })])).toBe(0);
  });

  it("records an impact row only for spend it actually counted", async () => {
    const c = context([spend(), spend({ isArchived: true })]);
    await recompute(c.ctx, { periodId: "period" });
    const impacts = c.db.insert.mock.calls.filter(([table]) => table === "budgetEntryImpacts");
    expect(impacts).toHaveLength(1);
  });
});
