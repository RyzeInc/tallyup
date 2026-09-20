import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { cashflowTotals } from "../lib/finance/semantics";

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

// Alert severity levels
type AlertSeverity = "critical" | "warning" | "info";

// Alert types for categorization
type AlertType = 
  | "budget_exceeds_income"      // Total budgeted > projected income
  | "budget_exceeds_balance"     // Total budgeted > available cash
  | "income_gap"                 // Expected recurring income not received
  | "commitment_overload"        // Goals + bills + budgets > income
  | "missing_income_tracking"    // No recurring income set up
  | "cash_runway_short"          // Not enough cash for upcoming bills
  | "goal_unrealistic"           // Goal contributions > available after bills
  | "spending_exceeds_plan";     // Actual spending pace > budgeted pace

interface AccountabilityAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  
  // Financial context
  expectedCents?: number;
  actualCents?: number;
  gapCents?: number;
  
  // Actionable suggestions
  suggestions: Array<{
    action: string;
    actionType: "add_transaction" | "adjust_budget" | "add_income" | "link_account" | "review_goal" | "dismiss";
    label: string;
  }>;
  
  // Related entities for drill-down
  relatedEntities?: Array<{
    type: "budget" | "goal" | "account" | "recurring" | "transaction";
    id: string;
    name: string;
  }>;
}

interface AccountabilityCheckResult {
  // Overall financial health score (0-100)
  healthScore: number;
  
  // Summary stats
  summary: {
    // Income reality
    projectedMonthlyIncomeCents: number;
    actualMonthlyIncomeCents: number;
    incomeGapCents: number;
    
    // Budget reality
    totalBudgetedCents: number;
    budgetCoveragePercent: number; // % of income covered by budgets
    
    // Cash reality
    totalCashBalanceCents: number;
    cashRunwayDays: number;
    
    // Commitment load
    totalCommitmentsCents: number; // bills + goals + budgets
    commitmentToIncomeRatio: number;
  };
  
  // Active alerts sorted by severity
  alerts: AccountabilityAlert[];
  
  // Quick stats for the UI
  alertCounts: {
    critical: number;
    warning: number;
    info: number;
  };
  
  // Last check timestamp
  checkedAt: number;
}

/**
 * Comprehensive accountability check that cross-references:
 * - Transaction entries (actual income/expenses)
 * - Budget categories and periods
 * - Recurring income/expense rules
 * - Savings goals
 * - Account balances (net worth)
 */
