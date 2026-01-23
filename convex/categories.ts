import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { SYSTEM_CATEGORIES } from "./categoryCatalog";
import { Id } from "./_generated/dataModel";

// ============================================
// CATEGORIES QUERIES & MUTATIONS
// ============================================

/**
 * Fix parent relationships for all categories.
 * Matches categories by name (case-insensitive) to SYSTEM_CATEGORIES
 * and sets proper parentId values.
 */
export const fixParentRelationships = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const allCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    let fixed = 0;
    let slugsAdded = 0;
    const debugInfo: string[] = [];

    // Build lookup maps by name and slug (case-insensitive)
    const byName = new Map<string, typeof allCategories[0]>();
    const bySlug = new Map<string, typeof allCategories[0]>();
    for (const cat of allCategories) {
      byName.set(cat.name.toLowerCase(), cat);
      if (cat.slug) {
        bySlug.set(cat.slug.toLowerCase(), cat);
      }
    }

    // Build system category lookups
    const systemBySlug = new Map(SYSTEM_CATEGORIES.map(c => [c.slug.toLowerCase(), c]));
    const systemByName = new Map(SYSTEM_CATEGORIES.map(c => [c.name.toLowerCase(), c]));
    
    // Debug: List first 10 DB category names
    const dbNames = allCategories.slice(0, 15).map(c => c.name);
    debugInfo.push(`DB names sample: ${dbNames.join(", ")}`);
    
    // Debug: List first 10 system category names
    const sysNames = SYSTEM_CATEGORIES.slice(0, 15).map(c => c.name);
    debugInfo.push(`System names sample: ${sysNames.join(", ")}`);
    
    // Build parent name -> ID mapping
    const parentNameToId = new Map<string, Id<"categories">>();
    for (const system of SYSTEM_CATEGORIES.filter(c => !c.parentSlug)) {
      const dbCat = byName.get(system.name.toLowerCase()) ?? bySlug.get(system.slug.toLowerCase());
      if (dbCat) {
        parentNameToId.set(system.name.toLowerCase(), dbCat._id);
        parentNameToId.set(system.slug.toLowerCase(), dbCat._id);
      }
    }
    
    debugInfo.push(`Found ${parentNameToId.size / 2} parent categories in DB`);

    // Now fix all child categories
    for (const cat of allCategories) {
      // Try to match to system category by slug or name
      const systemCat = (cat.slug ? systemBySlug.get(cat.slug.toLowerCase()) : null) ?? 
                       systemByName.get(cat.name.toLowerCase());
      
      if (!systemCat) continue; // Not a system category, skip
      
      // Update slug if missing
      if (!cat.slug && systemCat.slug) {
        await ctx.db.patch(cat._id, {
          slug: systemCat.slug,
          updatedAt: now,
        });
        slugsAdded++;
      }

      // Fix parentId
      if (systemCat.parentSlug) {
        // This is a child category - find its parent
        const parentSystem = SYSTEM_CATEGORIES.find(c => c.slug.toLowerCase() === systemCat.parentSlug!.toLowerCase());
        if (parentSystem) {
          const parentId = parentNameToId.get(parentSystem.name.toLowerCase()) ?? 
                          parentNameToId.get(parentSystem.slug.toLowerCase());
          
          if (parentId && cat.parentId !== parentId) {
            await ctx.db.patch(cat._id, {
              parentId,
              updatedAt: now,
            });
            fixed++;
          }
        }
      } else if (cat.parentId) {
        // This should be a top-level category but has parentId - remove it
        await ctx.db.patch(cat._id, {
          parentId: undefined,
          updatedAt: now,
        });
        fixed++;
      }
    }

    return { fixed, slugsAdded, total: allCategories.length, debug: debugInfo };
  },
});

/**
 * List all categories for the current user (hierarchical)
 */
