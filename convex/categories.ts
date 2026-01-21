import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { SYSTEM_CATEGORIES } from "./categoryCatalog";

// ============================================
// CATEGORIES QUERIES & MUTATIONS
// ============================================

/**
 * List all categories for the current user (hierarchical)
 */
export const listCategories = query({
  args: {
    categoryType: v.optional(v.union(v.literal("expense"), v.literal("income"), v.literal("transfer"))),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by type if specified
    if (args.categoryType) {
      categories = categories.filter((c) => c.categoryType === args.categoryType);
    }

    // Filter archived
    if (!args.includeArchived) {
      categories = categories.filter((c) => !c.archived);
    }

    // Sort by display order, then name
    return categories.sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Ensure system categories exist for the user
 */
export const ensureSystemCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingSlugs = new Set(
      existing.map((c) => (c.slug ?? "").toLowerCase()).filter(Boolean)
    );

    const now = Date.now();
    let created = 0;
    for (const system of SYSTEM_CATEGORIES) {
      if (existingSlugs.has(system.slug.toLowerCase())) continue;
      await ctx.db.insert("categories", {
        userId,
        name: system.name,
        slug: system.slug,
        categoryType: system.categoryType,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }

    return { created };
  },
});

/**
 * Get category tree (nested structure)
 */
export const getCategoryTree = query({
  args: {
    categoryType: v.optional(v.union(v.literal("expense"), v.literal("income"), v.literal("transfer"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let categories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (args.categoryType) {
      categories = categories.filter((c) => c.categoryType === args.categoryType);
    }

    categories = categories.filter((c) => !c.archived);

    // Build tree structure
    const topLevel = categories.filter((c) => !c.parentId);
    const children = categories.filter((c) => c.parentId);

    interface CategoryNode {
      _id: string;
      name: string;
      icon?: string;
      color?: string;
      categoryType: string;
      children: CategoryNode[];
    }

    const buildNode = (cat: typeof categories[0]): CategoryNode => {
      const kids = children
        .filter((c) => c.parentId === cat._id)
        .map(buildNode)
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        _id: cat._id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        categoryType: cat.categoryType,
        children: kids,
      };
    };

    return topLevel.map(buildNode).sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single category by ID
 */
export const getCategory = query({
  args: { id: v.id("categories") },
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
 * Create a new category
 */
export const createCategory = mutation({
  args: {
    name: v.string(),
    categoryType: v.union(v.literal("expense"), v.literal("income"), v.literal("transfer")),
    parentId: v.optional(v.id("categories")),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    excludeFromBudgets: v.optional(v.boolean()),
    excludeFromReports: v.optional(v.boolean()),
    excludeFromCashFlow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Validate parent exists and belongs to user
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.userId !== userId) {
        throw new Error("Parent category not found");
      }
    }

    const now = Date.now();
    return await ctx.db.insert("categories", {
      userId,
      name: args.name,
      categoryType: args.categoryType,
      parentId: args.parentId,
      icon: args.icon,
      color: args.color,
      excludeFromBudgets: args.excludeFromBudgets,
      excludeFromReports: args.excludeFromReports,
      excludeFromCashFlow: args.excludeFromCashFlow,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a category
 */
export const updateCategory = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    parentId: v.optional(v.union(v.id("categories"), v.null())),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    excludeFromBudgets: v.optional(v.boolean()),
    excludeFromReports: v.optional(v.boolean()),
    excludeFromCashFlow: v.optional(v.boolean()),
    displayOrder: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }

    // Prevent system categories from being modified
    if (category.isSystem) {
      throw new Error("Cannot modify system category");
    }

    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) {
        // Handle null for parentId (move to top level)
        if (k === "parentId" && val === null) {
          filtered[k] = undefined;
        } else {
          filtered[k] = val;
        }
      }
    }
    filtered.updatedAt = Date.now();

    await ctx.db.patch(id, filtered);
  },
});

/**
 * Delete a category (archives it)
 */
export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }

    if (category.isSystem) {
      throw new Error("Cannot delete system category");
    }

    // Archive instead of hard delete
    await ctx.db.patch(args.id, {
      archived: true,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get the impact of archiving/deleting a category.
 * Use this to show a warning dialog before the action.
 */
export const getCategoryDeletionImpact = query({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) return null;

    // Count entries with this categoryId
    const linkedEntries = await ctx.db
      .query("entries")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("categoryId"), args.id)
        )
      )
      .collect();

    // Count child categories
    const childCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("parentId"), args.id))
      .collect();

    // Count category rules using this category
    const categoryRules = await ctx.db
      .query("categoryRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const rulesUsingCategory = categoryRules.filter((r) => r.assignCategoryId === args.id);

    // Count merchant rules using this category
    const merchantRules = await ctx.db
      .query("merchantRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const merchantRulesUsingCategory = merchantRules.filter((r) => r.defaultCategoryId === args.id);

    return {
      categoryName: category.name,
      categoryType: category.categoryType,
      isSystem: category.isSystem,
      linkedEntriesCount: linkedEntries.length,
      childCategoriesCount: childCategories.length,
      childCategoryNames: childCategories.map((c) => c.name),
      categoryRulesCount: rulesUsingCategory.length,
      merchantRulesCount: merchantRulesUsingCategory.length,
    };
  },
});

/**
 * Archive a category with proper cleanup.
 * This clears categoryId on linked entries and handles child categories.
 */
export const archiveCategory = mutation({
  args: {
    id: v.id("categories"),
    clearEntryLinks: v.optional(v.boolean()), // Default true - clear categoryId on entries
    promoteChildren: v.optional(v.boolean()), // Default true - promote children to top-level
    archiveChildren: v.optional(v.boolean()), // Alternative: also archive children
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }

    if (category.isSystem) {
      throw new Error("Cannot archive system category");
    }

    const now = Date.now();
    const clearEntryLinks = args.clearEntryLinks ?? true;
    const promoteChildren = args.promoteChildren ?? true;
    const archiveChildren = args.archiveChildren ?? false;

    // Handle child categories
    const childCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("parentId"), args.id))
      .collect();

    for (const child of childCategories) {
      if (archiveChildren) {
        // Recursively archive children
        await ctx.db.patch(child._id, { archived: true, updatedAt: now });
      } else if (promoteChildren) {
        // Promote to top-level (clear parentId)
        await ctx.db.patch(child._id, { parentId: undefined, updatedAt: now });
      }
    }

    // Clear categoryId on linked entries if requested
    if (clearEntryLinks) {
      const linkedEntries = await ctx.db
        .query("entries")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("categoryId"), args.id)
          )
        )
        .collect();

      for (const entry of linkedEntries) {
        await ctx.db.patch(entry._id, { categoryId: undefined, updatedAt: now });
      }
    }

    // Clear assignCategoryId on category rules that use this category
    const categoryRules = await ctx.db
      .query("categoryRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const rule of categoryRules) {
      if (rule.assignCategoryId === args.id) {
        await ctx.db.patch(rule._id, { assignCategoryId: undefined, updatedAt: now });
      }
    }

    // Clear defaultCategoryId on merchant rules that use this category
    const merchantRules = await ctx.db
      .query("merchantRules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const rule of merchantRules) {
      if (rule.defaultCategoryId === args.id) {
        await ctx.db.patch(rule._id, { defaultCategoryId: undefined, updatedAt: now });
      }
    }

    // Archive the category
    await ctx.db.patch(args.id, {
      archived: true,
      updatedAt: now,
    });

    return { 
      ok: true,
      childrenPromoted: promoteChildren ? childCategories.length : 0,
      childrenArchived: archiveChildren ? childCategories.length : 0,
    };
  },
});
