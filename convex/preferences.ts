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
      // Update existing preferences
      const updates: Record<string, unknown> = { updatedAt: now };
      
      if (args.reviewReminderEnabled !== undefined) {
        updates.reviewReminderEnabled = args.reviewReminderEnabled;
      }
      if (args.reviewReminderDay !== undefined) {
        updates.reviewReminderDay = args.reviewReminderDay;
      }
      if (args.reviewReminderTime !== undefined) {
        updates.reviewReminderTime = args.reviewReminderTime;
      }
      if (args.reviewReminderFrequency !== undefined) {
        updates.reviewReminderFrequency = args.reviewReminderFrequency;
      }
      if (args.defaultTab !== undefined) {
        updates.defaultTab = args.defaultTab;
      }
      if (args.compactMode !== undefined) {
        updates.compactMode = args.compactMode;
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      // Create new preferences
      return await ctx.db.insert("userPreferences", {
        userId,
        reviewReminderEnabled: args.reviewReminderEnabled,
        reviewReminderDay: args.reviewReminderDay,
        reviewReminderTime: args.reviewReminderTime,
        reviewReminderFrequency: args.reviewReminderFrequency,
        defaultTab: args.defaultTab,
        compactMode: args.compactMode,
        createdAt: now,
        updatedAt: now,
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
