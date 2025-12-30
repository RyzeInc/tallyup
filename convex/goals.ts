import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// GOALS QUERIES & MUTATIONS
// ============================================

/**
 * List all active goals for the current user
 */
export const listGoals = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter out archived unless requested
    if (!args.includeArchived) {
      goals = goals.filter((g) => !g.archived);
    }

    // Filter out completed unless requested
    if (!args.includeCompleted) {
      goals = goals.filter((g) => g.currentAmountCents < g.targetAmountCents);
    }

    // Sort by name for consistency
    return goals.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single goal by ID
 */
export const getGoal = query({
  args: { id: v.id("goals") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const goal = await ctx.db.get(args.id);
    if (!goal || goal.userId !== userId) return null;
    return goal;
  },
});

/**
 * Create a new goal
 */
export const createGoal = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    goalType: v.union(
      v.literal("savings"),
      v.literal("paydown"),
      v.literal("sinkingFund")
    ),
    targetAmountCents: v.number(),
    startDate: v.optional(v.number()),
    targetDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const now = Date.now();
    return await ctx.db.insert("goals", {
      userId,
      name: args.name,
      description: args.description,
      icon: args.icon,
      color: args.color,
      goalType: args.goalType,
      targetAmountCents: args.targetAmountCents,
      currentAmountCents: 0,
      startDate: args.startDate ?? now,
      targetDate: args.targetDate,
      priority: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update goal progress (called when entry is linked/unlinked)
 */
export const updateGoalProgress = mutation({
  args: {
    id: v.id("goals"),
    deltaAmountCents: v.number(), // positive = add, negative = subtract
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const goal = await ctx.db.get(args.id);
    if (!goal || goal.userId !== userId) {
      throw new Error("Goal not found");
    }

    const newAmount = Math.max(0, goal.currentAmountCents + args.deltaAmountCents);
    await ctx.db.patch(args.id, {
      currentAmountCents: newAmount,
      updatedAt: Date.now(),
    });

    return newAmount;
  },
});
