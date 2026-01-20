/**
 * Coach-specific financial aggregates
 * 
 * These functions compute structured snapshots for the coach context:
 * A) Balance sheet (net worth, assets, liabilities)
 * B) Income profile (cadence, volatility, baseline obligations)
 * C) Debt structure (rates, minimums, terms)
 * D) Goals with priorities
 * E) Risk profile (dependents, insurance flags, emergency capacity)
 * F) Tax profile (filing status, income types)
 * G) Transaction diagnostics (suspicious patterns)
 */

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

// ============================================
// TYPE DEFINITIONS
// ============================================

export type BalanceSheetSnapshot = {
  asOf: number;
  netWorthCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  // Top accounts by type
  checking: Array<{ name: string; balanceCents: number }>;
  savings: Array<{ name: string; balanceCents: number }>;
  investments: Array<{ name: string; balanceCents: number }>;
  // Liabilities with details
  creditCards: Array<{
    name: string;
    balanceCents: number;
    limitCents?: number;
    apr?: number;
    minPaymentCents?: number;
    utilizationPct?: number;
  }>;
  loans: Array<{
    name: string;
    balanceCents: number;
    apr?: number;
    minPaymentCents?: number;
    type: string; // mortgage, auto, student, personal
  }>;
};

export type IncomeProfile = {
  cadence: string | null; // weekly, biweekly, monthly, irregular
  last90dTotalCents: number;
  last90dAvgMonthlyCents: number;
  last90dStdDevCents: number;
  minMonthCents: number;
  maxMonthCents: number;
  volatilityScore: "low" | "medium" | "high"; // stdev/avg ratio
  incomeSourceCount: number;
  primarySourcePct: number; // concentration risk
};

export type BaselineObligations = {
  totalMonthlyCents: number;
  housing: number; // rent or mortgage
  debtMinimums: number;
  insurance: number;
  utilities: number;
  subscriptions: number;
};

export type DebtSnapshot = {
  totalDebtCents: number;
  totalMinPaymentsCents: number;
  weightedAvgApr: number;
  highestAprDebt: { name: string; apr: number; balanceCents: number } | null;
  debts: Array<{
    name: string;
    type: string;
    balanceCents: number;
    apr: number;
    minPaymentCents: number;
    isOverdue?: boolean;
    promoExpiresAt?: number;
  }>;
};

export type GoalSnapshot = {
  goals: Array<{
    id: string;
    name: string;
    type: string;
    targetCents: number;
    currentCents: number;
    targetDate?: number;
    priority: number;
    progressPct: number;
    monthlyNeeded?: number; // to hit target by date
  }>;
};

export type RiskProfile = {
  dependents: number;
  housingType: string | null; // rent, own, other
  employmentType: string | null; // W2, 1099, mixed
  hasHealthInsurance: boolean | null;
  hasDisabilityInsurance: boolean | null;
  hasLifeInsurance: boolean | null;
  hasRentersHomeInsurance: boolean | null;
  emergencyFundMonths: number | null; // liquid assets / baseline obligations
  liquidAssetsCents: number;
};

export type TaxProfile = {
  filingStatus: string | null; // single, married_joint, married_separate, head_of_household
  incomeTypes: string[]; // W2, 1099, investment, rental
  usuallyOwes: boolean | null; // true = owes, false = refund, null = unknown
  estimatedBracket: string | null; // "10%", "22%", etc.
  hasRetirementAccounts: boolean;
};

export type TransactionDiagnostics = {
  cashWithdrawals90dCents: number;
  refunds90dCents: number;
  internalTransfers90dCents: number;
  suspectedDuplicates: Array<{ date: number; amountCents: number; merchant: string }>;
  subscriptions: Array<{ name: string; monthlyCents: number; lastCharge: number }>;
};

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * A) Compute balance sheet snapshot
 */