export const listCategories = query({
  args: {
    categoryType: v.optional(v.union(v.literal("expense"), v.literal("income"), v.literal("transfer"))),
    includeArchived: v.optional(v.boolean()),
    /** If true, only return top-level (parent) categories, not subcategories */
    topLevelOnly: v.optional(v.boolean()),
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

    // Filter to top-level only (no parentId)
    if (args.topLevelOnly) {
      categories = categories.filter((c) => !c.parentId);
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
 * Creates categories in two passes:
 * 1. Create all categories (parents first, then children)
 * 2. Link children to parents via parentId
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

    // Build lookup of existing categories by slug
    const existingBySlug = new Map(
      existing.map((c) => [c.slug?.toLowerCase() ?? "", c])
    );

    const now = Date.now();
    let created = 0;
    
    // Map to track newly created categories by slug for parent linking
    const newCategoriesBySlug = new Map<string, Id<"categories">>(); // slug -> _id

    // First pass: Create all categories that don't exist
    // Process parents first (no parentSlug), then children
    const parents = SYSTEM_CATEGORIES.filter(c => !c.parentSlug);
    const children = SYSTEM_CATEGORIES.filter(c => c.parentSlug);
    
    for (const system of [...parents, ...children]) {
      const slugLower = system.slug.toLowerCase();
      if (existingBySlug.has(slugLower)) {
        // Already exists, track its ID for child linking
        const existingCat = existingBySlug.get(slugLower)!;
        newCategoriesBySlug.set(slugLower, existingCat._id);
        continue;
      }
      
      // Find parent ID if this is a child category
      let parentId: Id<"categories"> | undefined;
      if (system.parentSlug) {
        const parentSlugLower = system.parentSlug.toLowerCase();
        // Check existing categories first
        if (existingBySlug.has(parentSlugLower)) {
          parentId = existingBySlug.get(parentSlugLower)!._id;
        } else if (newCategoriesBySlug.has(parentSlugLower)) {
          // Or check newly created categories
          parentId = newCategoriesBySlug.get(parentSlugLower);
        }
      }
      
      const newId = await ctx.db.insert("categories", {
        userId,
        name: system.name,
        slug: system.slug,
        categoryType: system.categoryType,
        parentId,
        icon: system.icon,
        displayOrder: system.displayOrder,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
      
      newCategoriesBySlug.set(slugLower, newId);
      created += 1;
    }

    // Second pass: Update any existing categories that are missing parentId
    for (const system of children) {
      if (!system.parentSlug) continue;
      
      const slugLower = system.slug.toLowerCase();
      const existing = existingBySlug.get(slugLower);
      
      if (existing && !existing.parentId) {
        // This category exists but doesn't have a parentId - fix it
        const parentSlugLower = system.parentSlug.toLowerCase();
        const parentId = existingBySlug.get(parentSlugLower)?._id ?? 
                        newCategoriesBySlug.get(parentSlugLower);
        
        if (parentId) {
          await ctx.db.patch(existing._id, {
            parentId,
            icon: system.icon ?? existing.icon,
            displayOrder: system.displayOrder ?? existing.displayOrder,
            updatedAt: now,
          });
        }
      }
    }

    return { created };
  },
});

/**
 * Clean up duplicate categories for the user.
 * Keeps only one category per slug, preferring system categories.
 * Also fixes parentId relationships.
 */
export const cleanupDuplicateCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const allCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    let deleted = 0;
    let fixed = 0;

    // Group by slug (case insensitive)
    const bySlug = new Map<string, typeof allCategories>();
    for (const cat of allCategories) {
      const slug = (cat.slug ?? cat.name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const existing = bySlug.get(slug) ?? [];
      existing.push(cat);
      bySlug.set(slug, existing);
    }

    // Also group by name for categories without slugs
    const byName = new Map<string, typeof allCategories>();
    for (const cat of allCategories) {
      const name = cat.name.toLowerCase();
      const existing = byName.get(name) ?? [];
      existing.push(cat);
      byName.set(name, existing);
    }

    // Build a map of slug -> kept category ID for parent linking
    const keptBySlug = new Map<string, Id<"categories">>();

    // First pass: identify duplicates by slug and delete extras
    for (const [slug, cats] of bySlug) {
      if (cats.length <= 1) {
        if (cats[0]) keptBySlug.set(slug, cats[0]._id);
        continue;
      }

      // Sort: prefer isSystem=true, then oldest createdAt
      cats.sort((a, b) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });

      // Keep the first one, delete the rest
      const keeper = cats[0];
      keptBySlug.set(slug, keeper._id);

      for (let i = 1; i < cats.length; i++) {
        await ctx.db.delete(cats[i]._id);
        deleted++;
      }
    }

    // Second pass: handle duplicates by name (for categories without slugs)
    for (const [name, cats] of byName) {
      if (cats.length <= 1) continue;

      // Filter to only categories that weren't already handled by slug
      const remaining = cats.filter(c => {
        const slug = (c.slug ?? c.name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const kept = keptBySlug.get(slug);
        return kept === c._id || !kept;
      });

      if (remaining.length <= 1) continue;

      // Sort: prefer isSystem=true, then oldest createdAt
      remaining.sort((a, b) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });

      // Keep the first one, delete the rest
      for (let i = 1; i < remaining.length; i++) {
        // Check if this one was kept by slug check
        const slug = (remaining[i].slug ?? remaining[i].name).toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if (keptBySlug.get(slug) === remaining[i]._id) continue;
        
        await ctx.db.delete(remaining[i]._id);
        deleted++;
      }
    }

    // Third pass: fix parentId relationships based on SYSTEM_CATEGORIES
    const systemBySlug = new Map(SYSTEM_CATEGORIES.map(c => [c.slug.toLowerCase(), c]));
    
    // Re-fetch after deletions
    const remainingCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Build lookup by slug
    const remainingBySlug = new Map<string, typeof remainingCategories[0]>();
    for (const cat of remainingCategories) {
      if (cat.slug) {
        remainingBySlug.set(cat.slug.toLowerCase(), cat);
      }
    }

    // Fix parentId for system categories
    for (const cat of remainingCategories) {
      if (!cat.slug) continue;
      
      const systemCat = systemBySlug.get(cat.slug.toLowerCase());
      if (!systemCat) continue;

      // Check if this should have a parent
      if (systemCat.parentSlug) {
        const parent = remainingBySlug.get(systemCat.parentSlug.toLowerCase());
        if (parent && cat.parentId !== parent._id) {
          await ctx.db.patch(cat._id, {
            parentId: parent._id,
            isSystem: true,
            updatedAt: now,
          });
          fixed++;
        }
      } else if (cat.parentId) {
        // This is a top-level category but has a parentId - remove it
        await ctx.db.patch(cat._id, {
          parentId: undefined,
          isSystem: true,
          updatedAt: now,
        });
        fixed++;
      }

      // Mark as system category if it has a slug matching our catalog
      if (!cat.isSystem) {
        await ctx.db.patch(cat._id, {
          isSystem: true,
          updatedAt: now,
        });
        fixed++;
      }
    }

    return { deleted, fixed };
  },
});

