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

/**
 * Get the impact of archiving/deleting a budget category.
 * Use this to show a warning dialog before the action.
 */
export const getBudgetCategoryDeletionImpact = query({
  args: { id: v.id("budgetCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) return null;

    // Count linked entries
    const linkedEntries = await ctx.db
      .query("entries")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("budgetCategoryId"), args.id)
        )
      )
      .collect();

    // Count budget group memberships
    const groupMemberships = await ctx.db
      .query("budgetGroupMembers")
      .filter((q) => q.eq(q.field("budgetCategoryId"), args.id))
      .collect();

    // Count budget entry impacts
    const entryImpacts = await ctx.db
      .query("budgetEntryImpacts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("budgetCategoryId"), args.id)
        )
      )
      .collect();

    const totalSpentCents = linkedEntries
      .filter(e => e.type === "expense")
      .reduce((sum, e) => sum + e.amountCents, 0);

    return {
      categoryName: category.name,
      budgetAmountCents: category.budgetAmountCents,
      linkedEntriesCount: linkedEntries.length,
      totalSpentCents,
      groupMembershipsCount: groupMemberships.length,
      entryImpactsCount: entryImpacts.length,
    };
  },
});

/**
 * Archive a budget category with proper cleanup.
 * This clears budgetCategoryId on linked entries and removes group memberships.
 */
export const archiveBudgetCategory = mutation({
  args: {
    id: v.id("budgetCategories"),
    clearEntryLinks: v.optional(v.boolean()), // Default true - clear budgetCategoryId on entries
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Budget category not found");
    }

    const clearEntryLinks = args.clearEntryLinks ?? true;

    // Clear budgetCategoryId on linked entries if requested
    if (clearEntryLinks) {
      const linkedEntries = await ctx.db
        .query("entries")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("budgetCategoryId"), args.id)
          )
        )
        .collect();

      for (const entry of linkedEntries) {
        await ctx.db.patch(entry._id, { budgetCategoryId: undefined, updatedAt: Date.now() });
      }
    }

    // Remove from any budget groups
    const groupMemberships = await ctx.db
      .query("budgetGroupMembers")
      .filter((q) => q.eq(q.field("budgetCategoryId"), args.id))
      .collect();
    
    for (const membership of groupMemberships) {
      await ctx.db.delete(membership._id);
    }

    // Archive the category
    await ctx.db.patch(args.id, {
      archived: true,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

/**
 * Permanently delete a budget category with full cascade.
 */
export const deleteBudgetCategory = mutation({
  args: { id: v.id("budgetCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Budget category not found");
    }

    // Clear budgetCategoryId on linked entries
    const linkedEntries = await ctx.db
      .query("entries")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("budgetCategoryId"), args.id)
        )
      )
      .collect();

    for (const entry of linkedEntries) {
      await ctx.db.patch(entry._id, { budgetCategoryId: undefined, updatedAt: Date.now() });
    }

    // Remove from any budget groups
    const groupMemberships = await ctx.db
      .query("budgetGroupMembers")
      .filter((q) => q.eq(q.field("budgetCategoryId"), args.id))
      .collect();
    
    for (const membership of groupMemberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete budget entry impacts
    const entryImpacts = await ctx.db
      .query("budgetEntryImpacts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("budgetCategoryId"), args.id)
        )
      )
      .collect();
    
    for (const impact of entryImpacts) {
      await ctx.db.delete(impact._id);
    }

    // Delete the category
    await ctx.db.delete(args.id);

    return { ok: true };
  },
});

// ============================================
// BUDGET GROUPS QUERIES & MUTATIONS
// ============================================

/**
 * List all budget groups for the current user
 */
export const listBudgetGroups = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let groups = await ctx.db
      .query("budgetGroups")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (!args.includeArchived) {
      groups = groups.filter((g) => !g.archived);
    }

    return groups.sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  },
});

/**
 * Get the impact of deleting a budget group.
 */
