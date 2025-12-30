import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// CATEGORY RULES - Auto-categorization logic
// ============================================

/**
 * List all category rules for the current user
 */
export const listCategoryRules = query({
  args: {
    enabledOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let rules = await ctx.db
      .query("categoryRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (args.enabledOnly) {
      rules = rules.filter((r) => r.enabled !== false);
    }

    // Sort by priority (higher first), then by name
    return rules.sort((a, b) => {
      const prioA = a.priority ?? 0;
      const prioB = b.priority ?? 0;
      if (prioB !== prioA) return prioB - prioA;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  },
});

/**
 * Get a single rule by ID
 */
export const getCategoryRule = query({
  args: { id: v.id("categoryRules") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const rule = await ctx.db.get(args.id);
    if (!rule || rule.userId !== userId) return null;
    return rule;
  },
});

/**
 * Create a new category rule
 */
export const createCategoryRule = mutation({
  args: {
    name: v.optional(v.string()),
    matchMerchantContains: v.optional(v.string()),
    matchMerchantExact: v.optional(v.string()),
    matchNoteContains: v.optional(v.string()),
    matchAmountMinCents: v.optional(v.number()),
    matchAmountMaxCents: v.optional(v.number()),
    matchAccountId: v.optional(v.id("accounts")),
    assignCategoryId: v.optional(v.id("categories")),
    assignCategory: v.optional(v.string()),
    assignTags: v.optional(v.array(v.string())),
    renameMerchantTo: v.optional(v.string()),
    setExcludeFromTotals: v.optional(v.boolean()),
    setNeedsReview: v.optional(v.boolean()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Require at least one matching criterion
    if (
      !args.matchMerchantContains &&
      !args.matchMerchantExact &&
      !args.matchNoteContains &&
      args.matchAmountMinCents === undefined &&
      args.matchAmountMaxCents === undefined &&
      !args.matchAccountId
    ) {
      throw new Error("At least one matching criterion is required");
    }

    // Require at least one action
    if (
      !args.assignCategoryId &&
      !args.assignCategory &&
      !args.assignTags?.length &&
      !args.renameMerchantTo &&
      args.setExcludeFromTotals === undefined &&
      args.setNeedsReview === undefined
    ) {
      throw new Error("At least one action is required");
    }

    const now = Date.now();
    return await ctx.db.insert("categoryRules", {
      userId,
      name: args.name,
      matchMerchantContains: args.matchMerchantContains,
      matchMerchantExact: args.matchMerchantExact,
      matchNoteContains: args.matchNoteContains,
      matchAmountMinCents: args.matchAmountMinCents,
      matchAmountMaxCents: args.matchAmountMaxCents,
      matchAccountId: args.matchAccountId,
      assignCategoryId: args.assignCategoryId,
      assignCategory: args.assignCategory,
      assignTags: args.assignTags,
      renameMerchantTo: args.renameMerchantTo,
      setExcludeFromTotals: args.setExcludeFromTotals,
      setNeedsReview: args.setNeedsReview,
      priority: args.priority ?? 0,
      enabled: true,
      timesApplied: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a category rule
 */
export const updateCategoryRule = mutation({
  args: {
    id: v.id("categoryRules"),
    name: v.optional(v.string()),
    matchMerchantContains: v.optional(v.union(v.string(), v.null())),
    matchMerchantExact: v.optional(v.union(v.string(), v.null())),
    matchNoteContains: v.optional(v.union(v.string(), v.null())),
    matchAmountMinCents: v.optional(v.union(v.number(), v.null())),
    matchAmountMaxCents: v.optional(v.union(v.number(), v.null())),
    matchAccountId: v.optional(v.union(v.id("accounts"), v.null())),
    assignCategoryId: v.optional(v.union(v.id("categories"), v.null())),
    assignCategory: v.optional(v.union(v.string(), v.null())),
    assignTags: v.optional(v.union(v.array(v.string()), v.null())),
    renameMerchantTo: v.optional(v.union(v.string(), v.null())),
    setExcludeFromTotals: v.optional(v.union(v.boolean(), v.null())),
    setNeedsReview: v.optional(v.union(v.boolean(), v.null())),
    priority: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const rule = await ctx.db.get(args.id);
    if (!rule || rule.userId !== userId) {
      throw new Error("Rule not found");
    }

    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) {
        // Convert null to undefined for optional fields
        filtered[k] = val === null ? undefined : val;
      }
    }
    filtered.updatedAt = Date.now();

    await ctx.db.patch(id, filtered);
  },
});

/**
 * Delete a category rule
 */
export const deleteCategoryRule = mutation({
  args: { id: v.id("categoryRules") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const rule = await ctx.db.get(args.id);
    if (!rule || rule.userId !== userId) {
      throw new Error("Rule not found");
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Apply rules to an entry (called during addEntry or manually)
 * Returns the modifications that would be applied
 */
export const matchRulesForEntry = query({
  args: {
    merchantRaw: v.optional(v.string()),
    note: v.optional(v.string()),
    amountCents: v.number(),
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const rules = await ctx.db
      .query("categoryRules")
      .withIndex("by_user_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
      .collect();

    // Sort by priority
    rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const matches: Array<{
      ruleId: string;
      ruleName?: string;
      actions: Record<string, unknown>;
    }> = [];

    for (const rule of rules) {
      let isMatch = true;

      // Check merchant contains
      if (rule.matchMerchantContains && args.merchantRaw) {
        if (!args.merchantRaw.toLowerCase().includes(rule.matchMerchantContains.toLowerCase())) {
          isMatch = false;
        }
      } else if (rule.matchMerchantContains) {
        isMatch = false;
      }

      // Check merchant exact
      if (isMatch && rule.matchMerchantExact && args.merchantRaw) {
        if (args.merchantRaw.toLowerCase() !== rule.matchMerchantExact.toLowerCase()) {
          isMatch = false;
        }
      } else if (rule.matchMerchantExact) {
        isMatch = false;
      }

      // Check note contains
      if (isMatch && rule.matchNoteContains && args.note) {
        if (!args.note.toLowerCase().includes(rule.matchNoteContains.toLowerCase())) {
          isMatch = false;
        }
      } else if (rule.matchNoteContains) {
        isMatch = false;
      }

      // Check amount range
      if (isMatch && rule.matchAmountMinCents !== undefined) {
        if (args.amountCents < rule.matchAmountMinCents) {
          isMatch = false;
        }
      }
      if (isMatch && rule.matchAmountMaxCents !== undefined) {
        if (args.amountCents > rule.matchAmountMaxCents) {
          isMatch = false;
        }
      }

      // Check account
      if (isMatch && rule.matchAccountId) {
        if (args.accountId !== rule.matchAccountId) {
          isMatch = false;
        }
      }

      if (isMatch) {
        const actions: Record<string, unknown> = {};
        if (rule.assignCategoryId) actions.categoryId = rule.assignCategoryId;
        if (rule.assignCategory) actions.category = rule.assignCategory;
        if (rule.assignTags?.length) actions.tags = rule.assignTags;
        if (rule.renameMerchantTo) actions.merchantNormalized = rule.renameMerchantTo;
        if (rule.setExcludeFromTotals !== undefined) actions.excludeFromTotals = rule.setExcludeFromTotals;
        if (rule.setNeedsReview !== undefined) actions.needsReview = rule.setNeedsReview;

        matches.push({
          ruleId: rule._id,
          ruleName: rule.name,
          actions,
        });
      }
    }

    return matches;
  },
});

// ============================================
// MERCHANT RULES - Merchant renaming/normalization
// ============================================

/**
 * List all merchant rules
 */
export const listMerchantRules = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    return await ctx.db
      .query("merchantRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Create a merchant rule
 */
export const createMerchantRule = mutation({
  args: {
    matchPattern: v.string(),
    matchType: v.union(v.literal("exact"), v.literal("contains"), v.literal("regex")),
    normalizedName: v.string(),
    defaultCategoryId: v.optional(v.id("categories")),
    defaultCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const now = Date.now();
    return await ctx.db.insert("merchantRules", {
      userId,
      matchPattern: args.matchPattern,
      matchType: args.matchType,
      normalizedName: args.normalizedName,
      defaultCategoryId: args.defaultCategoryId,
      defaultCategory: args.defaultCategory,
      timesApplied: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Match merchant and return normalized name
 */
export const matchMerchant = query({
  args: { merchantRaw: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const rules = await ctx.db
      .query("merchantRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const input = args.merchantRaw.toLowerCase();

    for (const rule of rules) {
      let isMatch = false;

      switch (rule.matchType) {
        case "exact":
          isMatch = input === rule.matchPattern.toLowerCase();
          break;
        case "contains":
          isMatch = input.includes(rule.matchPattern.toLowerCase());
          break;
        case "regex":
          try {
            const re = new RegExp(rule.matchPattern, "i");
            isMatch = re.test(args.merchantRaw);
          } catch {
            // Invalid regex, skip
          }
          break;
      }

      if (isMatch) {
        return {
          normalizedName: rule.normalizedName,
          defaultCategoryId: rule.defaultCategoryId,
          defaultCategory: rule.defaultCategory,
        };
      }
    }

    return null;
  },
});
