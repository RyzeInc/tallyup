/**
 * TallyUp Constants - Single source of truth for tags, intents, and review rules
 */

// ============================================
// ACCOUNT TYPES
// ============================================
export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "investment",
  "loan",
  "cash",
  "manual",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

// ============================================
// ACCOUNT STATUS
// ============================================
export const ACCOUNT_STATUSES = ["active", "hidden", "closed"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

// ============================================
// OWNERSHIP TYPES
// ============================================
export const OWNERSHIP_TYPES = ["personal", "shared", "business"] as const;

export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

// ============================================
// TRANSACTION DIRECTION / TYPE
// ============================================
export const TRANSACTION_TYPES = ["expense", "income", "transfer"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// ============================================
// CLEARED STATES
// ============================================
export const CLEARED_STATES = ["pending", "cleared", "reconciled"] as const;

export type ClearedState = (typeof CLEARED_STATES)[number];

// ============================================
// TRANSFER TYPES
// ============================================
export const TRANSFER_TYPES = [
  "internal",   // Between own accounts
  "external",   // To/from external party
  "payment",    // Credit card / loan payment
  "investment", // To/from investment account
] as const;

export type TransferType = (typeof TRANSFER_TYPES)[number];

// ============================================
// ASSET TYPES (Investments)
// ============================================
export const ASSET_TYPES = [
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "crypto",
  "cash",
  "real_estate",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

// ============================================
// GOAL TYPES
// ============================================
export const GOAL_TYPES = ["savings", "paydown", "sinkingFund"] as const;

export type GoalType = (typeof GOAL_TYPES)[number];

// ============================================
// GOAL STATUSES
// ============================================
export const GOAL_STATUSES = ["active", "paused", "completed", "abandoned"] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

// ============================================
// BUDGET PERIOD TYPES
// ============================================
export const BUDGET_PERIOD_TYPES = [
  "monthly",
  "weekly",
  "biweekly",
  "quarterly",
  "yearly",
  "custom",
] as const;

export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];

// ============================================
// BUDGET HEALTH STATUSES
// ============================================
export const BUDGET_HEALTH_STATUSES = [
  "on_track",
  "warning",
  "overspent",
  "under_budget",
] as const;

export type BudgetHealthStatus = (typeof BUDGET_HEALTH_STATUSES)[number];

// ============================================
// RECURRING RULE SOURCES
// ============================================
export const RECURRING_SOURCES = [
  "auto_detected",
  "user_defined",
  "imported",
] as const;

export type RecurringSource = (typeof RECURRING_SOURCES)[number];

// ============================================
// CADENCE TYPES
// ============================================
export const CADENCE_TYPES = [
  "weekly",
  "biweekly",
  "semiMonthly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;

export type CadenceType = (typeof CADENCE_TYPES)[number];

// ============================================
// CONTEXT TAGS (composable, multi-select)
// ============================================
export const CONTEXT_TAGS = [
  "Personal",
  "Shared",
  "Household",
  "Partner",
  "Dependent",
  "Business",
  "Client",
  "Reimbursable",
  "Tax-Deductible",
] as const;

export type ContextTag = (typeof CONTEXT_TAGS)[number];

// ============================================
// INTENT TAGS (typically single-select)
// ============================================
export const INTENT_TAGS = [
  "Essential",      // Needs: rent, utilities, groceries
  "Discretionary",  // Wants: entertainment, dining out
  "Planned",        // Budgeted for, expected
  "Unexpected",     // Surprise expense
  "One-time",       // Non-recurring
  "Recurring",      // Part of a pattern
  "Unknown",        // Not yet classified
] as const;

export type IntentTag = (typeof INTENT_TAGS)[number];

// ============================================
// REVIEW REASONS
// ============================================
export const REVIEW_REASONS = {
  MISSING_CATEGORY: "missing_category",
  MISSING_CONTEXT: "missing_context",
  UNKNOWN_MERCHANT: "unknown_merchant",
  MIXED_CONTEXT: "mixed_context", // Has both Business and Personal without split
  HIGH_AMOUNT_NO_NOTE: "high_amount_no_note",
  MISSING_INTENT: "missing_intent",
} as const;

export type ReviewReason = (typeof REVIEW_REASONS)[keyof typeof REVIEW_REASONS];

// Amount threshold for requiring context (in cents)
export const HIGH_AMOUNT_THRESHOLD_CENTS = 5000; // $50

// ============================================
// CHIP STATES (Tri-state filtering)
// ============================================
export type TriState = "neutral" | "include" | "exclude";

// ============================================
// DRILLDOWN TYPES
// ============================================
export const DRILLDOWN_TYPES = [
  "net_spend",
  "income",
  "expense",
  "category",
  "tag",
  "context",
  "intent",
  "needs_review",
  "recurring",
  "goal",
  "budget",
] as const;

export type DrilldownType = (typeof DRILLDOWN_TYPES)[number];

// ============================================
// TIME RANGE PRESETS
// ============================================
export const TIME_RANGE_PRESETS = [
  "today",
  "yesterday",
  "week",
  "last-week",
  "month",
  "last-month",
  "year",
  "last-year",
  "custom",
] as const;

export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];

// ============================================
// DESIGN TOKENS - Chip Colors
// ============================================
export const CHIP_TOKENS = {
  neutral: {
    bg: "var(--surface-2)",
    border: "var(--border)",
    text: "var(--text)",
  },
  include: {
    bg: "var(--success-subtle)",
    border: "var(--success)",
    text: "var(--success)",
  },
  exclude: {
    bg: "var(--danger-subtle)",
    border: "var(--danger)",
    text: "var(--danger)",
  },
} as const;

// ============================================
// HELPER: Compute review reason for an entry
// ============================================
export function computeReviewReason(entry: {
  category?: string | null;
  contextTags?: string[] | null;
  intentTag?: string | null;
  merchantRaw?: string | null;
  merchantNormalized?: string | null;
  amountCents: number;
  note?: string | null;
}): ReviewReason | null {
  // Rule 1: Missing category
  if (!entry.category || entry.category.trim() === "") {
    return REVIEW_REASONS.MISSING_CATEGORY;
  }

  // Rule 2: High amount without context tags
  if (entry.amountCents >= HIGH_AMOUNT_THRESHOLD_CENTS) {
    if (!entry.contextTags || entry.contextTags.length === 0) {
      return REVIEW_REASONS.MISSING_CONTEXT;
    }
  }

  // Rule 3: Unknown merchant (has raw but no normalized)
  if (entry.merchantRaw && !entry.merchantNormalized) {
    return REVIEW_REASONS.UNKNOWN_MERCHANT;
  }

  // Rule 4: Mixed context (both Business and Personal without explicit handling)
  if (entry.contextTags) {
    const hasBusiness = entry.contextTags.includes("Business");
    const hasPersonal = entry.contextTags.includes("Personal");
    if (hasBusiness && hasPersonal) {
      return REVIEW_REASONS.MIXED_CONTEXT;
    }
  }

  return null;
}

// ============================================
// HELPER: Format drilldown for URL
// ============================================
export function formatDrilldown(
  type: DrilldownType,
  value?: string
): string {
  if (value) {
    return `${type}_${encodeURIComponent(value)}`;
  }
  return type;
}

// ============================================
// HELPER: Parse drilldown from URL
// ============================================
export function parseDrilldown(
  drilldownParam: string
): { type: DrilldownType; value?: string } | null {
  for (const t of DRILLDOWN_TYPES) {
    if (drilldownParam === t) {
      return { type: t };
    }
    if (drilldownParam.startsWith(`${t}_`)) {
      const value = decodeURIComponent(drilldownParam.slice(t.length + 1));
      return { type: t, value };
    }
  }
  return null;
}
