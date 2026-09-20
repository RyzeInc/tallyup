import { beforeEach, describe, it, expect, vi } from "vitest";
import { updateEntry } from "../convex/entries";
import type { MutationCtx } from "../convex/_generated/server";

const resolver = vi.hoisted(() => ({ category: vi.fn(), budget: vi.fn() }));
vi.mock("../convex/categoryResolver", () => ({
  resolveCategoryId: resolver.category,
}));
vi.mock("../convex/budgetMatcher", () => ({
  resolveBudgetCategoryId: resolver.budget,
}));
const update = (
  updateEntry as unknown as {
    _handler: (ctx: MutationCtx, args: unknown) => Promise<unknown>;
  }
)._handler;
function context(extra = {}) {
  const existing = {
    _id: "entry",
    userId: "owner",
    type: "expense",
    amountCents: 1000,
    date: 100,
    ...extra,
  };
  const chain = { withIndex: vi.fn(), first: vi.fn().mockResolvedValue(null) };
  chain.withIndex.mockReturnValue(chain);
  const db = {
    get: vi.fn().mockResolvedValue(existing),
    query: vi.fn().mockReturnValue(chain),
    patch: vi.fn(),
    insert: vi.fn(),
  };
  const ctx = {
    auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: "owner" }) },
    db,
  } as unknown as MutationCtx;
  return { ctx, db };
}
beforeEach(() => {
  resolver.category.mockReset();
  resolver.budget.mockReset();
});
describe("Entry update propagation", () => {
  it("clears canonical category and legacy labels without resolving the old category again", async () => {
    const c = context({
      categoryId: "food",
      category: "Food",
      bucket: "Food",
      subcategoryId: "groceries",
    });
    await update(c.ctx, { id: "entry", categoryId: null });
    expect(c.db.patch).toHaveBeenCalledWith(
      "entry",
      expect.objectContaining({
        categoryId: undefined,
        category: undefined,
        bucket: undefined,
        subcategoryId: undefined,
      }),
    );
    expect(resolver.category).not.toHaveBeenCalled();
    expect(resolver.budget).toHaveBeenCalledWith(
      c.ctx,
      "owner",
      expect.objectContaining({
        categoryId: undefined,
        category: undefined,
        subcategoryId: undefined,
      }),
    );
  });
  it("queues newly matched budgets for recomputation", async () => {
    const c = context();
    resolver.budget.mockResolvedValue("new-budget");
    await update(c.ctx, { id: "entry", tags: ["Groceries"] });
    expect(c.db.patch).toHaveBeenCalledWith(
      "entry",
      expect.objectContaining({ budgetCategoryId: "new-budget" }),
    );
    expect(c.db.insert).toHaveBeenCalledWith(
      "budgetDirtyQueue",
      expect.objectContaining({
        budgetCategoryId: "new-budget",
        dirtyDate: 100,
        reason: "entry_updated_new",
      }),
    );
  });
  it("does not send removed merchant or tags to budget matching", async () => {
    const c = context({ merchant: "Old store", tags: ["Old tag"] });
    await update(c.ctx, { id: "entry", merchant: "", tags: [] });
    expect(resolver.budget).toHaveBeenCalledWith(
      c.ctx,
      "owner",
      expect.objectContaining({ merchant: undefined, tags: undefined }),
    );
  });
});