export const getAccountabilityCheck = query({
  args: {
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args): Promise<AccountabilityCheckResult> => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const periodDays = Math.ceil((args.periodEnd - args.periodStart) / msPerDay);
    
    const alerts: AccountabilityAlert[] = [];
    
    // ============================================================
    // 1. GATHER ALL FINANCIAL DATA
    // ============================================================
    
    // 1a. Get actual transactions in period
    const periodEntries = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", args.periodStart).lte("date", args.periodEnd)
      )
      .collect();
    
    const actuals = cashflowTotals(periodEntries);
    const actualIncomeCents = actuals.incomeCents;
    const actualExpenseCents = actuals.expenseCents;
    
    // 1b. Get recurring income rules and calculate projected income
    const incomeRules = await ctx.db
      .query("recurringRules")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("active", true))
      .filter((q) => q.eq(q.field("type"), "income"))
      .collect();
    
    let projectedIncomeCents = 0;
    const incomeRuleDetails: Array<{ id: string; name: string; amountCents: number; occurrencesInPeriod: number }> = [];
    
    for (const rule of incomeRules) {
      const amount = rule.amountCents ?? rule.amountPolicy?.amountCents ?? 0;
      
      // Estimate occurrences based on cadence
      let occurrences = 1;
      const cadenceKind = rule.cadence?.kind ?? rule.cadenceType ?? "monthly";
      
      if (cadenceKind === "weekly") {
        occurrences = Math.ceil(periodDays / 7);
      } else if (cadenceKind === "biweekly") {
        occurrences = Math.ceil(periodDays / 14);
      } else if (cadenceKind === "monthly") {
        occurrences = Math.ceil(periodDays / 30);
      } else if (cadenceKind === "quarterly") {
        occurrences = periodDays >= 90 ? 1 : 0;
      } else if (cadenceKind === "yearly") {
        occurrences = periodDays >= 365 ? 1 : 0;
      }
      
      const ruleTotal = amount * occurrences;
      projectedIncomeCents += ruleTotal;
      
      if (amount > 0) {
        incomeRuleDetails.push({
          id: rule._id,
          name: rule.displayName ?? rule.name ?? rule.category ?? "Income",
          amountCents: amount,
          occurrencesInPeriod: occurrences,
        });
      }
    }
    
    // 1c. Get recurring expense rules
    const expenseRules = await ctx.db
      .query("recurringRules")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("active", true))
      .filter((q) => q.eq(q.field("type"), "expense"))
      .collect();
    
    let projectedRecurringExpensesCents = 0;
    for (const rule of expenseRules) {
      const amount = rule.amountCents ?? rule.amountPolicy?.amountCents ?? 0;
      const cadenceKind = rule.cadence?.kind ?? rule.cadenceType ?? "monthly";
      
      let occurrences = 1;
      if (cadenceKind === "weekly") {
        occurrences = Math.ceil(periodDays / 7);
      } else if (cadenceKind === "biweekly") {
        occurrences = Math.ceil(periodDays / 14);
      } else if (cadenceKind === "monthly") {
        occurrences = Math.ceil(periodDays / 30);
      }
      
      projectedRecurringExpensesCents += amount * occurrences;
    }
    
    // 1d. Get budget categories and their totals
    const budgetCategories = await ctx.db
      .query("budgetCategories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    
    let totalBudgetedCents = 0;
    const budgetDetails: Array<{ id: string; name: string; budgetedCents: number; spentCents: number }> = [];
    
    // Get budget periods for current range
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
    
    const periodsByCategory = new Map<string, typeof budgetPeriods[0]>();
    for (const period of budgetPeriods) {
      if (period.budgetCategoryId) {
        const existing = periodsByCategory.get(period.budgetCategoryId);
        if (!existing || period.periodStart > existing.periodStart) {
          periodsByCategory.set(period.budgetCategoryId, period);
        }
      }
    }
    
    for (const cat of budgetCategories) {
      const period = periodsByCategory.get(cat._id);
      const budgeted = period?.budgetedCents ?? cat.budgetAmountCents;
      const spent = period?.spentCents ?? 0;
      
      totalBudgetedCents += budgeted;
      budgetDetails.push({
        id: cat._id,
        name: cat.name,
        budgetedCents: budgeted,
        spentCents: spent,
      });
    }
    
    // 1e. Get active goals
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    
    let totalGoalCommitmentsCents = 0;
    const goalDetails: Array<{ id: string; name: string; monthlyContribution: number }> = [];
    
    for (const goal of goals) {
      const remaining = Math.max(0, goal.targetAmountCents - goal.currentAmountCents);
      let monthlyContribution = goal.suggestedMonthlyCents ?? 0;
      
      if (!monthlyContribution && goal.targetDate) {
        const monthsRemaining = Math.max(1, Math.ceil((goal.targetDate - now) / (30 * msPerDay)));
        monthlyContribution = Math.round(remaining / monthsRemaining);
      }
      
      const periodContribution = Math.round((monthlyContribution * periodDays) / 30);
      totalGoalCommitmentsCents += periodContribution;
      
      if (monthlyContribution > 0) {
        goalDetails.push({
          id: goal._id,
          name: goal.name,
          monthlyContribution,
        });
      }
    }
    
    // 1f. Get account balances
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
    
    let totalCashBalanceCents = 0;
    let totalDebtCents = 0;
    const accountDetails: Array<{ id: string; name: string; balanceCents: number; type: string }> = [];
    
    for (const account of accounts) {
      const snapshot = await getLatestAccountSnapshot(ctx, account._id, now + 1);
      const balance = snapshot?.balance ?? 0;
      
      if (account.type === "checking" || account.type === "savings") {
        totalCashBalanceCents += balance;
      } else if (account.type === "credit" || account.type === "loan") {
        totalDebtCents += Math.abs(balance);
      }
      
      accountDetails.push({
        id: account._id,
        name: account.name,
        balanceCents: balance,
        type: account.type,
      });
    }
    
    // ============================================================
    // 2. CALCULATE ACCOUNTABILITY METRICS
    // ============================================================
    
    const incomeGapCents = projectedIncomeCents - actualIncomeCents;
    const totalCommitmentsCents = totalBudgetedCents + totalGoalCommitmentsCents + projectedRecurringExpensesCents;
    const commitmentToIncomeRatio = projectedIncomeCents > 0 
      ? totalCommitmentsCents / projectedIncomeCents 
      : totalCommitmentsCents > 0 ? Infinity : 0;
    
    // Budget coverage: what % of projected income is budgeted
    const budgetCoveragePercent = projectedIncomeCents > 0
      ? Math.round((totalBudgetedCents / projectedIncomeCents) * 100)
      : 0;
    
    // Cash runway: how many days of average daily expenses can be covered
    const avgDailyExpenses = actualExpenseCents / Math.max(1, periodDays);
    const cashRunwayDays = avgDailyExpenses > 0
      ? Math.floor(totalCashBalanceCents / avgDailyExpenses)
      : totalCashBalanceCents > 0 ? 365 : 0; // Cap at 1 year if no expenses
    
    // ============================================================
    // 3. GENERATE ACCOUNTABILITY ALERTS
    // ============================================================
    
    // Alert 1: No income tracking set up
    if (incomeRules.length === 0 && actualIncomeCents === 0) {
      alerts.push({
        id: "missing_income_tracking",
        type: "missing_income_tracking",
        severity: "warning",
        title: "No income sources tracked",
        description: "Set up your recurring income to enable accurate budget planning and safe-to-spend calculations.",
        suggestions: [
          { action: "add_income", actionType: "add_income", label: "Add income source" },
          { action: "add_transaction", actionType: "add_transaction", label: "Log income transaction" },
        ],
      });
    }
    
    // Alert 2: Income gap - expected income not received
    if (projectedIncomeCents > 0 && incomeGapCents > projectedIncomeCents * 0.2) {
      // More than 20% of expected income is missing
      const missingPercent = Math.round((incomeGapCents / projectedIncomeCents) * 100);
      
      alerts.push({
        id: "income_gap",
        type: "income_gap",
        severity: incomeGapCents > projectedIncomeCents * 0.5 ? "critical" : "warning",
        title: `${missingPercent}% of expected income not received`,
        description: `You expected $${(projectedIncomeCents / 100).toFixed(0)} but only received $${(actualIncomeCents / 100).toFixed(0)} this period. This affects your safe-to-spend calculations.`,
        expectedCents: projectedIncomeCents,
        actualCents: actualIncomeCents,
        gapCents: incomeGapCents,
        suggestions: [
          { action: "add_transaction", actionType: "add_transaction", label: "Log missing income" },
          { action: "adjust_budget", actionType: "adjust_budget", label: "Adjust income expectations" },
        ],
        relatedEntities: incomeRuleDetails.map(r => ({
          type: "recurring" as const,
          id: r.id,
          name: r.name,
        })),
      });
    }
    
    // Alert 3: Budget exceeds projected income
    if (projectedIncomeCents > 0 && totalBudgetedCents > projectedIncomeCents) {
      const overBudgetCents = totalBudgetedCents - projectedIncomeCents;
      const overBudgetPercent = Math.round((overBudgetCents / projectedIncomeCents) * 100);
      
      alerts.push({
        id: "budget_exceeds_income",
        type: "budget_exceeds_income",
        severity: overBudgetPercent > 20 ? "critical" : "warning",
        title: `Budgets exceed income by ${overBudgetPercent}%`,
        description: `Your total budgeted spending ($${(totalBudgetedCents / 100).toFixed(0)}) exceeds your projected income ($${(projectedIncomeCents / 100).toFixed(0)}) by $${(overBudgetCents / 100).toFixed(0)}.`,
        expectedCents: projectedIncomeCents,
        actualCents: totalBudgetedCents,
        gapCents: overBudgetCents,
        suggestions: [
          { action: "adjust_budget", actionType: "adjust_budget", label: "Reduce budgets" },
          { action: "add_income", actionType: "add_income", label: "Add income source" },
        ],
        relatedEntities: budgetDetails
          .filter(b => b.budgetedCents > 0)
          .sort((a, b) => b.budgetedCents - a.budgetedCents)
          .slice(0, 3)
          .map(b => ({
            type: "budget" as const,
            id: b.id,
            name: b.name,
          })),
      });
    }
    
    // Alert 4: Budget exceeds available cash
    if (totalBudgetedCents > totalCashBalanceCents && totalCashBalanceCents > 0) {
      const shortfallCents = totalBudgetedCents - totalCashBalanceCents;
      
      alerts.push({
        id: "budget_exceeds_balance",
        type: "budget_exceeds_balance",
        severity: shortfallCents > totalCashBalanceCents * 0.5 ? "critical" : "warning",
        title: "Budgets exceed available cash",
        description: `Your budgeted spending ($${(totalBudgetedCents / 100).toFixed(0)}) exceeds your available cash ($${(totalCashBalanceCents / 100).toFixed(0)}). You may need to rely on credit or reduce spending.`,
        expectedCents: totalCashBalanceCents,
        actualCents: totalBudgetedCents,
        gapCents: shortfallCents,
        suggestions: [
          { action: "adjust_budget", actionType: "adjust_budget", label: "Reduce budgets" },
          { action: "link_account", actionType: "link_account", label: "Link missing accounts" },
        ],
        relatedEntities: accountDetails
          .filter(a => a.type === "checking" || a.type === "savings")
          .map(a => ({
            type: "account" as const,
            id: a.id,
            name: a.name,
          })),
      });
    }
    
    // Alert 5: Commitment overload (bills + goals + budgets > income)
    if (projectedIncomeCents > 0 && commitmentToIncomeRatio > 1.1) {
      const overloadPercent = Math.round((commitmentToIncomeRatio - 1) * 100);
      
      alerts.push({
        id: "commitment_overload",
        type: "commitment_overload",
        severity: commitmentToIncomeRatio > 1.3 ? "critical" : "warning",
        title: `Commitments exceed income by ${overloadPercent}%`,
        description: `Your total commitments (budgets + goals + bills = $${(totalCommitmentsCents / 100).toFixed(0)}) exceed your income ($${(projectedIncomeCents / 100).toFixed(0)}). Consider prioritizing.`,
        expectedCents: projectedIncomeCents,
        actualCents: totalCommitmentsCents,
        gapCents: totalCommitmentsCents - projectedIncomeCents,
        suggestions: [
          { action: "review_goal", actionType: "review_goal", label: "Review goals" },
          { action: "adjust_budget", actionType: "adjust_budget", label: "Adjust budgets" },
        ],
        relatedEntities: [
          ...goalDetails.slice(0, 2).map(g => ({
            type: "goal" as const,
            id: g.id,
            name: g.name,
          })),
          ...budgetDetails.slice(0, 2).map(b => ({
            type: "budget" as const,
            id: b.id,
            name: b.name,
          })),
        ],
      });
    }
    
    // Alert 6: Cash runway is short (less than 30 days)
    if (cashRunwayDays < 30 && cashRunwayDays >= 0 && avgDailyExpenses > 0) {
      alerts.push({
        id: "cash_runway_short",
        type: "cash_runway_short",
        severity: cashRunwayDays < 14 ? "critical" : "warning",
        title: `Only ${cashRunwayDays} days of cash runway`,
        description: `At your current spending rate ($${(avgDailyExpenses / 100).toFixed(0)}/day), your cash will last about ${cashRunwayDays} days. Consider reducing spending or adding funds.`,
        expectedCents: 30 * avgDailyExpenses,
        actualCents: totalCashBalanceCents,
        gapCents: (30 * avgDailyExpenses) - totalCashBalanceCents,
        suggestions: [
          { action: "link_account", actionType: "link_account", label: "Link missing accounts" },
          { action: "adjust_budget", actionType: "adjust_budget", label: "Reduce spending" },
        ],
      });
    }
    
    // Alert 7: Goal contributions unrealistic
    if (projectedIncomeCents > 0 && totalGoalCommitmentsCents > 0) {
      const afterBillsIncome = projectedIncomeCents - projectedRecurringExpensesCents;
      if (totalGoalCommitmentsCents > afterBillsIncome * 0.5) {
        alerts.push({
          id: "goal_unrealistic",
          type: "goal_unrealistic",
          severity: "warning",
          title: "Goal contributions may be unrealistic",
          description: `Your goal contributions ($${(totalGoalCommitmentsCents / 100).toFixed(0)}/period) are more than 50% of your income after bills. This leaves little for other expenses.`,
          expectedCents: afterBillsIncome * 0.3, // Suggest 30% max
          actualCents: totalGoalCommitmentsCents,
          gapCents: totalGoalCommitmentsCents - (afterBillsIncome * 0.3),
          suggestions: [
            { action: "review_goal", actionType: "review_goal", label: "Extend goal timelines" },
            { action: "add_income", actionType: "add_income", label: "Find additional income" },
          ],
          relatedEntities: goalDetails.map(g => ({
            type: "goal" as const,
            id: g.id,
            name: g.name,
          })),
        });
      }
    }
    
    // Alert 8: Spending exceeds plan pace
    const expectedSpentByNow = totalBudgetedCents * ((now - args.periodStart) / (args.periodEnd - args.periodStart));
    if (actualExpenseCents > expectedSpentByNow * 1.2 && actualExpenseCents > 10000) {
      const overspendPercent = Math.round(((actualExpenseCents / expectedSpentByNow) - 1) * 100);
      
      alerts.push({
        id: "spending_exceeds_plan",
        type: "spending_exceeds_plan",
        severity: overspendPercent > 30 ? "warning" : "info",
        title: `Spending ${overspendPercent}% ahead of plan`,
        description: `You've spent $${(actualExpenseCents / 100).toFixed(0)} but should have spent about $${(expectedSpentByNow / 100).toFixed(0)} by now based on your budgets.`,
        expectedCents: expectedSpentByNow,
        actualCents: actualExpenseCents,
        gapCents: actualExpenseCents - expectedSpentByNow,
        suggestions: [
          { action: "adjust_budget", actionType: "adjust_budget", label: "Review spending" },
        ],
      });
    }
    
    // ============================================================
    // 4. CALCULATE HEALTH SCORE
    // ============================================================
    
    let healthScore = 100;
    
    // Deduct for alerts
    for (const alert of alerts) {
      if (alert.severity === "critical") {
        healthScore -= 25;
      } else if (alert.severity === "warning") {
        healthScore -= 10;
      } else {
        healthScore -= 3;
      }
    }
    
    // Bonus for good practices
    if (incomeRules.length > 0) healthScore += 5; // Has income tracking
    if (budgetCategories.length >= 3) healthScore += 5; // Has budgets
    if (goals.length > 0) healthScore += 5; // Has goals
    if (accounts.length > 0) healthScore += 5; // Has accounts linked
    
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    // Sort alerts by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    return {
      healthScore,
      summary: {
        projectedMonthlyIncomeCents: projectedIncomeCents,
        actualMonthlyIncomeCents: actualIncomeCents,
        incomeGapCents,
        totalBudgetedCents,
        budgetCoveragePercent,
        totalCashBalanceCents,
        cashRunwayDays,
        totalCommitmentsCents,
        commitmentToIncomeRatio,
      },
      alerts,
      alertCounts: {
        critical: alerts.filter(a => a.severity === "critical").length,
        warning: alerts.filter(a => a.severity === "warning").length,
        info: alerts.filter(a => a.severity === "info").length,
      },
      checkedAt: now,
    };
  },
});