export async function computeBalanceSheet(
  ctx: Ctx,
  userId: string
): Promise<BalanceSheetSnapshot> {
  const now = Date.now();
  
  // Get all non-archived accounts
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  
  // Get latest balance for each account
  const accountsWithBalances = await Promise.all(
    activeAccounts.map(async (account) => {
      const snapshots = await ctx.db
        .query("accountSnapshots")
        .withIndex("by_account_asOf", (q) => 
          q.eq("accountId", account._id).lt("asOf", now + 1)
        )
        .order("desc")
        .take(1);
      
      const balance = snapshots[0]?.balance ?? 0;
      return { ...account, balanceCents: balance };
    })
  );
  
  // Categorize accounts
  const checking: BalanceSheetSnapshot["checking"] = [];
  const savings: BalanceSheetSnapshot["savings"] = [];
  const investments: BalanceSheetSnapshot["investments"] = [];
  const creditCards: BalanceSheetSnapshot["creditCards"] = [];
  const loans: BalanceSheetSnapshot["loans"] = [];
  
  let totalAssets = 0;
  let totalLiabilities = 0;
  
  for (const account of accountsWithBalances) {
    const balance = account.balanceCents;
    
    switch (account.type) {
      case "checking":
        checking.push({ name: account.name, balanceCents: balance });
        totalAssets += Math.max(0, balance);
        break;
      case "savings":
        savings.push({ name: account.name, balanceCents: balance });
        totalAssets += Math.max(0, balance);
        break;
      case "investment":
        investments.push({ name: account.name, balanceCents: balance });
        totalAssets += Math.max(0, balance);
        break;
      case "credit":
        // Credit card balance is typically negative (debt) or zero
        const ccBalance = Math.abs(balance);
        const limit = account.creditLimit ?? 0;
        creditCards.push({
          name: account.name,
          balanceCents: ccBalance,
          limitCents: limit > 0 ? limit : undefined,
          apr: account.apr ?? undefined,
          minPaymentCents: account.minPayment ?? account.minimumPaymentCents ?? undefined,
          utilizationPct: limit > 0 ? Math.round((ccBalance / limit) * 100) : undefined,
        });
        totalLiabilities += ccBalance;
        break;
      case "loan":
        const loanBalance = Math.abs(balance);
        const subtype = account.subtype || "personal";
        loans.push({
          name: account.name,
          balanceCents: loanBalance,
          apr: account.apr ?? account.interestRate ?? undefined,
          minPaymentCents: account.minPayment ?? account.minimumPaymentCents ?? undefined,
          type: subtype,
        });
        totalLiabilities += loanBalance;
        break;
      default:
        // business, other - treat as asset if positive
        if (balance > 0) {
          totalAssets += balance;
        } else {
          totalLiabilities += Math.abs(balance);
        }
    }
  }
  
  return {
    asOf: now,
    netWorthCents: totalAssets - totalLiabilities,
    totalAssetsCents: totalAssets,
    totalLiabilitiesCents: totalLiabilities,
    checking: checking.slice(0, 3),
    savings: savings.slice(0, 3),
    investments: investments.slice(0, 3),
    creditCards: creditCards.slice(0, 5),
    loans: loans.slice(0, 5),
  };
}

/**
 * B) Compute income profile (volatility, cadence, concentration)
 */
