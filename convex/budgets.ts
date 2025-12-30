import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// BUDGET CATEGORIES QUERIES & MUTATIONS
// ============================================

/**
 * List all budget categories for the current user
 */
export const listBudgetCategories = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let categories = await ctx.db
      .query("budgetCategories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter out archived unless requested
    if (!args.includeArchived) {
      categories = categories.filter((c) => !c.archived);
    }

    // Sort by name for consistency
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single budget category by ID
 */
export const getBudgetCategory = query({
  args: { id: v.id("budgetCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) return null;
    return category;
  },
});

/**
 * Create a new budget category
 */
export const createBudgetCategory = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    periodType: v.union(
      v.literal("monthly"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("quarterly"),
      v.literal("yearly"),
      v.literal("custom")
    ),
    periodDays: v.optional(v.number()),
    budgetAmountCents: v.number(),
    matchCategories: v.optional(v.array(v.string())),
    matchMerchants: v.optional(v.array(v.string())),
    matchTags: v.optional(v.array(v.string())),
    rolloverEnabled: v.optional(v.boolean()),
    rolloverCapCents: v.optional(v.number()),
    isHardLimit: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const now = Date.now();
    return await ctx.db.insert("budgetCategories", {
      userId,
      name: args.name,
      icon: args.icon,
      color: args.color,
      periodType: args.periodType,
      periodDays: args.periodDays,
      budgetAmountCents: args.budgetAmountCents,
      matchCategories: args.matchCategories,
      matchMerchants: args.matchMerchants,
      matchTags: args.matchTags,
      rolloverEnabled: args.rolloverEnabled,
      rolloverCapCents: args.rolloverCapCents,
      isHardLimit: args.isHardLimit,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a budget category
 */
export const updateBudgetCategory = mutation({
  args: {
    id: v.id("budgetCategories"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    budgetAmountCents: v.optional(v.number()),
    matchCategories: v.optional(v.array(v.string())),
    matchMerchants: v.optional(v.array(v.string())),
    matchTags: v.optional(v.array(v.string())),
    rolloverEnabled: v.optional(v.boolean()),
    rolloverCapCents: v.optional(v.number()),
    isHardLimit: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Budget category not found");
    }

    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) filtered[k] = v;
    }
    filtered.updatedAt = Date.now();

    await ctx.db.patch(id, filtered);
  },
});
