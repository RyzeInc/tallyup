/**
 * Slot Ledger - Tracks question history to prevent circular questioning
 * 
 * This module provides deterministic control over which questions get asked,
 * preventing the "I already told you" problem by tracking:
 * - What slots have been asked about
 * - When they were asked
 * - Whether they've been answered
 * - Cooldown periods to prevent rapid re-asking
 */

import { z } from "zod";

// All trackable intake slots
export const INTAKE_SLOTS = [
  "monthly_income",
  "pay_cadence",
  "cash_balance",
  "savings_balance",
  "investment_balance",
  "debts",
  "fixed_bills",
  "variable_spend",
  "mortgage_payment",
  "mortgage_due_day",
  "goals",
  "risk_profile",
  "tax_profile",
  "emergency_fund_target",
] as const;

export type IntakeSlot = typeof INTAKE_SLOTS[number];

export const SlotStatusSchema = z.enum(["unknown", "asked", "answered", "confirmed", "blocked"]);
export type SlotStatus = z.infer<typeof SlotStatusSchema>;

export const SlotEntrySchema = z.object({
  status: SlotStatusSchema,
  lastAskedAt: z.number().optional(),
  lastAnsweredAt: z.number().optional(),
  askCount: z.number().default(0),
  source: z.enum(["user_chat", "app_data", "import", "inferred"]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});
export type SlotEntry = z.infer<typeof SlotEntrySchema>;

export const SlotLedgerSchema = z.record(z.string(), SlotEntrySchema);
export type SlotLedger = z.infer<typeof SlotLedgerSchema>;

// Slot priorities for question selection (higher = ask first)
export const SLOT_PRIORITIES: Record<IntakeSlot, number> = {
  monthly_income: 100,
  pay_cadence: 95,
  cash_balance: 90,
  fixed_bills: 85,
  mortgage_payment: 84,
  mortgage_due_day: 83,
  variable_spend: 80,
  debts: 75,
  savings_balance: 70,
  investment_balance: 65,
  goals: 60,
  emergency_fund_target: 55,
  risk_profile: 40,
  tax_profile: 30,
};

// Human-readable questions for each slot
export const SLOT_QUESTIONS: Record<IntakeSlot, { action: string; question: string }> = {
  monthly_income: {
    action: "Share your monthly take-home income.",
    question: "What's your monthly take-home income after taxes?",
  },
  pay_cadence: {
    action: "Confirm your pay cadence.",
    question: "How often do you get paid (weekly, biweekly, monthly)?",
  },
  cash_balance: {
    action: "Share your current cash balance.",
    question: "What's your current balance in checking accounts?",
  },
  savings_balance: {
    action: "Share your savings balance.",
    question: "How much do you have in savings accounts?",
  },
  investment_balance: {
    action: "Share your investment balances.",
    question: "What are your current investment account balances (retirement, brokerage)?",
  },
  debts: {
    action: "List your debts with balances and rates.",
    question: "What debts do you have? Include balances, interest rates, and minimum payments.",
  },
  fixed_bills: {
    action: "List your fixed monthly bills.",
    question: "What are your fixed monthly bills (rent/mortgage, utilities, insurance, subscriptions)?",
  },
  variable_spend: {
    action: "Estimate your variable monthly spending.",
    question: "Roughly how much do you spend on variable expenses (food, gas, entertainment)?",
  },
  mortgage_payment: {
    action: "Share your mortgage payment amount.",
    question: "What's your monthly mortgage payment?",
  },
  mortgage_due_day: {
    action: "Share your mortgage due date.",
    question: "What day of the month is your mortgage due?",
  },
  goals: {
    action: "Share your financial goals and timelines.",
    question: "What are your top financial goals and when do you want to achieve them?",
  },
  risk_profile: {
    action: "Share dependents and insurance status.",
    question: "Do you have dependents? Any insurance coverage gaps?",
  },
  tax_profile: {
    action: "Share your tax filing situation.",
    question: "What's your tax filing status and income mix (W-2 vs 1099)?",
  },
  emergency_fund_target: {
    action: "Set an emergency fund target.",
    question: "Do you have an emergency fund target in mind?",
  },
};

// Cooldown in milliseconds before asking the same slot again
const SLOT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const MAX_ASK_COUNT = 2; // Don't ask more than twice

/**
 * Initialize a fresh slot ledger with all slots unknown
 */
export function createEmptyLedger(): SlotLedger {
  const ledger: SlotLedger = {};
  for (const slot of INTAKE_SLOTS) {
    ledger[slot] = { status: "unknown", askCount: 0 };
  }
  return ledger;
}

/**
 * Check if a slot can be asked about right now
 */
export function canAskSlot(ledger: SlotLedger, slot: IntakeSlot, now: number): boolean {
  const entry = ledger[slot];
  if (!entry) return true;

  // Already answered or confirmed - don't ask
  if (entry.status === "answered" || entry.status === "confirmed") return false;
  
  // Blocked slots are off-limits
  if (entry.status === "blocked") return false;

  // Asked too many times
  if (entry.askCount >= MAX_ASK_COUNT) return false;

  // Recently asked - in cooldown
  if (entry.lastAskedAt && now - entry.lastAskedAt < SLOT_COOLDOWN_MS) return false;

  return true;
}

/**
 * Mark a slot as asked
 */
export function markSlotAsked(ledger: SlotLedger, slot: IntakeSlot, now: number): SlotLedger {
  const entry = ledger[slot] ?? { status: "unknown", askCount: 0 };
  return {
    ...ledger,
    [slot]: {
      ...entry,
      status: "asked",
      lastAskedAt: now,
      askCount: entry.askCount + 1,
    },
  };
}

/**
 * Mark a slot as answered
 */
export function markSlotAnswered(
  ledger: SlotLedger,
  slot: IntakeSlot,
  now: number,
  source: SlotEntry["source"] = "user_chat",
  confidence: SlotEntry["confidence"] = "high"
): SlotLedger {
  const entry = ledger[slot] ?? { status: "unknown", askCount: 0 };
  return {
    ...ledger,
    [slot]: {
      ...entry,
      status: "answered",
      lastAnsweredAt: now,
      source,
      confidence,
    },
  };
}

/**
 * Mark a slot as confirmed (user explicitly verified)
 */
export function markSlotConfirmed(ledger: SlotLedger, slot: IntakeSlot, now: number): SlotLedger {
  const entry = ledger[slot] ?? { status: "unknown", askCount: 0 };
  return {
    ...ledger,
    [slot]: {
      ...entry,
      status: "confirmed",
      lastAnsweredAt: now,
      source: "user_chat",
      confidence: "high",
    },
  };
}

/**
 * Block a slot from being asked (user declined to provide, or not applicable)
 */
export function blockSlot(ledger: SlotLedger, slot: IntakeSlot): SlotLedger {
  const entry = ledger[slot] ?? { status: "unknown", askCount: 0 };
  return {
    ...ledger,
    [slot]: {
      ...entry,
      status: "blocked",
    },
  };
}

/**
 * Pick the next best question to ask, respecting cooldowns and priorities
 */
export function pickNextQuestion(
  ledger: SlotLedger,
  now: number
): { slot: IntakeSlot; action: string; question: string } | null {
  const candidates: Array<{ slot: IntakeSlot; priority: number }> = [];

  for (const slot of INTAKE_SLOTS) {
    if (canAskSlot(ledger, slot, now)) {
      candidates.push({ slot, priority: SLOT_PRIORITIES[slot] });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority);
  const chosen = candidates[0];

  return {
    slot: chosen.slot,
    ...SLOT_QUESTIONS[chosen.slot],
  };
}

/**
 * Get a summary of what's known vs unknown
 */
export function getLedgerSummary(ledger: SlotLedger): {
  known: IntakeSlot[];
  unknown: IntakeSlot[];
  asked: IntakeSlot[];
  blocked: IntakeSlot[];
} {
  const known: IntakeSlot[] = [];
  const unknown: IntakeSlot[] = [];
  const asked: IntakeSlot[] = [];
  const blocked: IntakeSlot[] = [];

  for (const slot of INTAKE_SLOTS) {
    const entry = ledger[slot];
    if (!entry || entry.status === "unknown") {
      unknown.push(slot);
    } else if (entry.status === "answered" || entry.status === "confirmed") {
      known.push(slot);
    } else if (entry.status === "asked") {
      asked.push(slot);
    } else if (entry.status === "blocked") {
      blocked.push(slot);
    }
  }

  return { known, unknown, asked, blocked };
}

/**
 * Detect which slots should be marked as answered based on foundation data
 */
export function syncLedgerWithFoundation(
  ledger: SlotLedger,
  foundation: Record<string, unknown> | null | undefined,
  now: number
): SlotLedger {
  if (!foundation) return ledger;

  let updated = { ...ledger };

  // Check balance sheet
  const balanceSheet = foundation.balanceSheet as Record<string, unknown> | undefined;
  if (balanceSheet) {
    if (typeof balanceSheet.cashCents === "number") {
      updated = markSlotAnswered(updated, "cash_balance", now, "app_data");
    }
    if (typeof balanceSheet.savingsCents === "number") {
      updated = markSlotAnswered(updated, "savings_balance", now, "app_data");
    }
    if (typeof balanceSheet.investmentCents === "number" || typeof balanceSheet.retirementCents === "number") {
      updated = markSlotAnswered(updated, "investment_balance", now, "app_data");
    }
  }

  // Check debts
  const debts = foundation.debts as unknown[];
  if (Array.isArray(debts) && debts.length > 0) {
    updated = markSlotAnswered(updated, "debts", now, "app_data");
  }

  // Check income profile
  const incomeProfile = foundation.incomeProfile as Record<string, unknown> | undefined;
  if (incomeProfile) {
    if (incomeProfile.cadence) {
      updated = markSlotAnswered(updated, "pay_cadence", now, "app_data");
    }
    if (typeof incomeProfile.baselineMonthlyCents === "number" || typeof incomeProfile.typicalMonthCents === "number") {
      updated = markSlotAnswered(updated, "monthly_income", now, "app_data");
    }
  }

  // Check fixed obligations
  const fixedObligations = foundation.fixedObligations as unknown[];
  if (Array.isArray(fixedObligations) && fixedObligations.length > 0) {
    updated = markSlotAnswered(updated, "fixed_bills", now, "app_data");
    // Check if mortgage is in there
    const hasMortgage = fixedObligations.some((ob) => {
      const name = (ob as Record<string, unknown>)?.name;
      return typeof name === "string" && name.toLowerCase().includes("mortgage");
    });
    if (hasMortgage) {
      updated = markSlotAnswered(updated, "mortgage_payment", now, "app_data");
    }
  }

  // Check goals
  const goals = foundation.goals as unknown[];
  if (Array.isArray(goals) && goals.length > 0) {
    updated = markSlotAnswered(updated, "goals", now, "app_data");
  }

  // Check risk profile
  if (foundation.riskProfile) {
    updated = markSlotAnswered(updated, "risk_profile", now, "app_data");
  }

  // Check tax profile
  if (foundation.taxProfile) {
    updated = markSlotAnswered(updated, "tax_profile", now, "app_data");
  }

  return updated;
}

/**
 * Detect slots that were just answered in the latest message
 */
export function detectAnsweredSlots(
  message: string
): IntakeSlot[] {
  const lower = message.toLowerCase();
  const answered: IntakeSlot[] = [];

  // Income detection
  if (/\$?\d[\d,]*(?:\.\d+)?k?\s*(?:per|a|\/)\s*(?:month|mo)/i.test(message) ||
      /(?:income|take.?home|salary|make)\s*(?:is|:)?\s*\$?\d/i.test(message)) {
    answered.push("monthly_income");
  }

  // Pay cadence
  if (/(?:weekly|biweekly|bi-weekly|semi.?monthly|monthly|twice\s+a\s+month)/i.test(lower)) {
    answered.push("pay_cadence");
  }

  // Balances
  if (/(?:checking|cash)\s*(?:balance|account)?\s*(?:is|:)?\s*\$?\d/i.test(lower) ||
      /\$?\d[\d,]*(?:\.\d+)?k?\s*in\s*(?:my\s+)?(?:checking|cash)/i.test(lower)) {
    answered.push("cash_balance");
  }

  if (/(?:savings?)\s*(?:balance|account)?\s*(?:is|:)?\s*\$?\d/i.test(lower) ||
      /\$?\d[\d,]*(?:\.\d+)?k?\s*in\s*(?:my\s+)?savings/i.test(lower)) {
    answered.push("savings_balance");
  }

  if (/(?:roth|ira|401k|retirement|brokerage|robinhood|investment)/i.test(lower) &&
      /\$?\d[\d,]*(?:\.\d+)?k?/i.test(message)) {
    answered.push("investment_balance");
  }

  // Debts
  if (/(?:no\s+debt|debt.?free|don't have\s+(?:any\s+)?debt)/i.test(lower)) {
    answered.push("debts");
  }
  if (/(?:owe|debt|loan|credit\s*card)\s*(?:is|:)?\s*\$?\d/i.test(lower)) {
    answered.push("debts");
  }

  // Mortgage
  if (/mortgage\s*(?:is|payment|:)?\s*\$?\d/i.test(lower) ||
      /\$?\d[\d,]*(?:\.\d+)?k?\s*(?:for|on|toward)\s*(?:my\s+)?mortgage/i.test(lower)) {
    answered.push("mortgage_payment");
  }

  if (/(?:mortgage|due|payment)\s*(?:is\s+)?(?:on\s+)?(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?/i.test(lower)) {
    answered.push("mortgage_due_day");
  }

  // Goals
  if (/(?:goal|want\s+to|trying\s+to|plan\s+to|saving\s+for)/i.test(lower) &&
      /(?:retire|save|pay\s*off|emergency|house|vacation|\$?\d)/i.test(lower)) {
    answered.push("goals");
  }

  return [...new Set(answered)];
}

/**
 * Detect if user is frustrated about repetition
 */
export function detectRepetitionFrustration(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("i already told you") ||
    lower.includes("already said") ||
    lower.includes("already provided") ||
    lower.includes("already answered") ||
    lower.includes("i just said") ||
    lower.includes("just told you") ||
    lower.includes("you asked that") ||
    lower.includes("asked me that") ||
    lower.includes("same question") ||
    lower.includes("stop asking")
  );
}
