import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getReviewReason, REVIEW_REASONS } from "../lib/constants";

/**
 * Migration: Backfill category from bucket for entries that only have bucket
 * 
 * To run this migration:
 * 1. In your terminal: npx convex run migrations:backfillCategoryFromBucket
 * 2. Check status: npx convex run migrations:checkMigrationStatus
 * 
 * This is safe to run multiple times - it only updates entries missing category
 */
export const backfillCategoryFromBucket = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    
    // Find entries that have bucket but no category
    const entries = await ctx.db
      .query("entries")
      .collect();
    
    let migrated = 0;
    const updates: Promise<unknown>[] = [];
    
    for (const entry of entries) {
      if (!entry.category && entry.bucket) {
        updates.push(
          ctx.db.patch(entry._id, {
            category: entry.bucket,
            updatedAt: Date.now(),
          })
        );
        migrated++;
        
        // Process in batches to avoid overwhelming the system
        if (updates.length >= batchSize) {
          await Promise.all(updates);
          updates.length = 0;
        }
      }
    }
    
    // Process remaining updates
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    return {
      success: true,
      migratedCount: migrated,
      totalChecked: entries.length,
    };
  },
});

/**
 * Helper query to check migration status
 */
export const checkMigrationStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("entries").collect();
    
    const stats = {
      total: entries.length,
      hasCategory: 0,
      hasOnlyBucket: 0,
      hasBoth: 0,
      hasNeither: 0,
    };
    
    for (const entry of entries) {
      if (entry.category && entry.bucket) {
        stats.hasBoth++;
      } else if (entry.category) {
        stats.hasCategory++;
      } else if (entry.bucket) {
        stats.hasOnlyBucket++;
      } else {
        stats.hasNeither++;
      }
    }
    
    return stats;
  },
});

// ============================================================
// ACCOUNT LINKS
// ============================================================

/**
 * Older transactions, and anything saved through the review flow before accounts
 * existed, carry the account's name in `methodOrAccount` with no `accountId`.
 * Activity now matches those by label, but the link itself is still missing, so
 * account pages and balances do not see them.
 *
 *   npx convex run migrations:reportAccountLinkBackfill '{"userId":"<clerk-id>"}'
 *   npx convex run migrations:backfillAccountLinksFromLabels '{"userId":"<clerk-id>","apply":true}'
 *
 * A name shared by two accounts is never guessed. Balances are deliberately left
 * alone: these entries were never applied to a snapshot, so they are recorded as
 * having had no balance impact and a later edit will not double-count them.
 * Re-enter the account's current balance afterwards if it needs correcting.
 */
const normalizeLabel = (value?: string | null) => value?.trim().toLowerCase() ?? "";

async function labelPlan(ctx: MutationCtx, userId: string) {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const byLabel = new Map<string, Id<"accounts">[]>();
  for (const account of accounts) {
    const key = normalizeLabel(account.name);
    if (!key) continue;
    byLabel.set(key, [...(byLabel.get(key) ?? []), account._id]);
  }

  const entries = await ctx.db
    .query("entries")
    .withIndex("by_user_date", (q) => q.eq("userId", userId))
    .collect();

  const linkable: { entryId: Id<"entries">; accountId: Id<"accounts"> }[] = [];
  const ambiguous = new Map<string, number>();
  const unmatched = new Map<string, number>();

  for (const entry of entries) {
    if (entry.accountId) continue;
    const key = normalizeLabel(entry.methodOrAccount);
    if (!key) continue;
    const matches = byLabel.get(key);
    if (!matches) unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
    else if (matches.length > 1) ambiguous.set(key, (ambiguous.get(key) ?? 0) + 1);
    else linkable.push({ entryId: entry._id, accountId: matches[0] });
  }

  return { accounts: accounts.length, scanned: entries.length, linkable, ambiguous, unmatched };
}

const asCounts = (map: Map<string, number>) =>
  [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

export const reportAccountLinkBackfill = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const plan = await labelPlan(ctx, args.userId);
    return {
      accounts: plan.accounts,
      entriesScanned: plan.scanned,
      wouldLink: plan.linkable.length,
      ambiguousLabels: asCounts(plan.ambiguous),
      unmatchedLabels: asCounts(plan.unmatched),
    };
  },
});

export const backfillAccountLinksFromLabels = internalMutation({
  args: { userId: v.string(), apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const plan = await labelPlan(ctx, args.userId);
    if (!args.apply) {
      return { applied: false, wouldLink: plan.linkable.length };
    }
    const now = Date.now();
    for (const { entryId, accountId } of plan.linkable) {
      await ctx.db.patch(entryId, {
        accountId,
        // Never applied to a snapshot, so a later edit must not reverse anything.
        balanceImpactCents: 0,
        updatedAt: now,
      });
    }
    return { applied: true, linked: plan.linkable.length, skipped: asCounts(plan.ambiguous) };
  },
});

/**
 * `getReviewReason` used to ignore `accountId`, so transactions logged with a real
 * account attached were stored as "Needs account" and sat in the review inbox.
 * The rule is fixed, but those stored flags only clear when an entry is edited.
 *
 *   npx convex run migrations:repairAccountReviewFlags '{"userId":"<clerk-id>"}'
 *   npx convex run migrations:repairAccountReviewFlags '{"userId":"<clerk-id>","apply":true}'
 *
 * Only entries whose recomputed reason is now clear are touched. Anything still
 * genuinely missing a category, context, or account is left in the inbox.
 */
export const repairAccountReviewFlags = internalMutation({
  args: { userId: v.string(), apply: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .collect();

    const stale = entries.filter((entry) => {
      if (entry.isArchived || entry.type === "transfer") return false;
      if (entry.reviewReason !== REVIEW_REASONS.NEEDS_ACCOUNT && !entry.needsReview) return false;
      if (!entry.accountId) return false;
      return (
        getReviewReason({
          category: entry.category,
          contextTags: entry.contextTags,
          intentTags: entry.intentTags,
          amountCents: entry.amountCents,
          methodOrAccount: entry.methodOrAccount,
          accountId: entry.accountId,
        }) === null && !!entry.categoryId
      );
    });

    if (!args.apply) return { applied: false, wouldClear: stale.length };

    const now = Date.now();
    for (const entry of stale) {
      await ctx.db.patch(entry._id, {
        needsReview: false,
        reviewReason: undefined,
        updatedAt: now,
      });
    }
    return { applied: true, cleared: stale.length };
  },
});