export async function computeIncomeProfile(
  ctx: Ctx,
  userId: string
): Promise<IncomeProfile> {
  const now = Date.now();
  const days90 = 90 * 24 * 60 * 60 * 1000;
  const start90 = now - days90;
  
  // Get income entries from last 90 days
  const incomeEntries = await ctx.db
    .query("entries")
    .withIndex("by_user_type_date", (q) =>
      q.eq("userId", userId).eq("type", "income").gte("date", start90)
    )
    .collect();
  
  if (incomeEntries.length === 0) {
    return {
      cadence: null,
      last90dTotalCents: 0,
      last90dAvgMonthlyCents: 0,
      last90dStdDevCents: 0,
      minMonthCents: 0,
      maxMonthCents: 0,
      volatilityScore: "low",
      incomeSourceCount: 0,
      primarySourcePct: 0,
    };
  }
  
  // Group by month
  const monthlyTotals = new Map<string, number>();
  const sourceAmounts = new Map<string, number>();
  
  for (const entry of incomeEntries) {
    const date = new Date(entry.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + entry.amountCents);
    
    const source = entry.category || "Other";
    sourceAmounts.set(source, (sourceAmounts.get(source) ?? 0) + entry.amountCents);
  }
  
  const totals = Array.from(monthlyTotals.values());
  const total90d = totals.reduce((a, b) => a + b, 0);
  const avgMonthly = total90d / 3; // 90 days ≈ 3 months
  
  // Compute standard deviation
  const variance = totals.reduce((sum, val) => sum + Math.pow(val - avgMonthly, 2), 0) / totals.length;
  const stdDev = Math.sqrt(variance);
  
  // Volatility score based on coefficient of variation
  const cv = avgMonthly > 0 ? stdDev / avgMonthly : 0;
  let volatilityScore: "low" | "medium" | "high" = "low";
  if (cv > 0.3) volatilityScore = "high";
  else if (cv > 0.15) volatilityScore = "medium";
  
  // Find primary source concentration
  const sortedSources = Array.from(sourceAmounts.entries()).sort((a, b) => b[1] - a[1]);
  const primarySourcePct = total90d > 0 && sortedSources.length > 0
    ? Math.round((sortedSources[0][1] / total90d) * 100)
    : 0;
  
  // Detect cadence from intervals between income events
  let cadence: string | null = null;
  if (incomeEntries.length >= 2) {
    const sorted = [...incomeEntries].sort((a, b) => a.date - b.date);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].date - sorted[i - 1].date);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const avgDays = avgInterval / (24 * 60 * 60 * 1000);
    
    if (avgDays <= 8) cadence = "weekly";
    else if (avgDays <= 17) cadence = "biweekly";
    else if (avgDays <= 35) cadence = "monthly";
    else cadence = "irregular";
  }
  
  return {
    cadence,
    last90dTotalCents: total90d,
    last90dAvgMonthlyCents: Math.round(avgMonthly),
    last90dStdDevCents: Math.round(stdDev),
    minMonthCents: Math.min(...totals, 0),
    maxMonthCents: Math.max(...totals, 0),
    volatilityScore,
    incomeSourceCount: sourceAmounts.size,
    primarySourcePct,
  };
}

/**
 * Compute baseline monthly obligations (fixed costs that must be covered)
 */
export async function computeBaselineObligations(
  ctx: Ctx,
  userId: string
): Promise<BaselineObligations> {
  const now = Date.now();
  const days90 = 90 * 24 * 60 * 60 * 1000;
  const start90 = now - days90;
  
  // Get recurring rules for fixed expenses
  const recurringRules = await ctx.db
    .query("recurringRules")
    .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("active", true))
    .collect();
  
  // Also look at expense entries to detect recurring patterns
  // (Reserved for future pattern detection from transaction history)
  const _expenses = await ctx.db
    .query("entries")
    .withIndex("by_user_type_date", (q) =>
      q.eq("userId", userId).eq("type", "expense").gte("date", start90)
    )
    .collect();
  
  // Categorize fixed expenses
  let housing = 0;
  let debtMinimums = 0;
  let insurance = 0;
  let utilities = 0;
  let subscriptions = 0;
  
  // Housing categories
  const housingCats = ["rent", "mortgage", "housing"];
  // Insurance categories
  const insuranceCats = ["insurance", "health insurance", "auto insurance", "life insurance"];
  // Utility categories
  const utilityCats = ["utilities", "electric", "gas", "water", "internet", "phone"];
  // Subscription patterns
  const subscriptionCats = ["subscriptions", "streaming", "software"];
  
  const categoryLower = (cat: string | undefined) => (cat || "").toLowerCase();
  
  // Estimate monthly amounts from recurring rules
  for (const rule of recurringRules) {
    const cat = categoryLower(rule.category);
    const monthly = estimateMonthlyAmount(rule);
    
    if (housingCats.some(h => cat.includes(h))) {
      housing += monthly;
    } else if (insuranceCats.some(i => cat.includes(i))) {
      insurance += monthly;
    } else if (utilityCats.some(u => cat.includes(u))) {
      utilities += monthly;
    } else if (subscriptionCats.some(s => cat.includes(s))) {
      subscriptions += monthly;
    }
  }
  
  // Get debt minimum payments from accounts
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  
  for (const account of accounts) {
    if (account.isArchived) continue;
    const minPay = account.minPayment ?? account.minimumPaymentCents ?? 0;
    if (minPay > 0 && (account.type === "credit" || account.type === "loan")) {
      debtMinimums += minPay;
    }
  }
  
  return {
    totalMonthlyCents: housing + debtMinimums + insurance + utilities + subscriptions,
    housing,
    debtMinimums,
    insurance,
    utilities,
    subscriptions,
  };
}

