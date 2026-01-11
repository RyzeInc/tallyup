import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// USER PREFERENCES - Settings and configuration
// ============================================

/**
 * Get user preferences for the current user
 */
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return prefs;
  },
});

/**
 * Create or update user preferences
 */
export const upsertUserPreferences = mutation({
  args: {
    // Review reminder settings
    reviewReminderEnabled: v.optional(v.boolean()),
    reviewReminderDay: v.optional(v.string()),
    reviewReminderTime: v.optional(v.string()),
    reviewReminderFrequency: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    )),
    
    // UI preferences
    defaultTab: v.optional(v.string()),
    compactMode: v.optional(v.boolean()),
    
    // Category customization
    hiddenExpenseCategories: v.optional(v.array(v.string())),
    hiddenIncomeCategories: v.optional(v.array(v.string())),
    hiddenContextTags: v.optional(v.array(v.string())),
    expenseCategoryOrder: v.optional(v.array(v.string())),
    incomeCategoryOrder: v.optional(v.array(v.string())),
    contextTagOrder: v.optional(v.array(v.string())),
    pinnedExpenseCategories: v.optional(v.array(v.string())),
    pinnedIncomeCategories: v.optional(v.array(v.string())),
    pinnedContextTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    // Build updates object from all provided args
    const updates: Record<string, unknown> = { updatedAt: now };
    const fields = [
      "reviewReminderEnabled", "reviewReminderDay", "reviewReminderTime", "reviewReminderFrequency",
      "defaultTab", "compactMode",
      "hiddenExpenseCategories", "hiddenIncomeCategories", "hiddenContextTags",
      "expenseCategoryOrder", "incomeCategoryOrder", "contextTagOrder",
      "pinnedExpenseCategories", "pinnedIncomeCategories", "pinnedContextTags",
    ] as const;

    for (const field of fields) {
      if (args[field] !== undefined) {
        updates[field] = args[field];
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      return await ctx.db.insert("userPreferences", {
        userId,
        ...updates,
        createdAt: now,
      });
    }
  },
});

/**
 * Toggle a specific preference
 */
export const togglePreference = mutation({
  args: {
    key: v.union(
      v.literal("reviewReminderEnabled"),
      v.literal("compactMode")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existing) {
      const currentValue = existing[args.key] ?? false;
      await ctx.db.patch(existing._id, {
        [args.key]: !currentValue,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        [args.key]: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
