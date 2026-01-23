import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  SYSTEM_CATEGORY_BY_NAME,
  SYSTEM_CATEGORY_BY_SLUG,
  normalizeCategoryLabel,
  type CategoryType,
} from "./categoryCatalog";

async function ensureSystemCategory(
  ctx: MutationCtx,
  userId: string,
  system: { slug: string; name: string; categoryType: CategoryType }
): Promise<Id<"categories">> {
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_user_slug", (q) =>
      q.eq("userId", userId).eq("slug", system.slug)
    )
    .first();

  if (existing) return existing._id;

  const now = Date.now();
  return await ctx.db.insert("categories", {
    userId,
    name: system.name,
    slug: system.slug,
    categoryType: system.categoryType,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function resolveCategoryId(
  ctx: MutationCtx,
  userId: string,
  categoryValue: string | undefined,
  categoryType: CategoryType,
  options?: { createIfMissing?: boolean }
): Promise<Id<"categories"> | undefined> {
  const trimmed = categoryValue?.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === "uncategorized") return undefined;

  try {
    const byId = await ctx.db.get(trimmed as Id<"categories">);
    if (byId && byId.userId === userId) return byId._id;
  } catch {
    // ignore invalid ids
  }

  const slug = trimmed.toLowerCase();
  const bySystemSlug = SYSTEM_CATEGORY_BY_SLUG.get(slug);
  if (bySystemSlug) {
    return await ensureSystemCategory(ctx, userId, bySystemSlug);
  }

  const normalized = normalizeCategoryLabel(trimmed);
  const bySystemName = SYSTEM_CATEGORY_BY_NAME.get(normalized);
  if (bySystemName) {
    return await ensureSystemCategory(ctx, userId, bySystemName);
  }

  const bySlug = await ctx.db
    .query("categories")
    .withIndex("by_user_slug", (q) => q.eq("userId", userId).eq("slug", slug))
    .first();
  if (bySlug) return bySlug._id;

  const existing = await ctx.db
    .query("categories")
    .withIndex("by_user_type", (q) =>
      q.eq("userId", userId).eq("categoryType", categoryType)
    )
    .collect();

  const byName = existing.find(
    (c) => normalizeCategoryLabel(c.name) === normalized
  );
  if (byName) return byName._id;

  if (!options?.createIfMissing) return undefined;

  const now = Date.now();
  return await ctx.db.insert("categories", {
    userId,
    name: trimmed,
    categoryType,
    createdAt: now,
    updatedAt: now,
  });
}
