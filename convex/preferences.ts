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

// ============================================
// DASHBOARD LAYOUT - Customizable widget arrangement
// ============================================

const widgetPlacementValidator = v.object({
  widgetId: v.string(),
  order: v.number(),
  size: v.union(
    v.literal("small"),
    v.literal("medium"),
    v.literal("large"),
    v.literal("full")
  ),
  visible: v.boolean(),
  settings: v.optional(v.any()),
});

const dashboardLayoutValidator = v.object({
  version: v.number(),
  widgets: v.array(widgetPlacementValidator),
  updatedAt: v.number(),
});

/**
 * Get user's dashboard layout
 */
export const getDashboardLayout = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return prefs?.dashboardLayout ?? null;
  },
});

/**
 * Save the entire dashboard layout
 */
export const saveDashboardLayout = mutation({
  args: {
    layout: dashboardLayoutValidator,
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
    const layoutWithTimestamp = {
      ...args.layout,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        dashboardLayout: layoutWithTimestamp,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        dashboardLayout: layoutWithTimestamp,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update a single widget's placement (for quick changes)
 */
export const updateWidgetPlacement = mutation({
  args: {
    widgetId: v.string(),
    order: v.optional(v.number()),
    size: v.optional(v.union(
      v.literal("small"),
      v.literal("medium"),
      v.literal("large"),
      v.literal("full")
    )),
    visible: v.optional(v.boolean()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (!prefs?.dashboardLayout) {
      // No layout exists, can't update individual widget
      throw new Error("No dashboard layout exists");
    }

    const widgets = prefs.dashboardLayout.widgets.map((w) => {
      if (w.widgetId === args.widgetId) {
        return {
          ...w,
          ...(args.order !== undefined && { order: args.order }),
          ...(args.size !== undefined && { size: args.size }),
          ...(args.visible !== undefined && { visible: args.visible }),
          ...(args.settings !== undefined && { settings: args.settings }),
        };
      }
      return w;
    });

    await ctx.db.patch(prefs._id, {
      dashboardLayout: {
        ...prefs.dashboardLayout,
        widgets,
        updatedAt: now,
      },
      updatedAt: now,
    });
  },
});

/**
 * Reset dashboard to default layout
 */
export const resetDashboardLayout = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (prefs) {
      await ctx.db.patch(prefs._id, {
        dashboardLayout: undefined, // Remove to use default
        updatedAt: now,
      });
    }
  },
});
