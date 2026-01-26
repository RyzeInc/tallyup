import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { resolveBudgetCategoryId } from "./budgetMatcher";

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
    const categoryId = await ctx.db.insert("budgetCategories", {
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

    // Map periodType to plan frequency
    const frequencyMap: Record<string, "monthly" | "weekly" | "annual" | "custom"> = {
      monthly: "monthly",
      weekly: "weekly",
      biweekly: "custom",
      quarterly: "custom",
      yearly: "annual",
      custom: "custom",
    };
    const frequency = frequencyMap[args.periodType] ?? "monthly";
    
    // Calculate period days for custom frequencies
    let periodDays: number | undefined;
    if (frequency === "custom") {
      if (args.periodType === "biweekly") periodDays = 14;
      else if (args.periodType === "quarterly") periodDays = 91;
      else periodDays = args.periodDays;
    }

    // Auto-create a budget plan so spending can be tracked
    const planId = await ctx.db.insert("budgetPlans", {
      userId,
      name: args.name,
      planType: "category",
      budgetCategoryId: categoryId,
      frequency,
      periodDays,
      amountCents: args.budgetAmountCents,
      effectiveFrom: now,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Create the initial plan version
    await ctx.db.insert("budgetPlanVersions", {
      userId,
      planId,
      version: 1,
      frequency,
      periodDays,
      amountCents: args.budgetAmountCents,
      effectiveFrom: now,
      createdAt: now,
    });

    return categoryId;
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

/**
 * Restore an archived budget category
 */
export const restoreBudgetCategory = mutation({
  args: { id: v.id("budgetCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Budget category not found");
    }

    if (!category.archived) {
      return { ok: true, restored: false };
    }

    await ctx.db.patch(args.id, {
      archived: false,
      updatedAt: Date.now(),
    });

    return { ok: true, restored: true };
  },
});

/**
 * Bulk delete archived budget categories
 */
export const bulkDeleteArchivedBudgetCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const archivedCategories = await ctx.db
      .query("budgetCategories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archived"), true))
      .collect();

    const now = Date.now();
    let deletedCount = 0;

    for (const category of archivedCategories) {
      // Clear budgetCategoryId on linked entries
      const linkedEntries = await ctx.db
        .query("entries")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("budgetCategoryId"), category._id)
          )
        )
        .collect();

      for (const entry of linkedEntries) {
        await ctx.db.patch(entry._id, { budgetCategoryId: undefined, updatedAt: now });
      }

      // Remove from any budget groups
      const groupMemberships = await ctx.db
        .query("budgetGroupMembers")
        .filter((q) => q.eq(q.field("budgetCategoryId"), category._id))
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
            q.eq(q.field("budgetCategoryId"), category._id)
          )
        )
        .collect();

      for (const impact of entryImpacts) {
        await ctx.db.delete(impact._id);
      }

      // Delete the category
      await ctx.db.delete(category._id);
      deletedCount++;
    }

    return { ok: true, deletedCount };
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

/**
 * Backfill budgetCategoryId on existing entries that don't have one.
 * This re-resolves budget categories based on matchCategories rules.
 */
export const backfillEntryBudgetCategories = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const limit = args.limit ?? 500;
    
    // Get expense entries without budgetCategoryId
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_user_type_date", (q) => q.eq("userId", userId).eq("type", "expense"))
      .filter((q) => q.eq(q.field("budgetCategoryId"), undefined))
      .take(limit);

    let updated = 0;
    let skipped = 0;

    for (const entry of entries) {
      const budgetCategoryId = await resolveBudgetCategoryId(ctx, userId, {
        category: entry.category,
        categoryId: entry.categoryId,
        subcategoryId: entry.subcategoryId,
        merchant: entry.merchant,
        tags: entry.tags,
      });

      if (budgetCategoryId) {
        await ctx.db.patch(entry._id, { budgetCategoryId });
        updated++;
      } else {
        skipped++;
      }
    }

    return { 
      processed: entries.length, 
      updated, 
      skipped,
      remaining: entries.length === limit 
    };
  },
});

// Recommended budget category matchCategories (copied from UI for server-side use)
const RECOMMENDED_MATCH_CATEGORIES: Record<string, string[]> = {
  "Housing": [
    "utilities_rent", "loan_mortgage", "utilities_gas_electric", "utilities_internet_cable", 
    "utilities_sewage", "utilities_telephone", "utilities_water", "utilities_other",
    "rent_utilities", "rent", "mortgage"
  ],
  "Transportation": [
    "loan_car_payment", "transport_gas", "transport_parking", "transport_public_transit",
    "transport_rideshare", "transport_tolls", "transport_bikes_scooters", "transport_other",
    "services_automotive", "transportation"
  ],
  "Food": ["food_groceries"],
  "Insurance": ["services_insurance"],
  "Healthcare": [
    "medical_dental", "medical_eye", "medical_hospitals", "medical_pharmacy",
    "medical_primary_care", "medical_other", "personal_gyms", "medical"
  ],
  "Debt Payments": [
    "loan_credit_card", "loan_personal", "loan_student", "loan_other", "loan_payments",
    "bank_fees_atm", "bank_fees_foreign_transaction", "bank_fees_insufficient_funds",
    "bank_fees_interest_charge", "bank_fees_overdraft", "bank_fees_other", "bank_fees"
  ],
  "Savings & Investments": [
    "transfer_out_savings", "transfer_out_investment", "transfer_out_withdrawal",
    "transfer_out_account", "transfer_out_other", "transfer_out"
  ],
  "Quality of Life": [
    "food_beer_wine_liquor", "food_coffee", "food_fast_food", "food_restaurant",
    "food_vending_machines", "food_other", "food_and_drink",
    "entertainment_casinos_gambling", "entertainment_music_audio", "entertainment_sporting_events",
    "entertainment_tv_movies", "entertainment_video_games", "entertainment_other", "entertainment",
    "merchandise_bookstores", "merchandise_clothing", "merchandise_electronics",
    "merchandise_sporting_goods", "merchandise_tobacco",
    "personal_hair_beauty", "personal_laundry", "personal_other", "personal_care",
    "services_education"
  ],
  "True Expenses": [
    "merchandise_convenience", "merchandise_department", "merchandise_discount",
    "merchandise_office", "merchandise_online", "merchandise_pets", "merchandise_superstores",
    "merchandise_gifts", "merchandise_other", "general_merchandise",
    "home_furniture", "home_hardware", "home_repair", "home_security", "home_other", "home_improvement",
    "medical_veterinary", "services_veterinary",
    "travel_flights", "travel_lodging", "travel_rental_cars", "travel_other", "travel",
    "services_accounting_tax", "services_childcare", "services_consulting",
    "services_postage_shipping", "services_storage", "services_other", "general_services",
    "government_departments", "government_tax_payment", "government_other", "government_nonprofit"
  ],
  "Values & Buffer": ["government_donations"],
};

