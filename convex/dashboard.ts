import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

type RecurringRuleDoc = Doc<"recurringRules">;
type ExpectedChargeDoc = Doc<"expectedCharges">;
type BudgetCategoryDoc = Doc<"budgetCategories">;

async function requireUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

/**
 * Dashboard data bundle - fetches all data needed for dashboard modules in a single query
 * This prevents N+1 queries and improves dashboard load time
 */
export const getDashboardData = query({
  args: {
    periodStart: v.number(),
    periodEnd: v.number(),
    upcomingDays: v.optional(v.number()), // How many days ahead to look for upcoming bills (default 30)
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const upcomingDays = args.upcomingDays ?? 30;
    const upcomingEnd = now + upcomingDays * 24 * 60 * 60 * 1000;

    // 1. Get upcoming expected charges (bills)
    const upcomingCharges = await ctx.db
      .query("expectedCharges")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("expectedDate", now).lte("expectedDate", upcomingEnd)
      )
      .collect();

    // Filter to only upcoming/due states
    const filteredCharges = upcomingCharges.filter(
      (c) => c.state === "upcoming" || c.state === "due"
    );

    // Get rule details for charges
    const chargeRuleIds = [...new Set(filteredCharges.map((c) => c.ruleId))];
    const rulesMap = new Map<string, RecurringRuleDoc>();
    for (const ruleId of chargeRuleIds) {
      const rule = await ctx.db.get(ruleId);
      if (rule) rulesMap.set(ruleId, rule);
    }

    // Enrich upcoming bills
    const upcomingBills = filteredCharges
      .map((charge) => {
        const rule = rulesMap.get(charge.ruleId);
        if (!rule) return null;
        return {
          id: charge._id,
          ruleId: charge.ruleId,
          name: rule.displayName ?? rule.name ?? rule.category ?? "Unknown",
          expectedDate: charge.expectedDate,
          amountCents: charge.expectedAmountCents ?? rule.amountCents ?? rule.amountPolicy?.amountCents ?? 0,
          type: rule.type,
          category: rule.category,
          state: charge.state,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => a.expectedDate - b.expectedDate)
      .slice(0, 10); // Limit to 10 upcoming bills

    // 2. Get income recurring rules for payday detection
    const incomeRules = await ctx.db
      .query("recurringRules")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("active", true))
      .filter((q) => q.eq(q.field("type"), "income"))
      .collect();

    // Find expected income charges
    const incomeCharges = await ctx.db
      .query("expectedCharges")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("expectedDate", now).lte("expectedDate", upcomingEnd)
      )
      .collect();

    const incomeRuleIds = new Set(incomeRules.map((r) => r._id));
    const upcomingIncome = incomeCharges
      .filter((c) => incomeRuleIds.has(c.ruleId) && (c.state === "upcoming" || c.state === "due"))
      .map((charge) => {
        const rule = incomeRules.find((r) => r._id === charge.ruleId);
        return {
          id: charge._id,
          ruleId: charge.ruleId,
          name: rule?.displayName ?? rule?.name ?? rule?.category ?? "Income",
          expectedDate: charge.expectedDate,
          amountCents: charge.expectedAmountCents ?? rule?.amountCents ?? rule?.amountPolicy?.amountCents ?? 0,
          confidence: rule?.confidence ?? 50,
        };
      })
      .sort((a, b) => a.expectedDate - b.expectedDate);

    // Calculate next payday
    const nextPayday = upcomingIncome.length > 0 ? upcomingIncome[0] : null;

    // 3. Get budget categories and their status
    const budgetCategories = await ctx.db
      .query("budgetCategories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    // Get budget periods for the current range
    const budgetPeriods = await ctx.db
      .query("budgetPeriods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.lte(q.field("periodStart"), args.periodEnd),
          q.gte(q.field("periodEnd"), args.periodStart)
        )
      )
      .collect();

    // Map periods by budget category ID
    const periodsByCategory = new Map<string, typeof budgetPeriods[0]>();
    for (const period of budgetPeriods) {
      if (period.budgetCategoryId) {
        const existing = periodsByCategory.get(period.budgetCategoryId);
        // Keep the most recent period if multiple exist
        if (!existing || period.periodStart > existing.periodStart) {
          periodsByCategory.set(period.budgetCategoryId, period);
        }
      }
    }

    // Build budget status for each category
    const budgetStatus = budgetCategories.map((cat) => {
      const period = periodsByCategory.get(cat._id);
      const budgeted = period?.budgetedCents ?? cat.budgetAmountCents;
      const spent = period?.spentCents ?? 0;
      const available = period?.availableCents ?? (budgeted - spent);
      
      // Calculate pace if we have a period
      let paceDeltaCents = 0;
      let projectedEndCents = spent;
      if (period) {
        const periodLength = period.periodEnd - period.periodStart + 1;
        const elapsed = Math.max(0, Math.min(1, (now - period.periodStart + 1) / periodLength));
        const paceExpected = Math.round(budgeted * elapsed);
        paceDeltaCents = spent - paceExpected;
        projectedEndCents = elapsed > 0 ? Math.round(spent / elapsed) : spent;
      }

      const percentUsed = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
      const isOverBudget = projectedEndCents > budgeted;
      const isWarning = paceDeltaCents > 0 && !isOverBudget;

      return {
        id: cat._id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budgetedCents: budgeted,
        spentCents: spent,
        availableCents: available,
        percentUsed: Math.min(percentUsed, 100), // Cap at 100 for ring display
        paceDeltaCents,
        projectedEndCents,
        status: isOverBudget ? "over" as const : isWarning ? "warning" as const : "on-track" as const,
      };
    });

    // Sort by spent amount descending to show most active budgets first
    budgetStatus.sort((a, b) => b.spentCents - a.spentCents);

    // 4. Calculate Safe-to-Spend
    // Total remaining budget across all categories
    const totalBudgeted = budgetStatus.reduce((sum, b) => sum + b.budgetedCents, 0);
    const totalSpent = budgetStatus.reduce((sum, b) => sum + b.spentCents, 0);
    const totalAvailable = totalBudgeted - totalSpent;

    // Upcoming bills in the remaining period
    const periodEnd = args.periodEnd;
    const upcomingBillsInPeriod = upcomingBills.filter(
      (b) => b.expectedDate <= periodEnd && b.type === "expense"
    );
    const upcomingBillsTotal = upcomingBillsInPeriod.reduce((sum, b) => sum + b.amountCents, 0);

    // Days remaining in period
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.max(1, Math.ceil((periodEnd - now) / msPerDay));

    // Safe to spend = (Available - Upcoming Bills) / Days Remaining
    const safeToSpendTotal = Math.max(0, totalAvailable - upcomingBillsTotal);
    const dailyAllowance = Math.round(safeToSpendTotal / daysRemaining);

    // 5. Get review count
    const reviewEntries = await ctx.db
      .query("entries")
      .withIndex("by_user_needsReview_date", (q) => q.eq("userId", userId).eq("needsReview", true))
      .collect();
    const reviewCount = reviewEntries.length;

    return {
      upcomingBills,
      nextPayday,
      upcomingIncome,
      budgetStatus: budgetStatus.slice(0, 8), // Top 8 budgets
      safeToSpend: {
        totalAvailableCents: totalAvailable,
        upcomingBillsCents: upcomingBillsTotal,
        upcomingBillsCount: upcomingBillsInPeriod.length,
        safeToSpendCents: safeToSpendTotal,
        dailyAllowanceCents: dailyAllowance,
        daysRemaining,
      },
      reviewCount,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    };
  },
});