function estimateMonthlyAmount(rule: Doc<"recurringRules">): number {
  const amount = rule.amountCents ?? 0;
  const cadence = rule.cadenceType ?? rule.intervalType;
  
  switch (cadence) {
    case "weekly": return amount * 4.33;
    case "biweekly": return amount * 2.17;
    case "monthly": return amount;
    case "quarterly": return amount / 3;
    case "yearly": return amount / 12;
    default: return amount; // assume monthly
  }
}

/**
 * C) Compute debt structure
 */
export async function computeDebtSnapshot(
  ctx: Ctx,
  userId: string
): Promise<DebtSnapshot> {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  
  const debtAccounts = accounts.filter(
    (a) => !a.isArchived && (a.type === "credit" || a.type === "loan")
  );
  
  // Get balances
  const debtsWithBalances = await Promise.all(
    debtAccounts.map(async (account) => {
      const snapshots = await ctx.db
        .query("accountSnapshots")
        .withIndex("by_account_asOf", (q) =>
          q.eq("accountId", account._id)
        )
        .order("desc")
        .take(1);
      
      const balance = Math.abs(snapshots[0]?.balance ?? 0);
      const apr = account.apr ?? account.interestRate ?? 0;
      const minPay = account.minPayment ?? account.minimumPaymentCents ?? 0;
      
      return {
        name: account.name,
        type: account.subtype || account.type,
        balanceCents: balance,
        apr,
        minPaymentCents: minPay,
        isOverdue: account.isOverdue,
      };
    })
  );
  
  // Filter out zero balance debts
  const activeDebts = debtsWithBalances.filter((d) => d.balanceCents > 0);
  
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.balanceCents, 0);
  const totalMinPayments = activeDebts.reduce((sum, d) => sum + d.minPaymentCents, 0);
  
  // Weighted average APR
  const weightedApr = totalDebt > 0
    ? activeDebts.reduce((sum, d) => sum + d.apr * d.balanceCents, 0) / totalDebt
    : 0;
  
  // Find highest APR debt
  const sorted = [...activeDebts].sort((a, b) => b.apr - a.apr);
  const highestApr = sorted.length > 0 && sorted[0].apr > 0
    ? { name: sorted[0].name, apr: sorted[0].apr, balanceCents: sorted[0].balanceCents }
    : null;
  
  return {
    totalDebtCents: totalDebt,
    totalMinPaymentsCents: totalMinPayments,
    weightedAvgApr: Math.round(weightedApr * 100) / 100,
    highestAprDebt: highestApr,
    debts: activeDebts.slice(0, 10), // Cap at 10 debts
  };
}

/**
 * D) Compute goals snapshot with progress and monthly needed
 */
export async function computeGoalSnapshot(
  ctx: Ctx,
  userId: string
): Promise<GoalSnapshot> {
  const goals = await ctx.db
    .query("goals")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .collect();
  
  const now = Date.now();
  
  const goalSnapshots = goals.map((goal) => {
    const progressPct = goal.targetAmountCents > 0
      ? Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100)
      : 0;
    
    // Calculate monthly needed to hit target by date
    let monthlyNeeded: number | undefined;
    if (goal.targetDate && goal.targetDate > now) {
      const monthsRemaining = (goal.targetDate - now) / (30 * 24 * 60 * 60 * 1000);
      const remaining = goal.targetAmountCents - goal.currentAmountCents;
      if (monthsRemaining > 0 && remaining > 0) {
        monthlyNeeded = Math.ceil(remaining / monthsRemaining);
      }
    }
    
    return {
      id: goal._id,
      name: goal.name,
      type: goal.goalType,
      targetCents: goal.targetAmountCents,
      currentCents: goal.currentAmountCents,
      targetDate: goal.targetDate,
      priority: goal.priority ?? 99,
      progressPct,
      monthlyNeeded,
    };
  });
  
  // Sort by priority then progress
  goalSnapshots.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.progressPct - a.progressPct;
  });
  
  return { goals: goalSnapshots.slice(0, 10) };
}

