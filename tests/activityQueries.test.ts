import { describe, it, expect, vi } from "vitest";
import {
  listActivityEntries,
  getActivityEntry,
  listRecentEntries,
} from "../convex/entries";
import type { QueryCtx } from "../convex/_generated/server";

// Run the real registered Convex handlers against a small query-boundary double.
const list = (
  listActivityEntries as unknown as {
    _handler: (ctx: QueryCtx, args: unknown) => Promise<unknown>;
  }
)._handler;
const recent = (
  listRecentEntries as unknown as {
    _handler: (ctx: QueryCtx, args: unknown) => Promise<unknown>;
  }
)._handler;
const get = (
  getActivityEntry as unknown as {
    _handler: (ctx: QueryCtx, args: unknown) => Promise<unknown>;
  }
)._handler;
function context(subject: string | null = "owner") {
  const index = { eq: vi.fn(), gte: vi.fn(), lt: vi.fn() };
  Object.values(index).forEach((fn) => fn.mockReturnValue(index));
  const filter = { neq: vi.fn(), field: vi.fn((name: string) => name) };
  const page = {
    page: [],
    isDone: false,
    continueCursor: "opaque-same-date-cursor",
  };
  const chain = {
    withIndex: vi.fn(),
    filter: vi.fn(),
    order: vi.fn(),
    paginate: vi.fn().mockResolvedValue(page),
    take: vi.fn().mockResolvedValue([]),
  };
  chain.withIndex.mockImplementation((_name, fn) => {
    fn(index);
    return chain;
  });
  chain.filter.mockImplementation((fn) => {
    fn(filter);
    return chain;
  });
  chain.order.mockReturnValue(chain);
  const db = {
    query: vi.fn().mockReturnValue(chain),
    normalizeId: vi.fn((table, id) => (id === "invalid" ? null : id)),
    get: vi.fn(),
  };
  const ctx = {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(subject ? { subject } : null),
    },
    db,
  } as unknown as QueryCtx;
  return { ctx, db, chain, index, filter, page };
}
describe("Activity query boundaries", () => {
  it("scopes pages to the current user and half-open shared date range", async () => {
    const c = context();
    const paginationOpts = { cursor: "opaque-cursor", numItems: 250 };
    expect(
      await list(c.ctx, { startDate: 100, endDate: 200, paginationOpts }),
    ).toBe(c.page);
    expect(c.index.eq).toHaveBeenCalledWith("userId", "owner");
    expect(c.index.gte).toHaveBeenCalledWith("date", 100);
    expect(c.index.lt).toHaveBeenCalledWith("date", 200);
    expect(c.chain.paginate).toHaveBeenCalledWith(paginationOpts);
    expect(c.filter.neq).toHaveBeenCalledWith("isArchived", true);
  });
  it("rejects unauthenticated reads before touching the database", async () => {
    const c = context(null);
    await expect(
      list(c.ctx, {
        startDate: 0,
        endDate: 200,
        paginationOpts: { cursor: null, numItems: 250 },
      }),
    ).rejects.toThrow("Unauthorized");
    expect(c.db.query).not.toHaveBeenCalled();
  });
  it("loads edit targets directly even when filters do not contain the entry", async () => {
    const c = context();
    c.db.get.mockResolvedValue({ _id: "entry", userId: "owner" });
    expect(await get(c.ctx, { id: "entry" })).toEqual({
      _id: "entry",
      userId: "owner",
    });
    expect(c.db.query).not.toHaveBeenCalled();
  });
  it("does not expose another user’s entry or archived entries", async () => {
    const c = context();
    c.db.get.mockResolvedValue({ userId: "other" });
    expect(await get(c.ctx, { id: "entry" })).toBeNull();
    c.db.get.mockResolvedValue({ userId: "owner", isArchived: true });
    expect(await get(c.ctx, { id: "entry" })).toBeNull();
  });
  it("scopes the recurring backfill source to its authenticated caller", async () => {
    const c = context();
    await recent(c.ctx, { limit: 5000 });
    expect(c.index.eq).toHaveBeenCalledWith("userId", "owner");
    await expect(recent(context(null).ctx, {})).rejects.toThrow("Unauthorized");
  });
  it("returns an empty edit target for malformed deep links", async () => {
    const c = context();
    expect(await get(c.ctx, { id: "invalid" })).toBeNull();
    expect(c.db.get).not.toHaveBeenCalled();
  });
});