/**
 * NUCLEAR OPTION: Reset all categories to system defaults.
 * This will DELETE all existing categories and recreate them fresh from the catalog.
 * Use this when the category data is too corrupted to fix incrementally.
 */
export const resetCategoriesToDefaults = mutation({
  args: {
    /** Set to true to confirm you want to delete all categories */
    confirm: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must set confirm: true to reset categories");
    }
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Delete ALL existing categories for this user
    const allCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let deleted = 0;
    for (const cat of allCategories) {
      await ctx.db.delete(cat._id);
      deleted++;
    }

    // Now recreate from the catalog with proper parent relationships
    const now = Date.now();
    let created = 0;
    let parentsCreated = 0;
    let childrenCreated = 0;
    
    // Map to track created categories by slug for parent linking
    const createdBySlug = new Map<string, Id<"categories">>();

    // First pass: Create parent categories (no parentSlug)
    const parents = SYSTEM_CATEGORIES.filter(c => !c.parentSlug);
    for (const system of parents) {
      const newId = await ctx.db.insert("categories", {
        userId,
        name: system.name,
        slug: system.slug,
        categoryType: system.categoryType,
        icon: system.icon,
        displayOrder: system.displayOrder,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
      createdBySlug.set(system.slug.toLowerCase(), newId);
      created++;
      parentsCreated++;
    }

    // Second pass: Create child categories with parentId
    const children = SYSTEM_CATEGORIES.filter(c => c.parentSlug);
    for (const system of children) {
      const parentId = createdBySlug.get(system.parentSlug!.toLowerCase());
      
      if (!parentId) {
        console.log(`Warning: No parent found for ${system.name} (parentSlug: ${system.parentSlug})`);
      }
      
      const newId = await ctx.db.insert("categories", {
        userId,
        name: system.name,
        slug: system.slug,
        categoryType: system.categoryType,
        parentId, // This will be undefined if parent not found
        icon: system.icon,
        displayOrder: system.displayOrder,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
      createdBySlug.set(system.slug.toLowerCase(), newId);
      created++;
      childrenCreated++;
    }

    return { 
      deleted, 
      created,
      parentsCreated,
      childrenCreated,
      totalSystemCategories: SYSTEM_CATEGORIES.length,
    };
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