/**
 * Apply recommended matchCategories to existing budget categories based on name.
 * This helps fix budget categories created before matchCategories was implemented.
 */
export const applyRecommendedMatchCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const budgetCategories = await ctx.db
      .query("budgetCategories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let updated = 0;
    const updates: Array<{ name: string; matchCategories: string[] }> = [];

    for (const budget of budgetCategories) {
      if (budget.archived) continue;
      
      // Check if this budget name matches a recommended category
      const recommendedMatches = RECOMMENDED_MATCH_CATEGORIES[budget.name];
      if (recommendedMatches && (!budget.matchCategories || budget.matchCategories.length === 0)) {
        await ctx.db.patch(budget._id, { 
          matchCategories: recommendedMatches,
          updatedAt: Date.now()
        });
        updates.push({ name: budget.name, matchCategories: recommendedMatches });
        updated++;
      }
    }

    return { 
      processed: budgetCategories.length, 
      updated,
      updates
    };
  },
});

/**
 * Create missing budget plans for existing budget categories.
 * This is needed because older categories may have been created without a plan,
 * which means the budget spending tracker has no way to materialize periods.
 */
export const backfillMissingBudgetPlans = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const now = Date.now();

    // Get all budget categories
    const categories = await ctx.db
      .query("budgetCategories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get all existing plans
    const existingPlans = await ctx.db
      .query("budgetPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Build set of category IDs that already have plans
    const categoriesWithPlans = new Set(
      existingPlans
        .filter(p => p.budgetCategoryId)
        .map(p => p.budgetCategoryId)
    );

    let created = 0;
    const createdPlans: Array<{ categoryName: string; planId: string }> = [];

    for (const category of categories) {
      if (category.archived) continue;
      if (categoriesWithPlans.has(category._id)) continue;

      // Map periodType to plan frequency
      const frequencyMap: Record<string, "monthly" | "weekly" | "annual" | "custom"> = {
        monthly: "monthly",
        weekly: "weekly",
        biweekly: "custom",
        quarterly: "custom",
        yearly: "annual",
        custom: "custom",
      };
      const frequency = frequencyMap[category.periodType ?? "monthly"] ?? "monthly";
      
      // Calculate period days for custom frequencies
      let periodDays: number | undefined;
      if (frequency === "custom") {
        if (category.periodType === "biweekly") periodDays = 14;
        else if (category.periodType === "quarterly") periodDays = 91;
        else periodDays = category.periodDays;
      }

      // Create the budget plan
      const planId = await ctx.db.insert("budgetPlans", {
        userId,
        name: category.name,
        planType: "category",
        budgetCategoryId: category._id,
        frequency,
        periodDays,
        amountCents: category.budgetAmountCents ?? 0,
        effectiveFrom: category.createdAt ?? now,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      // Create the initial plan version
      await ctx.db.insert("budgetPlanVersions", {
        userId,
        planId,
        version: 1,
        frequency,
        periodDays,
        amountCents: category.budgetAmountCents ?? 0,
        effectiveFrom: category.createdAt ?? now,
        createdAt: now,
      });

      createdPlans.push({ categoryName: category.name, planId });
      created++;
    }

    return {
      processed: categories.length,
      created,
      createdPlans,
    };
  },
});

/**
 * Force rematerialization of budget periods for all plans.
 * This recomputes spending from entries for the current period.
 */
export const forceBudgetRematerialization = mutation({
  args: {
    rangeStart: v.optional(v.number()),
    rangeEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const now = Date.now();
    const rangeStart = args.rangeStart ?? now - 30 * 24 * 60 * 60 * 1000; // Default: last 30 days
    const rangeEnd = args.rangeEnd ?? now;

    // Get all budget plans for the user
    const plans = await ctx.db
      .query("budgetPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter(q => q.not(q.eq(q.field("archived"), true)))
      .collect();

    // Enqueue dirty items for each plan
    for (const plan of plans) {
      await ctx.db.insert("budgetDirtyQueue", {
        userId,
        planId: plan._id,
        budgetCategoryId: plan.budgetCategoryId,
        dirtyDate: rangeStart,
        reason: "force_rematerialization",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      plansQueued: plans.length,
      rangeStart,
      rangeEnd,
    };
  },
});