/**
 * E) Compute risk profile
 */
export async function computeRiskProfile(
  ctx: Ctx,
  userId: string,
  foundation: Record<string, unknown> | null,
  balanceSheet: BalanceSheetSnapshot,
  baseline: BaselineObligations
): Promise<RiskProfile> {
  // Extract from foundation if available
  const dependents = typeof foundation?.dependents === "number" ? foundation.dependents : 0;
  const housingType = typeof foundation?.housingType === "string" ? foundation.housingType : null;
  const employmentType = typeof foundation?.employmentType === "string" ? foundation.employmentType : null;
  
  // Insurance flags (from foundation if stored)
  const insurance = foundation?.insurance as Record<string, boolean> | undefined;
  
  // Liquid assets = checking + savings
  const liquidAssets = 
    balanceSheet.checking.reduce((sum, a) => sum + a.balanceCents, 0) +
    balanceSheet.savings.reduce((sum, a) => sum + a.balanceCents, 0);
  
  // Emergency fund months
  const emergencyFundMonths = baseline.totalMonthlyCents > 0
    ? Math.round((liquidAssets / baseline.totalMonthlyCents) * 10) / 10
    : null;
  
  return {
    dependents,
    housingType,
    employmentType,
    hasHealthInsurance: insurance?.health ?? null,
    hasDisabilityInsurance: insurance?.disability ?? null,
    hasLifeInsurance: insurance?.life ?? null,
    hasRentersHomeInsurance: insurance?.home ?? null,
    emergencyFundMonths,
    liquidAssetsCents: liquidAssets,
  };
}

/**
 * F) Compute tax profile
 */
export async function computeTaxProfile(
  ctx: Ctx,
  userId: string,
  foundation: Record<string, unknown> | null,
  incomeProfile: IncomeProfile
): Promise<TaxProfile> {
  // Extract from foundation
  const filingStatus = typeof foundation?.filingStatus === "string" ? foundation.filingStatus : null;
  const usuallyOwes = typeof foundation?.usuallyOwesTaxes === "boolean" ? foundation.usuallyOwesTaxes : null;
  
  // Detect income types from categories
  const incomeTypes: string[] = [];
  if (foundation?.hasW2Income) incomeTypes.push("W2");
  if (foundation?.has1099Income || incomeProfile.volatilityScore === "high") incomeTypes.push("1099");
  if (foundation?.hasInvestmentIncome) incomeTypes.push("investment");
  if (foundation?.hasRentalIncome) incomeTypes.push("rental");
  
  // Estimate bracket from annual income (very rough)
  let estimatedBracket: string | null = null;
  const annualIncome = incomeProfile.last90dAvgMonthlyCents * 12;
  if (annualIncome > 0) {
    if (annualIncome < 1100000) estimatedBracket = "10%";
    else if (annualIncome < 4475000) estimatedBracket = "12%";
    else if (annualIncome < 9550000) estimatedBracket = "22%";
    else if (annualIncome < 17190000) estimatedBracket = "24%";
    else if (annualIncome < 21570000) estimatedBracket = "32%";
    else if (annualIncome < 53950000) estimatedBracket = "35%";
    else estimatedBracket = "37%";
  }
  
  // Check for retirement accounts
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  
  const hasRetirement = accounts.some((a) => {
    const sub = (a.subtype || "").toLowerCase();
    return sub.includes("401") || sub.includes("ira") || sub.includes("retirement");
  });
  
  return {
    filingStatus,
    incomeTypes,
    usuallyOwes,
    estimatedBracket,
    hasRetirementAccounts: hasRetirement,
  };
}

/**
 * G) Compute transaction diagnostics (suspicious patterns)
 */
