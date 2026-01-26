import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { SYSTEM_CATEGORIES } from "./categoryCatalog";

type MatchInput = {
  category?: string;
  categoryId?: Id<"categories">;
  subcategory?: string;
  subcategoryId?: Id<"categories">;
  merchant?: string;
  tags?: string[];
};

function normalize(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : undefined;
}

// Build a lookup map from category name to canonical slug
const systemCategoryByName = new Map(
  SYSTEM_CATEGORIES.map(c => [c.name.toLowerCase(), c.slug])
);

/**
 * Resolve the canonical slug for a category.
 * Uses the category's slug field if present, otherwise looks up in SYSTEM_CATEGORIES by name.
 * Falls back to generating a slug from the name if not found.
 */
function resolveCanonicalSlug(cat: { slug?: string | null; name?: string | null }): string | undefined {
  // First, use the stored slug if available
  if (cat.slug) {
    return cat.slug.toLowerCase();
  }
  
  // Look up in system catalog by name
  if (cat.name) {
    const nameLower = cat.name.toLowerCase();
    const systemSlug = systemCategoryByName.get(nameLower);
    if (systemSlug) {
      return systemSlug.toLowerCase();
    }
    // Final fallback: generate slug from name
    return nameLower.replace(/\s+/g, "_");
  }
  
  return undefined;
}

export async function resolveBudgetCategoryId(
  ctx: MutationCtx,
  userId: string,
  input: MatchInput
): Promise<Id<"budgetCategories"> | undefined> {
  const budgets = await ctx.db
    .query("budgetCategories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  // Resolve category and subcategory slugs from IDs if provided
  let categorySlug: string | undefined;
  let subcategorySlug: string | undefined;
  
  if (input.subcategoryId) {
    const subcat = await ctx.db.get(input.subcategoryId);
    if (subcat && subcat.userId === userId) {
      subcategorySlug = resolveCanonicalSlug(subcat);
    }
  }
  
  if (input.categoryId) {
    const cat = await ctx.db.get(input.categoryId);
    if (cat && cat.userId === userId) {
      categorySlug = resolveCanonicalSlug(cat);
    }
  }
  
  // Fallback to string inputs
  const categoryKey = normalize(input.category);
  const subcategoryKey = subcategorySlug ?? normalize(input.subcategory);
  const effectiveCategorySlug = categorySlug ?? categoryKey;
  const merchantKey = normalize(input.merchant);
  const tagKeys = new Set((input.tags ?? []).map(normalize).filter(Boolean) as string[]);

  // Priority 1: Try to match subcategory slug first (most specific)
  if (subcategoryKey) {
    for (const budget of budgets) {
      if (budget.archived) continue;
      if (budget.matchCategories?.some((c) => normalize(c) === subcategoryKey)) {
        return budget._id;
      }
    }
  }

  // Priority 2: Match on category slug (from categoryId or string)
  if (effectiveCategorySlug) {
    for (const budget of budgets) {
      if (budget.archived) continue;
      if (budget.matchCategories?.some((c) => normalize(c) === effectiveCategorySlug)) {
        return budget._id;
      }
    }
  }

  // Priority 3: Match on category display name (fallback)
  if (categoryKey && categoryKey !== effectiveCategorySlug) {
    for (const budget of budgets) {
      if (budget.archived) continue;
      if (budget.matchCategories?.some((c) => normalize(c) === categoryKey)) {
        return budget._id;
      }
    }
  }

  // Priority 4: Match on merchant
  for (const budget of budgets) {
    if (budget.archived) continue;
    if (merchantKey && budget.matchMerchants?.some((m) => normalize(m) === merchantKey)) {
      return budget._id;
    }
  }

  // Priority 5: Match on tags
  for (const budget of budgets) {
    if (budget.archived) continue;
    if (tagKeys.size && budget.matchTags?.some((t) => tagKeys.has(normalize(t) ?? ""))) {
      return budget._id;
    }
  }

  return undefined;
}
