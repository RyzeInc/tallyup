/**
 * TallyUp Constants - Single source of truth for tags, intents, and review rules
 */

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
  NEEDS_CATEGORY: "NEEDS_CATEGORY",
  NEEDS_CONTEXT: "NEEDS_CONTEXT",
  NEEDS_ACCOUNT: "NEEDS_ACCOUNT",
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
  "THIS_MONTH",
  "LAST_30",
  "CUSTOM",
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
export function getReviewReason(entry: {
  category?: string | null;
  contextTags?: string[] | null;
  intentTags?: string[] | null;
  amountCents: number;
  note?: string | null;
  methodOrAccount?: string | null;
}): ReviewReason | null {
  if (!entry.category || entry.category.trim() === "") {
    return REVIEW_REASONS.NEEDS_CATEGORY;
  }

  if (entry.amountCents >= HIGH_AMOUNT_THRESHOLD_CENTS) {
    if (!entry.contextTags || entry.contextTags.length === 0) {
      return REVIEW_REASONS.NEEDS_CONTEXT;
    }
  }

  if (!entry.methodOrAccount || entry.methodOrAccount.trim() === "") {
    return REVIEW_REASONS.NEEDS_ACCOUNT;
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
