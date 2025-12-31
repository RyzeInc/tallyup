import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
