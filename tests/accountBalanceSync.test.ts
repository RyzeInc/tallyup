import { describe, it, expect, vi } from "vitest";
import { syncEntryBalance } from "../convex/entryEffects";
import type { MutationCtx } from "../convex/_generated/server";
import type { Doc } from "../convex/_generated/dataModel";

type Row = Record<string, unknown>;

const checking = { _id: "acct", userId: "owner", type: "checking" };
const credit = { _id: "card", userId: "owner", type: "credit" };

/** `latest` is the newest snapshot per account, so each side of a move is distinct. */
function context(latest: Row | null | Record<string, Row>, accounts: Row[] = [checking]) {
  let requested = "";
  const chain = {
    withIndex: vi.fn(),
    order: vi.fn(),
    first: vi.fn(async () =>
      latest && "balance" in latest ? latest : ((latest ?? {}) as Record<string, Row>)[requested] ?? null,
    ),
  };
  chain.withIndex.mockImplementation((_name: string, fn: (q: unknown) => unknown) => {
    fn({ eq: (_field: string, value: string) => ((requested = value), {}) });
    return chain;
  });
  chain.order.mockReturnValue(chain);
  const db = {
    get: vi.fn(async (id: string) => accounts.find((a) => a._id === id) ?? null),
    query: vi.fn().mockReturnValue(chain),
    insert: vi.fn(),
    patch: vi.fn(),
  };
  return { ctx: { db } as unknown as MutationCtx, db };
}

const entry = (extra: Row = {}) =>
  ({
    _id: "entry",
    userId: "owner",
    type: "expense",
    amountCents: 2500,
    accountId: "acct",
    ...extra,
  }) as unknown as Doc<"entries">;

const inserted = (db: { insert: { mock: { calls: unknown[][] } } }) =>
  db.insert.mock.calls.filter(([table]) => table === "accountSnapshots").map(([, row]) => row as Row);
const patched = (db: { patch: { mock: { calls: unknown[][] } } }) =>
  db.patch.mock.calls
    .filter(([id]) => String(id).startsWith("snapshot"))
    .map(([id, row]) => ({ id, ...(row as Row) }));

describe("Account balance sync", () => {
  it("starts a running balance from the reported one", async () => {
    const c = context({ _id: "snapshot", balance: 100000, asOf: 1, source: "manual" });
    await syncEntryBalance(c.ctx, undefined, entry());
    expect(inserted(c.db)).toEqual([expect.objectContaining({ balance: 97500, source: "entry" })]);
    expect(patched(c.db)).toEqual([]);
  });

  it("corrects the running balance in place instead of appending a point", async () => {
    const c = context({ _id: "snapshot", balance: 97500, asOf: 10, source: "entry" });
    // The amount changed from 2500 to 4000.
    await syncEntryBalance(c.ctx, entry({ balanceImpactCents: -2500 }), entry({ amountCents: 4000 }));
    expect(inserted(c.db)).toEqual([]);
    expect(patched(c.db)).toEqual([expect.objectContaining({ id: "snapshot", balance: 96000 })]);
  });

  it("never rewrites a balance the user reported", async () => {
    const c = context({ _id: "snapshot", balance: 100000, asOf: 10, source: "manual" });
    await syncEntryBalance(c.ctx, undefined, entry());
    expect(patched(c.db)).toEqual([]);
  });

  it("treats spending on a card as debt rather than lost cash", async () => {
    const c = context({ _id: "snapshot", balance: 0, asOf: 1, source: "manual" }, [credit]);
    await syncEntryBalance(c.ctx, undefined, entry({ accountId: "card" }));
    expect(inserted(c.db)).toEqual([expect.objectContaining({ balance: 2500 })]);
  });

  it("returns the money when a transaction is archived", async () => {
    const c = context({ _id: "snapshot", balance: 97500, asOf: 10, source: "entry" });
    const live = entry({ balanceImpactCents: -2500 });
    await syncEntryBalance(c.ctx, live, entry({ balanceImpactCents: -2500, isArchived: true }));
    expect(patched(c.db)).toEqual([expect.objectContaining({ id: "snapshot", balance: 100000 })]);
  });

  it("leaves pending charges out of the balance until they post", async () => {
    const c = context({ _id: "snapshot", balance: 100000, asOf: 1, source: "manual" });
    await syncEntryBalance(c.ctx, undefined, entry({ status: "pending" }));
    expect(inserted(c.db)).toEqual([]);
    expect(patched(c.db)).toEqual([]);
  });

  it("moves the money when a transaction changes account", async () => {
    const c = context(
      {
        acct: { _id: "snapshot-acct", balance: 50000, asOf: 1, source: "entry" },
        card: { _id: "snapshot-card", balance: 10000, asOf: 1, source: "entry" },
      },
      [checking, credit],
    );
    await syncEntryBalance(
      c.ctx,
      entry({ balanceImpactCents: -2500 }),
      entry({ accountId: "card", balanceImpactCents: -2500 }),
    );
    // Returned to checking, then charged to the card as debt.
    expect(patched(c.db)).toEqual([
      expect.objectContaining({ id: "snapshot-acct", balance: 52500 }),
      expect.objectContaining({ id: "snapshot-card", balance: 12500 }),
    ]);
  });
});