export async function computeTransactionDiagnostics(
  ctx: Ctx,
  userId: string
): Promise<TransactionDiagnostics> {
  const now = Date.now();
  const days90 = 90 * 24 * 60 * 60 * 1000;
  const start90 = now - days90;
  
  const entries = await ctx.db
    .query("entries")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", start90))
    .collect();
  
  let cashWithdrawals = 0;
  let refunds = 0;
  let transfers = 0;
  const suspectedDupes: TransactionDiagnostics["suspectedDuplicates"] = [];
  const subMap = new Map<string, { total: number; count: number; lastCharge: number }>();
  
  // Track potential duplicates (same amount + merchant within 3 days)
  const recentTxns = new Map<string, { date: number; merchant: string; amountCents: number }[]>();
  
  for (const entry of entries) {
    const cat = (entry.category || "").toLowerCase();
    const merchant = entry.merchant || entry.merchantNormalized || "";
    
    // Cash withdrawals
    if (cat.includes("cash") || cat.includes("atm") || cat.includes("withdrawal")) {
      cashWithdrawals += Math.abs(entry.amountCents);
    }
    
    // Refunds
    if (entry.entryType === "refund" || cat.includes("refund")) {
      refunds += Math.abs(entry.amountCents);
    }
    
    // Internal transfers
    if (entry.type === "transfer" || entry.transferId) {
      transfers += Math.abs(entry.amountCents);
    }
    
    // Track subscriptions (recurring small charges)
    if (entry.recurringRuleId || cat.includes("subscription") || cat.includes("streaming")) {
      const key = merchant.toLowerCase().substring(0, 20);
      const existing = subMap.get(key) || { total: 0, count: 0, lastCharge: 0 };
      existing.total += Math.abs(entry.amountCents);
      existing.count += 1;
      existing.lastCharge = Math.max(existing.lastCharge, entry.date);
      subMap.set(key, existing);
    }
    
    // Check for duplicates
    if (entry.type === "expense" && merchant) {
      const key = `${Math.abs(entry.amountCents)}-${merchant.toLowerCase().substring(0, 15)}`;
      const existing = recentTxns.get(key) || [];
      
      // Check if there's a transaction within 3 days
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      const maybeDupe = existing.find((e) => Math.abs(e.date - entry.date) < threeDays && e.date !== entry.date);
      
      if (maybeDupe && suspectedDupes.length < 5) {
        suspectedDupes.push({
          date: entry.date,
          amountCents: entry.amountCents,
          merchant,
        });
      }
      
      existing.push({ date: entry.date, merchant, amountCents: entry.amountCents });
      recentTxns.set(key, existing);
    }
  }
  
  // Convert subscriptions to list
  const subscriptions: TransactionDiagnostics["subscriptions"] = [];
  for (const [name, data] of subMap.entries()) {
    if (data.count >= 2) {
      subscriptions.push({
        name,
        monthlyCents: Math.round(data.total / 3), // 90 days ≈ 3 months
        lastCharge: data.lastCharge,
      });
    }
  }
  
  subscriptions.sort((a, b) => b.monthlyCents - a.monthlyCents);
  
  return {
    cashWithdrawals90dCents: cashWithdrawals,
    refunds90dCents: refunds,
    internalTransfers90dCents: transfers,
    suspectedDuplicates: suspectedDupes.slice(0, 5),
    subscriptions: subscriptions.slice(0, 10),
  };
}

// ============================================
// FINANCIAL HEALTH SUMMARY (Pre-computed signals)
// ============================================

export type FinancialHealthSummary = {
  overallScore: "healthy" | "caution" | "critical";
  topConcern: string | null;
  topOpportunity: string | null;
  flags: string[];
  // Pre-computed metrics for quick reference
  debtToIncomeRatio: number | null;
  savingsRate: number | null; // percentage of income saved
  highestUtilization: { name: string; pct: number } | null;
};

/**
 * Compute a pre-interpreted health summary so the LLM doesn't have to do math
 */
