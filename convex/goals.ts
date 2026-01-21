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
 * Get goals that should receive auto-allocation from a given income category.
 * Used when processing income entries to determine which goals should be funded.
 */
export const getGoalsForIncomeCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter for active goals with auto-allocation enabled and matching category
    const normalizedCategory = args.category.toLowerCase().trim();
    return goals.filter((g) => {
      if (g.status !== "active") return false;
      if (!g.autoAllocateEnabled) return false;
      if (!g.fundingIncomeCategories?.length) return false;
      if (g.currentAmountCents >= g.targetAmountCents) return false; // Goal already met
      
      // Check if any funding category matches
      return g.fundingIncomeCategories.some(
        (cat) => cat.toLowerCase().trim() === normalizedCategory
      );
    });
  },
});

/**
 * Get goals linked to a specific account.
 * Useful for showing goal progress on account detail pages.
 */
export const getGoalsForAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return goals.filter((g) => g.fundingAccountId === args.accountId && !g.archived);
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
    // New: account and income linking
    fundingAccountId: v.optional(v.id("accounts")),
    fundingIncomeCategories: v.optional(v.array(v.string())),
    autoAllocatePercent: v.optional(v.number()),
    autoAllocateEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Validate funding account if provided
    if (args.fundingAccountId) {
      const account = await ctx.db.get(args.fundingAccountId);
      if (!account || account.userId !== userId) {
        throw new Error("Invalid funding account");
      }
    }

    // Validate auto-allocate percent
    const autoAllocatePercent = args.autoAllocatePercent !== undefined
      ? Math.max(0, Math.min(100, args.autoAllocatePercent))
      : undefined;

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
      status: "active",
      // New fields
      fundingAccountId: args.fundingAccountId,
      fundingIncomeCategories: args.fundingIncomeCategories,
      autoAllocatePercent,
      autoAllocateEnabled: args.autoAllocateEnabled ?? false,
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

/**
 * Update goal details (name, target, status, etc.)
 */
export const updateGoal = mutation({
  args: {
    id: v.id("goals"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    targetAmountCents: v.optional(v.number()),
    targetDate: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("abandoned"))),
    priority: v.optional(v.number()),
    // New: account and income linking
    fundingAccountId: v.optional(v.union(v.id("accounts"), v.null())),
    fundingIncomeCategories: v.optional(v.union(v.array(v.string()), v.null())),
    autoAllocatePercent: v.optional(v.union(v.number(), v.null())),
    autoAllocateEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const goal = await ctx.db.get(args.id);
    if (!goal || goal.userId !== userId) {
      throw new Error("Goal not found");
    }

    // Validate funding account if provided
    if (args.fundingAccountId && args.fundingAccountId !== null) {
      const account = await ctx.db.get(args.fundingAccountId);
      if (!account || account.userId !== userId) {
        throw new Error("Invalid funding account");
      }
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.icon !== undefined) patch.icon = updates.icon;
    if (updates.color !== undefined) patch.color = updates.color;
    if (updates.targetAmountCents !== undefined) patch.targetAmountCents = updates.targetAmountCents;
    if (updates.targetDate !== undefined) patch.targetDate = updates.targetDate;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    
    // New fields - handle null to clear
    if (updates.fundingAccountId !== undefined) {
      patch.fundingAccountId = updates.fundingAccountId === null ? undefined : updates.fundingAccountId;
    }
    if (updates.fundingIncomeCategories !== undefined) {
      patch.fundingIncomeCategories = updates.fundingIncomeCategories === null ? undefined : updates.fundingIncomeCategories;
    }
    if (updates.autoAllocatePercent !== undefined) {
      if (updates.autoAllocatePercent === null) {
        patch.autoAllocatePercent = undefined;
      } else {
        patch.autoAllocatePercent = Math.max(0, Math.min(100, updates.autoAllocatePercent));
      }
    }
    if (updates.autoAllocateEnabled !== undefined) {
      patch.autoAllocateEnabled = updates.autoAllocateEnabled;
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * Get the impact of deleting a goal - shows what would be affected.
 * Use this to show a warning dialog before deletion.
 */
export const getGoalDeletionImpact = query({
  args: { id: v.id("goals") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const goal = await ctx.db.get(args.id);
    if (!goal || goal.userId !== userId) return null;

    // Count linked contributions
    const contributions = await ctx.db
      .query("goalContributions")
      .withIndex("by_goal", (q) => q.eq("goalId", args.id))
      .collect();

    // Count linked entries
    const linkedEntries = await ctx.db
      .query("entries")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("goalId"), args.id)
        )
      )
      .collect();

    const totalContributedCents = contributions.reduce((sum, c) => sum + c.amountCents, 0);

    return {
      goalName: goal.name,
      currentAmountCents: goal.currentAmountCents,
      targetAmountCents: goal.targetAmountCents,
      contributionsCount: contributions.length,
      totalContributedCents,
      linkedEntriesCount: linkedEntries.length,
      hasFundingAccount: !!goal.fundingAccountId,
      hasFundingCategories: !!(goal.fundingIncomeCategories?.length),
    };
  },
});

/**
 * Delete a goal with cascade options.
 */
export const deleteGoal = mutation({
  args: {
    id: v.id("goals"),
    // Whether to unlink entries (default) or throw error if entries exist
    unlinkEntries: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const goal = await ctx.db.get(args.id);
    if (!goal || goal.userId !== userId) {
      throw new Error("Goal not found");
    }

    const unlinkEntries = args.unlinkEntries ?? true;

    // Find all linked entries
    const linkedEntries = await ctx.db
      .query("entries")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("goalId"), args.id)
        )
      )
      .collect();

    if (linkedEntries.length > 0 && !unlinkEntries) {
      throw new Error(`Goal has ${linkedEntries.length} linked entries. Set unlinkEntries: true to proceed.`);
    }

    // Unlink all entries
    for (const entry of linkedEntries) {
      await ctx.db.patch(entry._id, { goalId: undefined, updatedAt: Date.now() });
    }

    // Delete all goal contributions
    const contributions = await ctx.db
      .query("goalContributions")
      .withIndex("by_goal", (q) => q.eq("goalId", args.id))
      .collect();
    
    for (const contrib of contributions) {
      await ctx.db.delete(contrib._id);
    }

    // Delete the goal
    await ctx.db.delete(args.id);

    return {
      ok: true,
      unlinkedEntries: linkedEntries.length,
      deletedContributions: contributions.length,
    };
  },
});

/**
 * Archive a goal (soft delete) - safer option that preserves data.
 */
export const archiveGoal = mutation({
  args: { id: v.id("goals") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const goal = await ctx.db.get(args.id);
    if (!goal || goal.userId !== userId) {
      throw new Error("Goal not found");
    }

    await ctx.db.patch(args.id, {
      archived: true,
      status: "abandoned",
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});