export const getBudgetGroupDeletionImpact = query({
  args: { id: v.id("budgetGroups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const group = await ctx.db.get(args.id);
    if (!group || group.userId !== userId) return null;

    // Count members
    const members = await ctx.db
      .query("budgetGroupMembers")
      .withIndex("by_group", (q) => q.eq("budgetGroupId", args.id))
      .collect();

    // Count budget plans referencing this group
    const plans = await ctx.db
      .query("budgetPlans")
      .withIndex("by_user_group", (q) => q.eq("userId", userId).eq("budgetGroupId", args.id))
      .collect();

    return {
      groupName: group.name,
      membersCount: members.length,
      plansCount: plans.length,
    };
  },
});

/**
 * Archive a budget group with proper cleanup.
 */
export const archiveBudgetGroup = mutation({
  args: { id: v.id("budgetGroups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const group = await ctx.db.get(args.id);
    if (!group || group.userId !== userId) {
      throw new Error("Budget group not found");
    }

    await ctx.db.patch(args.id, {
      archived: true,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

/**
 * Delete a budget group with full cascade.
 */
export const deleteBudgetGroup = mutation({
  args: { id: v.id("budgetGroups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const group = await ctx.db.get(args.id);
    if (!group || group.userId !== userId) {
      throw new Error("Budget group not found");
    }

    // Delete all group members
    const members = await ctx.db
      .query("budgetGroupMembers")
      .withIndex("by_group", (q) => q.eq("budgetGroupId", args.id))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Archive any budget plans that reference this group (don't delete to preserve history)
    const plans = await ctx.db
      .query("budgetPlans")
      .withIndex("by_user_group", (q) => q.eq("userId", userId).eq("budgetGroupId", args.id))
      .collect();

    for (const plan of plans) {
      await ctx.db.patch(plan._id, { 
        archived: true, 
        budgetGroupId: undefined,
        updatedAt: Date.now() 
      });
    }

    // Delete the group
    await ctx.db.delete(args.id);

    return { 
      ok: true,
      deletedMembers: members.length,
      archivedPlans: plans.length,
    };
  },
});

// ============================================
// BUDGET PLANS QUERIES & MUTATIONS
// ============================================

/**
 * List all budget plans for the current user
 */
export const listBudgetPlans = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let plans = await ctx.db
      .query("budgetPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (!args.includeArchived) {
      plans = plans.filter((p) => !p.archived);
    }

    return plans.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get the impact of deleting a budget plan.
 */
export const getBudgetPlanDeletionImpact = query({
  args: { id: v.id("budgetPlans") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const plan = await ctx.db.get(args.id);
    if (!plan || plan.userId !== userId) return null;

    // Count budget periods
    const periods = await ctx.db
      .query("budgetPeriods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("planId"), args.id))
      .collect();

    // Count budget entry impacts for all periods
    let totalImpacts = 0;
    for (const period of periods) {
      const impacts = await ctx.db
        .query("budgetEntryImpacts")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("periodId"), period._id)
          )
        )
        .collect();
      totalImpacts += impacts.length;
    }

    // Count plan versions
    const versions = await ctx.db
      .query("budgetPlanVersions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("planId"), args.id))
      .collect();

    return {
      planName: plan.name,
      planType: plan.planType,
      periodsCount: periods.length,
      entryImpactsCount: totalImpacts,
      versionsCount: versions.length,
    };
  },
});

/**
 * Archive a budget plan (soft delete).
 */
export const archiveBudgetPlan = mutation({
  args: { id: v.id("budgetPlans") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const plan = await ctx.db.get(args.id);
    if (!plan || plan.userId !== userId) {
      throw new Error("Budget plan not found");
    }

    await ctx.db.patch(args.id, {
      archived: true,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

/**
 * Delete a budget plan with full cascade.
 * WARNING: This deletes all historical period data. Use archiveBudgetPlan for soft delete.
 */
export const deleteBudgetPlan = mutation({
  args: { id: v.id("budgetPlans") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const plan = await ctx.db.get(args.id);
    if (!plan || plan.userId !== userId) {
      throw new Error("Budget plan not found");
    }

    // Delete all budget periods for this plan
    const periods = await ctx.db
      .query("budgetPeriods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("planId"), args.id))
      .collect();

    let deletedImpacts = 0;
    for (const period of periods) {
      // Delete entry impacts for this period
      const impacts = await ctx.db
        .query("budgetEntryImpacts")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("periodId"), period._id)
          )
        )
        .collect();

      for (const impact of impacts) {
        await ctx.db.delete(impact._id);
        deletedImpacts++;
      }

      // Delete the period
      await ctx.db.delete(period._id);
    }

    // Delete plan versions
    const versions = await ctx.db
      .query("budgetPlanVersions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("planId"), args.id))
      .collect();

    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete the plan
    await ctx.db.delete(args.id);

    return {
      ok: true,
      deletedPeriods: periods.length,
      deletedImpacts,
      deletedVersions: versions.length,
    };
  },
});