export function computeHealthSummary(
  balanceSheet: BalanceSheetSnapshot,
  incomeProfile: IncomeProfile,
  debtSnapshot: DebtSnapshot,
  riskProfile: RiskProfile,
  cashflow: { incomeCents: number; expenseCents: number; netCents: number }
): FinancialHealthSummary {
  const flags: string[] = [];
  
  // Check emergency fund (critical if < 1 month, caution if < 3)
  if (riskProfile.emergencyFundMonths !== null) {
    if (riskProfile.emergencyFundMonths < 1) {
      flags.push("no_emergency_fund");
    } else if (riskProfile.emergencyFundMonths < 3) {
      flags.push("low_emergency_fund");
    }
  }
  
  // Check high utilization (any card > 30% is notable, > 70% is critical)
  let highestUtilization: { name: string; pct: number } | null = null;
  for (const cc of balanceSheet.creditCards) {
    const util = cc.utilizationPct ?? 0;
    if (!highestUtilization || util > highestUtilization.pct) {
      highestUtilization = { name: cc.name, pct: util };
    }
    if (util > 70) {
      flags.push("critical_utilization");
    } else if (util > 30) {
      flags.push("high_utilization");
    }
  }
  
  // Check debt-to-income ratio
  const monthlyDebt = debtSnapshot.totalMinPaymentsCents;
  const monthlyIncome = incomeProfile.last90dAvgMonthlyCents;
  let debtToIncomeRatio: number | null = null;
  if (monthlyIncome > 0) {
    debtToIncomeRatio = Math.round((monthlyDebt / monthlyIncome) * 100);
    if (debtToIncomeRatio > 50) {
      flags.push("critical_debt_to_income");
    } else if (debtToIncomeRatio > 36) {
      flags.push("high_debt_to_income");
    }
  }
  
  // Check savings rate
  let savingsRate: number | null = null;
  if (cashflow.incomeCents > 0) {
    savingsRate = Math.round((cashflow.netCents / cashflow.incomeCents) * 100);
    if (savingsRate < 0) {
      flags.push("negative_cashflow");
    } else if (savingsRate < 10) {
      flags.push("low_savings_rate");
    }
  }
  
  // Check for overdue debts
  const overdueCount = debtSnapshot.debts.filter(d => d.isOverdue).length;
  if (overdueCount > 0) {
    flags.push("overdue_payments");
  }
  
  // Check income volatility for gig/freelance workers
  if (incomeProfile.volatilityScore === "high") {
    flags.push("volatile_income");
  }
  
  // Compute overall score
  const criticalFlags = ["no_emergency_fund", "critical_utilization", "critical_debt_to_income", "negative_cashflow", "overdue_payments"];
  const hasCritical = flags.some(f => criticalFlags.includes(f));
  const cautionFlags = ["low_emergency_fund", "high_utilization", "high_debt_to_income", "low_savings_rate", "volatile_income"];
  const hasCaution = flags.some(f => cautionFlags.includes(f));
  
  let overallScore: "healthy" | "caution" | "critical" = "healthy";
  if (hasCritical) overallScore = "critical";
  else if (hasCaution) overallScore = "caution";
  
  // Determine top concern (priority order)
  let topConcern: string | null = null;
  if (flags.includes("overdue_payments")) {
    topConcern = `${overdueCount} overdue payment${overdueCount > 1 ? "s" : ""}`;
  } else if (flags.includes("negative_cashflow")) {
    topConcern = `Spending exceeds income by $${Math.abs(Math.round(cashflow.netCents / 100))}/mo`;
  } else if (flags.includes("no_emergency_fund")) {
    topConcern = "No emergency fund buffer";
  } else if (flags.includes("critical_utilization") && highestUtilization) {
    topConcern = `${highestUtilization.name} at ${highestUtilization.pct}% utilization`;
  } else if (flags.includes("critical_debt_to_income")) {
    topConcern = `Debt payments are ${debtToIncomeRatio}% of income`;
  } else if (flags.includes("high_utilization") && highestUtilization) {
    topConcern = `${highestUtilization.name} at ${highestUtilization.pct}% utilization`;
  }
  
  // Determine top opportunity
  let topOpportunity: string | null = null;
  if (cashflow.netCents > 10000) { // > $100/mo surplus
    topOpportunity = `$${Math.round(cashflow.netCents / 100)}/mo available to allocate`;
  } else if (debtSnapshot.highestAprDebt && debtSnapshot.highestAprDebt.apr > 15) {
    topOpportunity = `Paying down ${debtSnapshot.highestAprDebt.name} (${debtSnapshot.highestAprDebt.apr}% APR) saves the most`;
  } else if (riskProfile.emergencyFundMonths !== null && riskProfile.emergencyFundMonths < 3) {
    topOpportunity = "Building 3-month emergency fund is priority";
  }
  
  return {
    overallScore,
    topConcern,
    topOpportunity,
    flags,
    debtToIncomeRatio,
    savingsRate,
    highestUtilization,
  };
}
