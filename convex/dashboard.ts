import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

type RecurringRuleDoc = Doc<"recurringRules">;

async function requireUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

/**
 * Get the latest snapshot for an account
 */
async function getLatestAccountSnapshot(
  ctx: Pick<QueryCtx, "db">,
  accountId: Id<"accounts">,
  beforeTs: number
) {
  const rows = await ctx.db
    .query("accountSnapshots")
    .withIndex("by_account_asOf", (q) =>
      q.eq("accountId", accountId).lt("asOf", beforeTs)
    )
    .order("desc")
    .take(1);
  return rows[0] ?? null;
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

    // ============================================================
    // 4. CROSS-ENTITY SAFE-TO-SPEND CALCULATION
    // Synchronized with: budgets, goals, recurring, accounts, transactions
    // ============================================================

    const periodEnd = args.periodEnd;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.max(1, Math.ceil((periodEnd - now) / msPerDay));

    // 4a. Get Account Balances (liquid cash available)
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    let totalCashBalance = 0;
    let totalCreditAvailable = 0;
    let totalDebtBalance = 0;
    const accountBalances: Array<{
      id: string;
      name: string;
      type: string;
      balanceCents: number;
      creditLimitCents?: number;
      availableCreditCents?: number;
    }> = [];

    for (const account of accounts) {
      const snapshot = await getLatestAccountSnapshot(ctx, account._id, now + 1);
      const balance = snapshot?.balance ?? 0;

      if (account.type === "checking" || account.type === "savings") {
        // Liquid cash accounts
        totalCashBalance += balance;
        accountBalances.push({
          id: account._id,
          name: account.name,
          type: account.type,
          balanceCents: balance,
        });
      } else if (account.type === "credit") {
        // Credit accounts - track debt and available credit
        const creditLimit = account.creditLimit ?? 0;
        const used = Math.abs(balance); // Credit balance is usually negative
        const available = Math.max(0, creditLimit - used);
        totalDebtBalance += used;
        totalCreditAvailable += available;
        accountBalances.push({
          id: account._id,
          name: account.name,
          type: account.type,
          balanceCents: -used, // Show as negative for debt
          creditLimitCents: creditLimit,
          availableCreditCents: available,
        });
      } else if (account.type === "loan") {
        // Loans - just track as debt
        totalDebtBalance += Math.abs(balance);
      }
    }

    // 4b. Get Active Goals (committed savings that reduce safe-to-spend)
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();

    let totalGoalCommitmentCents = 0;
    const activeGoals: Array<{
      id: string;
      name: string;
      targetCents: number;
      currentCents: number;
      remainingCents: number;
      monthlyContributionCents: number;
      periodContributionCents: number;
    }> = [];

    for (const goal of goals) {
      const remaining = Math.max(0, goal.targetAmountCents - goal.currentAmountCents);
      
      // Calculate monthly contribution needed or suggested
      let monthlyContribution = goal.suggestedMonthlyCents ?? 0;
      if (!monthlyContribution && goal.targetDate) {
        const monthsRemaining = Math.max(1, Math.ceil((goal.targetDate - now) / (30 * msPerDay)));
        monthlyContribution = Math.round(remaining / monthsRemaining);
      }

      // Pro-rate for current period (if period is roughly a month)
      const periodDays = Math.ceil((periodEnd - args.periodStart) / msPerDay);
      const periodContribution = Math.round((monthlyContribution * periodDays) / 30);

      totalGoalCommitmentCents += periodContribution;

      activeGoals.push({
        id: goal._id,
        name: goal.name,
        targetCents: goal.targetAmountCents,
        currentCents: goal.currentAmountCents,
        remainingCents: remaining,
        monthlyContributionCents: monthlyContribution,
        periodContributionCents: periodContribution,
      });
    }

    // 4c. Get Upcoming Recurring Expenses (bills due in period)
    const upcomingBillsInPeriod = upcomingBills.filter(
      (b) => b.expectedDate <= periodEnd && b.type === "expense"
    );
    const upcomingExpenseBillsTotal = upcomingBillsInPeriod.reduce((sum, b) => sum + b.amountCents, 0);

    // 4d. Get Upcoming Recurring Income (expected income in period)
    const upcomingIncomeInPeriod = upcomingIncome.filter(
      (i) => i.expectedDate <= periodEnd
    );
    const upcomingIncomeTotal = upcomingIncomeInPeriod.reduce((sum, i) => sum + i.amountCents, 0);

    // 4e. Get Pending Transactions (money in transit)
    const pendingEntries = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId).gte("date", args.periodStart).lte("date", periodEnd)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    let pendingExpensesCents = 0;
    let pendingIncomeCents = 0;
    for (const entry of pendingEntries) {
      if (entry.excludeFromTotals) continue;
      if (entry.type === "expense") {
        pendingExpensesCents += entry.amountCents;
      } else if (entry.type === "income") {
        pendingIncomeCents += entry.amountCents;
      }
    }

    // 4f. Budget-based calculation (existing)
    const totalBudgeted = budgetStatus.reduce((sum, b) => sum + b.budgetedCents, 0);
    const totalSpent = budgetStatus.reduce((sum, b) => sum + b.spentCents, 0);
    const budgetAvailable = totalBudgeted - totalSpent;

    // ============================================================
    // SAFE-TO-SPEND CALCULATION MODES
    // ============================================================

    // Mode 1: Budget-based (if budgets exist)
    // Available = Budget remaining - Upcoming bills - Goal commitments
    const budgetBasedSafeToSpend = Math.max(0, budgetAvailable - upcomingExpenseBillsTotal - totalGoalCommitmentCents);

    // Mode 2: Cash-based (based on actual account balances)
    // Available = Cash balance - Upcoming bills - Goal commitments - Pending expenses + Pending income
    const cashBasedSafeToSpend = Math.max(0, 
      totalCashBalance 
      - upcomingExpenseBillsTotal 
      - totalGoalCommitmentCents 
      - pendingExpensesCents
      + pendingIncomeCents
    );

    // Mode 3: Projected (includes expected income)
    // Available = Cash + Expected income - Upcoming bills - Goals - Pending
    const projectedSafeToSpend = Math.max(0,
      totalCashBalance
      + upcomingIncomeTotal
      - upcomingExpenseBillsTotal
      - totalGoalCommitmentCents
      - pendingExpensesCents
    );

    // Use the most appropriate mode:
    // - If budgets exist, use budget-based (more intentional)
    // - Otherwise, use cash-based (reality check)
    const hasBudgets = totalBudgeted > 0;
    const primarySafeToSpend = hasBudgets ? budgetBasedSafeToSpend : cashBasedSafeToSpend;
    const dailyAllowance = Math.round(primarySafeToSpend / daysRemaining);

    // 5. Get review count and details for inbox
    const reviewEntries = await ctx.db
      .query("entries")
      .withIndex("by_user_needsReview_date", (q) => q.eq("userId", userId).eq("needsReview", true))
      .collect();
    const reviewCount = reviewEntries.length;
    
    // Calculate review totals by type
    let reviewTotalCents = 0;
    for (const entry of reviewEntries) {
      if (!entry.excludeFromTotals) {
        reviewTotalCents += entry.amountCents;
      }
    }

    // 6. Period comparison - get previous period totals
    const periodLength = args.periodEnd - args.periodStart;
    const prevPeriodStart = args.periodStart - periodLength;
    const prevPeriodEnd = args.periodStart - 1;

    const prevPeriodEntries = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", prevPeriodStart).lte("date", prevPeriodEnd)
      )
      .collect();

    let prevIncomeCents = 0;
    let prevExpenseCents = 0;
    for (const entry of prevPeriodEntries) {
      if (entry.excludeFromTotals) continue;
      if (entry.type === "income") {
        prevIncomeCents += entry.amountCents;
      } else if (entry.type === "expense") {
        prevExpenseCents += entry.amountCents;
      }
    }

    // 7. Current period totals (for comparison)
    const currentPeriodEntries = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", args.periodStart).lte("date", args.periodEnd)
      )
      .collect();

    let currentIncomeCents = 0;
    let currentExpenseCents = 0;
    for (const entry of currentPeriodEntries) {
      if (entry.excludeFromTotals) continue;
      if (entry.type === "income") {
        currentIncomeCents += entry.amountCents;
      } else if (entry.type === "expense") {
        currentExpenseCents += entry.amountCents;
      }
    }

    return {
      upcomingBills,
      nextPayday,
      upcomingIncome,
      budgetStatus: budgetStatus.slice(0, 8), // Top 8 budgets
      
      // Enhanced Safe-to-Spend with full cross-entity synchronization
      safeToSpend: {
        // Primary calculation
        safeToSpendCents: primarySafeToSpend,
        dailyAllowanceCents: dailyAllowance,
        daysRemaining,
        
        // Calculation mode
        mode: hasBudgets ? "budget" as const : "cash" as const,
        
        // Budget data
        budgetTotalCents: totalBudgeted,
        budgetSpentCents: totalSpent,
        budgetAvailableCents: budgetAvailable,
        
        // Account balances
        cashBalanceCents: totalCashBalance,
        creditAvailableCents: totalCreditAvailable,
        debtBalanceCents: totalDebtBalance,
        
        // Upcoming recurring
        upcomingBillsCents: upcomingExpenseBillsTotal,
        upcomingBillsCount: upcomingBillsInPeriod.length,
        upcomingIncomeCents: upcomingIncomeTotal,
        upcomingIncomeCount: upcomingIncomeInPeriod.length,
        
        // Goal commitments
        goalCommitmentsCents: totalGoalCommitmentCents,
        activeGoalsCount: activeGoals.length,
        
        // Pending transactions
        pendingExpensesCents,
        pendingIncomeCents,
        
        // Alternative calculations for transparency
        budgetBasedCents: budgetBasedSafeToSpend,
        cashBasedCents: cashBasedSafeToSpend,
        projectedCents: projectedSafeToSpend,
        
        // Breakdown for UI display
        breakdown: {
          startingBasis: hasBudgets ? budgetAvailable : totalCashBalance,
          startingBasisLabel: hasBudgets ? "Budget Available" : "Cash Balance",
          deductions: [
            { label: "Upcoming Bills", amountCents: upcomingExpenseBillsTotal, count: upcomingBillsInPeriod.length },
            { label: "Goal Contributions", amountCents: totalGoalCommitmentCents, count: activeGoals.length },
            ...(pendingExpensesCents > 0 ? [{ label: "Pending Expenses", amountCents: pendingExpensesCents, count: pendingEntries.filter(e => e.type === "expense").length }] : []),
          ],
          additions: [
            ...(pendingIncomeCents > 0 ? [{ label: "Pending Income", amountCents: pendingIncomeCents, count: pendingEntries.filter(e => e.type === "income").length }] : []),
          ],
        },
      },
      
      // Detailed entity data for drill-down
      accounts: {
        balances: accountBalances,
        totalCashCents: totalCashBalance,
        totalCreditAvailableCents: totalCreditAvailable,
        totalDebtCents: totalDebtBalance,
      },
      
      goals: {
        active: activeGoals,
        totalCommitmentCents: totalGoalCommitmentCents,
      },
      
      // Review/inbox data
      reviewCount,
      reviewTotalCents,
      
      // Period comparison data for "vs last period" display
      periodComparison: {
        current: {
          incomeCents: currentIncomeCents,
          expenseCents: currentExpenseCents,
          netCents: currentIncomeCents - currentExpenseCents,
        },
        previous: {
          incomeCents: prevIncomeCents,
          expenseCents: prevExpenseCents,
          netCents: prevIncomeCents - prevExpenseCents,
        },
      },
      
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    };
  },
});
