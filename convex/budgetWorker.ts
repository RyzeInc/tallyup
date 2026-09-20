import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_ATTEMPTS = 5;

/**
 * Entry dates are local midnight, which can land on either side of a UTC day
 * boundary. The range only decides which periods get materialized, so padding it
 * by a day guarantees the period covering `ts` exists without changing any total.
 */
function dayRange(ts: number): { start: number; end: number } {
  const start = new Date(ts);
  start.setUTCHours(0, 0, 0, 0);
  return { start: start.getTime() - DAY_MS, end: start.getTime() + 2 * DAY_MS - 1 };
}

export const processBudgetDirtyQueue = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 25;
    const pending = await ctx.db
      .query("budgetDirtyQueue")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(batchSize);

    let processed = 0;
    let failed = 0;
    for (const item of pending) {
      await ctx.db.patch(item._id, { status: "processing", updatedAt: Date.now() });
      try {
        const planIds = new Set<Id<"budgetPlans">>();

        if (item.planId) {
          planIds.add(item.planId);
        } else {
          const budgetCategoryId = item.budgetCategoryId;
          if (!budgetCategoryId) {
            await ctx.db.delete(item._id);
            processed += 1;
            continue;
          }
          const directPlans = await ctx.db
            .query("budgetPlans")
            .withIndex("by_user_category", (q) =>
              q.eq("userId", item.userId).eq("budgetCategoryId", budgetCategoryId)
            )
            .collect();
          for (const p of directPlans) planIds.add(p._id);

          const groups = await ctx.db
            .query("budgetGroupMembers")
            .withIndex("by_category", (q) => q.eq("budgetCategoryId", budgetCategoryId))
            .collect();
          for (const g of groups) {
            const groupPlans = await ctx.db
              .query("budgetPlans")
              .withIndex("by_user_group", (q) =>
                q.eq("userId", item.userId).eq("budgetGroupId", g.budgetGroupId)
              )
              .collect();
            for (const p of groupPlans) planIds.add(p._id);
          }
        }

        const { start, end } = dayRange(item.dirtyDate);

        for (const planId of planIds) {
          await ctx.runMutation(internal.budgetEngine.materializeBudgetPeriodsInternal, {
            userId: item.userId,
            planId,
            rangeStart: start,
            rangeEnd: end,
          });

          const period = await ctx.db
            .query("budgetPeriods")
            .withIndex("by_user_plan_period", (q) =>
              q.eq("userId", item.userId).eq("planId", planId).lte("periodStart", item.dirtyDate)
            )
            .order("desc")
            .take(1);

          if (period.length && period[0].periodEnd >= item.dirtyDate) {
            await ctx.runMutation(internal.budgetEngine.recomputeBudgetPeriod, {
              periodId: period[0]._id,
            });
          }
        }

        // Drop the row rather than marking it done; nothing reads completed work and
        // leaving them behind grows the table with every transaction edit.
        await ctx.db.delete(item._id);
        processed += 1;
      } catch (error) {
        console.error("Budget dirty queue processing failed", error);
        const attempts = (item.attempts ?? 0) + 1;
        await ctx.db.patch(item._id, {
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        });
        failed += 1;
      }
    }

    return { ok: true, processed, failed };
  },
});
