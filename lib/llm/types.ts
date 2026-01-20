import type { CoachOutput } from "./schema";
import type { CoachFoundation } from "../coach/foundation";
import type { SlotLedger } from "../coach/slotLedger";

// ============================================
// EXTENDED FINANCIAL SNAPSHOTS
// ============================================

export type BalanceSheetSnapshot = {
  asOf: number;
  netWorthCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  checking: Array<{ name: string; balanceCents: number }>;
  savings: Array<{ name: string; balanceCents: number }>;
  investments: Array<{ name: string; balanceCents: number }>;
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
    type: string;
  }>;
};

export type IncomeProfile = {
  cadence: string | null;
  last90dTotalCents: number;
  last90dAvgMonthlyCents: number;
  last90dStdDevCents: number;
  minMonthCents: number;
  maxMonthCents: number;
  volatilityScore: "low" | "medium" | "high";
  incomeSourceCount: number;
  primarySourcePct: number;
};

export type BaselineObligations = {
  totalMonthlyCents: number;
  housing: number;
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
    monthlyNeeded?: number;
  }>;
};

export type RiskProfile = {
  dependents: number;
  housingType: string | null;
  employmentType: string | null;
  hasHealthInsurance: boolean | null;
  hasDisabilityInsurance: boolean | null;
  hasLifeInsurance: boolean | null;
  hasRentersHomeInsurance: boolean | null;
  emergencyFundMonths: number | null;
  liquidAssetsCents: number;
};

export type TaxProfile = {
  filingStatus: string | null;
  incomeTypes: string[];
  usuallyOwes: boolean | null;
  estimatedBracket: string | null;
  hasRetirementAccounts: boolean;
};

export type TransactionDiagnostics = {
  cashWithdrawals90dCents: number;
  refunds90dCents: number;
  internalTransfers90dCents: number;
  suspectedDuplicates: Array<{ date: number; amountCents: number; merchant: string }>;
  subscriptions: Array<{ name: string; monthlyCents: number; lastCharge: number }>;
};

export type FinancialHealthSummary = {
  overallScore: "healthy" | "caution" | "critical";
  topConcern: string | null;
  topOpportunity: string | null;
  flags: string[];
  debtToIncomeRatio: number | null;
  savingsRate: number | null;
  highestUtilization: { name: string; pct: number } | null;
};

/** Context depth for adaptive inclusion */
export type ContextDepth = "minimal" | "standard" | "full";

// ============================================
// COACH CONTEXT PACKET
// ============================================

export type CoachContextPacket = {
  generatedAt: number;
  month: {
    year: number;
    month: number;
    label: string;
    startDate: number;
    endDate: number;
  };
  cashflow: {
    incomeCents: number;
    expenseCents: number;
    netCents: number;
  };
  spendByCategory: Array<{ category: string; amountCents: number }>;
  upcomingBills: Array<{ name: string; expectedDate: number; expectedAmountCents?: number }>;
  anomalies: Array<{
    category: string;
    recentAverageCents: number;
    baselineAverageCents: number;
    deltaCents: number;
    reason: string;
  }>;
  coachState: { preferences?: unknown; currentFocus?: string | null } | null;
  recentSummaries: string[];
  recentActions: string[];
  recentOpenQuestions: string[];
  recentConversation: Array<{
    role: "user" | "assistant";
    content: string;
    createdAt: number;
  }>;
  sessionSummary?: string | null;
  openLoops?: string[] | null;
  // Slot ledger for anti-loop tracking
  slotLedger?: SlotLedger | null;
  // Established facts this session (for incremental recaps)
  establishedFacts?: string[] | null;
  // Whether user recently expressed frustration about repetition
  frustrationDetectedAt?: number | null;
  intent?: {
    domain?: string | null;
    task?: string | null;
  } | null;
  knowledgeSnippets?: Array<{
    docId: string;
    chunkIndex: number;
    content: string;
    score: number;
  }>;
  memorySnippets?: Array<{
    type: string;
    content: string;
    confidence?: string;
    tags?: string[];
    score: number;
  }>;
  foundationSnapshot: CoachFoundation | null;
  draftProfile?: Record<string, unknown> | null;
  draftFoundation?: Record<string, unknown> | null;
  transactionDrilldownOptIn?: { enabled: boolean; windowDays: number; expiresAt: number } | null;
  transactionDrilldown?: {
    windowDays: number;
    items: Array<{
      date: number;
      amountCents: number;
      type: "expense" | "income" | "transfer";
      category?: string;
      merchant?: string;
      entryType?: string;
    }>;
  } | null;
  
  // ============================================
  // EXTENDED FINANCIAL CONTEXT (A-G)
  // ============================================
  
  /** A) Balance sheet - net worth, assets, liabilities with details */
  balanceSheet?: BalanceSheetSnapshot | null;
  
  /** B) Income structure - cadence, volatility, concentration */
  incomeProfile?: IncomeProfile | null;
  
  /** B cont.) Baseline obligations - fixed monthly costs */
  baselineObligations?: BaselineObligations | null;
  
  /** C) Debt structure - rates, minimums, terms */
  debtSnapshot?: DebtSnapshot | null;
  
  /** D) Goals with time horizons */
  goalSnapshot?: GoalSnapshot | null;
  
  /** E) Risk profile - dependents, insurance, emergency capacity */
  riskProfile?: RiskProfile | null;
  
  /** F) Tax profile - filing status, income types */
  taxProfile?: TaxProfile | null;
  
  /** G) Transaction diagnostics - suspicious patterns (only when troubleshooting) */
  transactionDiagnostics?: TransactionDiagnostics | null;
  
  /** H) Pre-computed health summary - signals so LLM doesn't have to do math */
  healthSummary?: FinancialHealthSummary | null;
  
  /** Context depth hint for adaptive inclusion */
  contextDepth?: ContextDepth;
};

export type CoachProviderInput = {
  message: string;
  contextPacket: CoachContextPacket;
  systemPrompt: string;
};

export type CoachProvider = {
  id: "mock" | "groq" | "cloudflare" | "openai";
  generate: (input: CoachProviderInput) => Promise<CoachOutput>;
};
