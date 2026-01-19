/**
 * Smart Mock Provider
 * 
 * A mock LLM provider that demonstrates intelligent coaching behavior:
 * - Extracts facts from user messages
 * - Provides delta-based insights
 * - Never asks the same question twice
 * - Always provides value before asking
 */

import type { CoachProvider, CoachProviderInput } from "../types";
import { CoachOutputSchema, type CoachOutput } from "../schema";
import type { CoachFoundationUpdate } from "../../coach/foundation";

// ============================================================================
// Utilities
// ============================================================================

function formatCents(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function parseMoneyToken(token: string): number | null {
  let cleaned = token.toLowerCase().replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  let multiplier = 1;
  if (cleaned.endsWith("k")) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  }
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * multiplier);
}

// ============================================================================
// Fact Extraction
// ============================================================================

type ExtractedFacts = {
  monthlyIncomeCents?: number;
  payCadence?: "weekly" | "biweekly" | "semimonthly" | "monthly" | "irregular";
  mortgagePaymentCents?: number;
  mortgageDueDay?: number;
  rothIraCents?: number;
  brokerageCents?: number;
  savingsCents?: number;
  cashCents?: number;
  hasNoDebt?: boolean;
  goals?: string[];
};

function extractFacts(messages: string[]): ExtractedFacts {
  const facts: ExtractedFacts = {};
  const combined = messages.join(" ");
  const lower = combined.toLowerCase();

  // Income detection
  const incomeMatch = combined.match(
    /(?:income|take.?home|make|earn|salary)[^$]*?\$?([\d,]+(?:\.\d+)?)\s*(?:k)?/i
  );
  if (incomeMatch) {
    let amount = parseMoneyToken(incomeMatch[1]);
    if (amount !== null) {
      if (incomeMatch[0].toLowerCase().includes("k")) amount *= 1000;
      facts.monthlyIncomeCents = amount * 100;
    }
  }

  // Pay cadence
  if (/biweekly|bi-weekly/i.test(lower)) facts.payCadence = "biweekly";
  else if (/semi.?monthly|twice\s+a\s+month/i.test(lower)) facts.payCadence = "semimonthly";
  else if (/weekly/i.test(lower) && !/biweekly/i.test(lower)) facts.payCadence = "weekly";
  else if (/monthly/i.test(lower) && !/semi|twice/i.test(lower)) facts.payCadence = "monthly";
  else if (/irregular|varies|variable/i.test(lower)) facts.payCadence = "irregular";

  // Mortgage
  const mortgageMatch = combined.match(
    /mortgage[^$]*?\$?([\d,]+(?:\.\d+)?)\s*(?:k)?/i
  );
  if (mortgageMatch) {
    const amount = parseMoneyToken(mortgageMatch[1]);
    if (amount !== null) {
      facts.mortgagePaymentCents = amount * 100;
    }
  }

  // Mortgage due day
  const dueDayMatch = combined.match(
    /(?:mortgage|due|payment)[^0-9]*?(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/i
  );
  if (dueDayMatch && lower.includes("mortgage")) {
    const day = parseInt(dueDayMatch[1], 10);
    if (day >= 1 && day <= 31) facts.mortgageDueDay = day;
  }

  // Investment accounts
  const rothMatch = combined.match(
    /(\$?[\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:in\s+)?(?:my\s+)?(?:roth|ira)/i
  );
  if (rothMatch) {
    let amount = parseMoneyToken(rothMatch[1]);
    if (amount !== null) {
      if (rothMatch[0].toLowerCase().includes("k")) amount *= 1000;
      facts.rothIraCents = amount * 100;
    }
  }

  const brokerageMatch = combined.match(
    /(\$?[\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:in\s+)?(?:my\s+)?(?:robinhood|brokerage|investment|taxable)/i
  );
  if (brokerageMatch) {
    let amount = parseMoneyToken(brokerageMatch[1]);
    if (amount !== null) {
      if (brokerageMatch[0].toLowerCase().includes("k")) amount *= 1000;
      facts.brokerageCents = amount * 100;
    }
  }

  // Savings
  const savingsMatch = combined.match(
    /(\$?[\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:in\s+)?(?:my\s+)?savings/i
  );
  if (savingsMatch) {
    let amount = parseMoneyToken(savingsMatch[1]);
    if (amount !== null) {
      if (savingsMatch[0].toLowerCase().includes("k")) amount *= 1000;
      facts.savingsCents = amount * 100;
    }
  }

  // Cash/checking
  const cashMatch = combined.match(
    /(\$?[\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:in\s+)?(?:my\s+)?(?:checking|cash)/i
  );
  if (cashMatch) {
    let amount = parseMoneyToken(cashMatch[1]);
    if (amount !== null) {
      if (cashMatch[0].toLowerCase().includes("k")) amount *= 1000;
      facts.cashCents = amount * 100;
    }
  }

  // No debt
  if (
    /no\s+debt|debt.?free|don't have\s+(?:any\s+)?debt/i.test(lower)
  ) {
    facts.hasNoDebt = true;
  }

  // Goals
  if (/millionaire|\$?1\s*m(?:illion)?/i.test(lower)) {
    facts.goals = facts.goals ?? [];
    facts.goals.push("Build to $1M net worth");
  }
  if (/retire|retirement/i.test(lower)) {
    facts.goals = facts.goals ?? [];
    facts.goals.push("Retirement planning");
  }
  if (/emergency\s*fund/i.test(lower)) {
    facts.goals = facts.goals ?? [];
    facts.goals.push("Build emergency fund");
  }

  return facts;
}

// ============================================================================
// Response Generation
// ============================================================================

function buildMockResponse(input: CoachProviderInput): Partial<CoachOutput> {
  const { contextPacket } = input;
  const message = input.message.trim();
  const lower = message.toLowerCase();
  
  // Gather all user messages from recent conversation
  const recentUserMessages = contextPacket.recentConversation
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content);
  
  // Extract facts from conversation history + current message
  const facts = extractFacts([...recentUserMessages, message]);
  
  // Check what we already know
  const established = contextPacket.establishedFacts ?? [];

  // =========================================================================
  // PRIORITY 1: Detect conversational intent before data extraction
  // =========================================================================

  // Simple greeting - match the user's energy, don't dump data
  if (/^(hi|hey|hello|howdy|sup|what'?s up|yo)[\s!?.]*$/i.test(lower)) {
    return {
      assistantMessage:
        "Hey! 👋 I'm your financial coach. I can help you understand where your money's going, " +
        "plan around upcoming bills, or just answer questions about your finances. What's on your mind?",
      summaryBullets: ["Greeted user warmly"],
      actions: [],
      openQuestions: [],
      metricsUsed: [],
    };
  }

  // User is frustrated or ignored - they said hello and we didn't respond appropriately
  if (/i said (hi|hello|hey)/i.test(lower) || /did you (hear|read|understand)/i.test(lower)) {
    return {
      assistantMessage:
        "You're right, I should have just said hi back! 😅 Sorry about that. " +
        "What can I help you with today?",
      summaryBullets: ["Acknowledged user frustration, reset tone"],
      actions: [],
      openQuestions: [],
      metricsUsed: [],
    };
  }

  // User expresses frustration about repetition
  if (/already\s+(?:told|said|provided|answered)/i.test(lower)) {
    return {
      assistantMessage:
        "You're right, my bad. Let me stop with the questions and just be helpful. " +
        "What would you like to work on?",
      summaryBullets: ["Acknowledged repetition frustration"],
      actions: [],
      openQuestions: [],
      metricsUsed: [],
    };
  }

  // User seems annoyed/dismissive
  if (/^(whatever|never ?mind|forget it|ugh|stop|enough)/i.test(lower)) {
    return {
      assistantMessage:
        "Got it — I'll back off. Just let me know when you want to dive into something.",
      summaryBullets: ["User disengaged, gave space"],
      actions: [],
      openQuestions: [],
      metricsUsed: [],
    };
  }

  // =========================================================================
  // PRIORITY 2: Handle explicit requests
  // =========================================================================

  // "What do you need from me?"
  if (/what\s+(?:do\s+you\s+need|information|info)/i.test(lower)) {
    return {
      assistantMessage:
        "To give you solid guidance, I work best with: monthly take-home income, pay schedule, " +
        "major bills, any debts (balances and rates), and your top goals. " +
        "But don't worry about having everything — share what you can and I'll work with it. " +
        "What feels like the right place to start?",
      summaryBullets: ["Explained what data helps with coaching"],
      actions: ["Share whatever financial info feels comfortable"],
      openQuestions: ["What would you like to tackle first?"],
      metricsUsed: ["intake"],
    };
  }

  // User says they already told us something
  if (/already\s+(?:told|said|provided|answered)/i.test(lower)) {
    const insight = generateInsight(contextPacket);
    return {
      assistantMessage:
        `Got it — my apologies for the confusion. Let me focus on what's useful. ${insight}`,
      summaryBullets: ["Acknowledged repetition, moved to value"],
      actions: [generateAction(contextPacket, facts)],
      openQuestions: [],
      metricsUsed: ["cashflow", "spendByCategory"],
    };
  }

  // User feels overwhelmed or lost
  if (/overwhelmed|lost|don't know where to start|no idea/i.test(lower)) {
    return {
      assistantMessage:
        "Totally understandable — money stuff can feel like a lot. Let's keep it simple. " +
        "The single most impactful thing for most people is knowing how much buffer they have " +
        "between paychecks and bills. If you can share your monthly take-home and your biggest bill, " +
        "I can give you a concrete starting point.",
      summaryBullets: ["User overwhelmed, simplified to one question"],
      actions: ["Share take-home income and biggest monthly bill"],
      openQuestions: ["What's your monthly take-home income?"],
      metricsUsed: ["intake"],
    };
  }

  // Transaction drilldown request
  if (
    !contextPacket.transactionDrilldown &&
    (lower.includes("leak") || lower.includes("where is my money") || lower.includes("detailed"))
  ) {
    return {
      assistantMessage:
        "I can do a deeper analysis if you opt in to share transaction-level detail for a short window. " +
        "This lets me spot specific merchants or patterns that might be eating your budget. " +
        "Want me to review the last 30 days?",
      summaryBullets: ["Offered transaction drilldown for leak detection"],
      actions: ["Enable transaction detail sharing"],
      openQuestions: ["Ready to share the last 30 days of transactions?"],
      metricsUsed: ["intake"],
      transactionDrilldownRequest: {
        reason: "Investigate spend leaks and miscategorized transactions",
        windowDays: 30,
      },
    };
  }

  // =========================================================================
  // Build response with value + optional question
  // =========================================================================

  const responseParts: string[] = [];
  const summaryBullets: string[] = [];
  const actions: string[] = [];
  let openQuestion: string | undefined;

  // 1. Acknowledge new facts
  const newFactsText = formatNewFacts(facts, established);
  if (newFactsText) {
    responseParts.push(newFactsText);
  }

  // 2. Generate insight
  const insight = generateInsight(contextPacket);
  responseParts.push(insight);
  summaryBullets.push(insight);

  // 3. Generate action
  const action = generateAction(contextPacket, facts);
  actions.push(action);

  // 4. Maybe add a question (but only if we don't have key data)
  const shouldAsk = shouldAskQuestion(contextPacket, facts, established);
  if (shouldAsk) {
    openQuestion = shouldAsk.question;
    responseParts.push(shouldAsk.question);
  }

  // Build foundation updates if we extracted new facts
  const foundationUpdates = buildFoundationUpdates(facts);

  return {
    assistantMessage: responseParts.join(" "),
    summaryBullets,
    actions,
    openQuestions: openQuestion ? [openQuestion] : [],
    metricsUsed: ["cashflow", "spendByCategory", "upcomingBills", "anomalies"],
    foundationUpdates,
  };
}

function formatNewFacts(facts: ExtractedFacts, established: string[]): string | null {
  const parts: string[] = [];

  if (facts.monthlyIncomeCents && !established.some((f) => f.includes("income"))) {
    parts.push(`$${(facts.monthlyIncomeCents / 100).toLocaleString()} monthly income`);
  }
  if (facts.payCadence && !established.some((f) => f.includes("cadence"))) {
    parts.push(`${facts.payCadence} pay schedule`);
  }
  if (facts.mortgagePaymentCents && !established.some((f) => f.includes("mortgage"))) {
    parts.push(`$${(facts.mortgagePaymentCents / 100).toLocaleString()} mortgage`);
  }
  if (facts.hasNoDebt && !established.some((f) => f.includes("no debt"))) {
    parts.push("debt-free");
  }
  if (facts.rothIraCents && !established.some((f) => f.includes("Roth"))) {
    parts.push(`$${(facts.rothIraCents / 100).toLocaleString()} in Roth IRA`);
  }
  if (facts.brokerageCents && !established.some((f) => f.includes("brokerage"))) {
    parts.push(`$${(facts.brokerageCents / 100).toLocaleString()} in brokerage`);
  }

  if (parts.length === 0) return null;
  return `Got it — ${parts.join(", ")}.`;
}

function generateInsight(
  packet: CoachProviderInput["contextPacket"]
): string {
  // Check for anomalies first (most actionable)
  if (packet.anomalies.length > 0) {
    const anomaly = packet.anomalies[0];
    const direction = anomaly.deltaCents > 0 ? "up" : "down";
    return `Your ${anomaly.category} spending is ${direction} ${formatCents(Math.abs(anomaly.deltaCents))} vs your baseline — worth a quick look.`;
  }

  // Cashflow insight
  if (packet.cashflow.netCents < 0) {
    return `You're running ${formatCents(Math.abs(packet.cashflow.netCents))} in the red so far this month. Let's find where to tighten up.`;
  }

  if (packet.cashflow.incomeCents > 0 && packet.cashflow.netCents > 0) {
    const saveRate = Math.round(
      (packet.cashflow.netCents / packet.cashflow.incomeCents) * 100
    );
    return `You're ${formatCents(packet.cashflow.netCents)} ahead this month with a ${saveRate}% save rate. Solid position.`;
  }

  // Upcoming bills
  if (packet.upcomingBills.length > 0) {
    const bill = packet.upcomingBills[0];
    const amount = bill.expectedAmountCents
      ? ` (${formatCents(bill.expectedAmountCents)})`
      : "";
    return `${bill.name}${amount} is coming up on ${formatDate(bill.expectedDate)}. Make sure you're covered.`;
  }

  // Top spend category
  if (packet.spendByCategory.length > 0) {
    const top = packet.spendByCategory[0];
    return `Your biggest spend category is ${top.category} at ${formatCents(top.amountCents)} so far this month.`;
  }

  // Fallback
  return "Based on your data, you're in a reasonable spot. Keep tracking to build a clearer picture.";
}

function generateAction(
  packet: CoachProviderInput["contextPacket"],
  facts: ExtractedFacts
): string {
  if (packet.anomalies.length > 0) {
    return `Review your ${packet.anomalies[0].category} transactions to understand the spike.`;
  }

  if (packet.cashflow.netCents < 0) {
    return "Identify one non-essential expense you can cut or defer this week.";
  }

  if (packet.upcomingBills.length > 0) {
    return `Confirm ${packet.upcomingBills[0].name} is covered before it hits.`;
  }

  if (packet.spendByCategory.length > 0) {
    return `Set a spending cap for ${packet.spendByCategory[0].category} for the rest of the month.`;
  }

  if (facts.mortgagePaymentCents && !facts.monthlyIncomeCents) {
    return "Share your monthly income so I can calculate your housing ratio.";
  }

  return "Log your next few expenses to build momentum and data.";
}

function shouldAskQuestion(
  packet: CoachProviderInput["contextPacket"],
  facts: ExtractedFacts,
  established: string[]
): { question: string } | null {
  const foundation = packet.foundationSnapshot as Record<string, unknown> | null;

  // Check what we already know
  const hasIncome =
    facts.monthlyIncomeCents ||
    established.some((f) => f.includes("income")) ||
    (foundation?.incomeProfile as Record<string, unknown>)?.baselineMonthlyCents;

  const hasCadence =
    facts.payCadence ||
    established.some((f) => f.includes("cadence")) ||
    (foundation?.incomeProfile as Record<string, unknown>)?.cadence;

  const hasCash =
    facts.cashCents ||
    established.some((f) => f.includes("cash") || f.includes("checking")) ||
    (foundation?.balanceSheet as Record<string, unknown>)?.cashCents;

  // Don't ask if we're in frustration cooldown
  if (packet.frustrationDetectedAt) {
    const cooldown = 5 * 60 * 1000;
    if (Date.now() - packet.frustrationDetectedAt < cooldown) {
      return null;
    }
  }

  // Priority order for questions
  if (!hasIncome) {
    return { question: "What's your monthly take-home income after taxes?" };
  }

  if (!hasCadence) {
    return { question: "How often do you get paid?" };
  }

  if (!hasCash) {
    return { question: "Roughly how much cash do you have in checking right now?" };
  }

  // Don't ask if we have the basics
  return null;
}

function buildFoundationUpdates(
  facts: ExtractedFacts
): CoachFoundationUpdate | undefined {
  const updates: CoachFoundationUpdate = {};

  // Income profile
  if (facts.monthlyIncomeCents || facts.payCadence) {
    updates.incomeProfile = {};
    if (facts.monthlyIncomeCents) {
      updates.incomeProfile.baselineMonthlyCents = facts.monthlyIncomeCents;
      updates.incomeProfile.typicalMonthCents = facts.monthlyIncomeCents;
    }
    if (facts.payCadence) {
      updates.incomeProfile.cadence = facts.payCadence;
    }
  }

  // Balance sheet
  if (
    facts.cashCents ||
    facts.savingsCents ||
    facts.rothIraCents ||
    facts.brokerageCents
  ) {
    updates.balanceSheet = {};
    if (facts.cashCents) updates.balanceSheet.cashCents = facts.cashCents;
    if (facts.savingsCents) updates.balanceSheet.savingsCents = facts.savingsCents;
    if (facts.rothIraCents) updates.balanceSheet.retirementCents = facts.rothIraCents;
    if (facts.brokerageCents) updates.balanceSheet.investmentCents = facts.brokerageCents;
  }

  // Fixed obligations (mortgage)
  if (facts.mortgagePaymentCents) {
    updates.fixedObligations = [
      {
        name: "Mortgage",
        amountCents: facts.mortgagePaymentCents,
        cadence: "monthly",
      },
    ];
  }

  // Debts
  if (facts.hasNoDebt) {
    updates.debts = [];
  }

  // Goals
  if (facts.goals && facts.goals.length > 0) {
    updates.goals = facts.goals.map((name, index) => ({
      name,
      priority: index + 1,
    }));
  }

  return Object.keys(updates).length > 0 ? updates : undefined;
}

// ============================================================================
// Provider Export
// ============================================================================

export function createMockProvider(): CoachProvider {
  return {
    id: "mock",
    generate: async (input) => {
      const payload = buildMockResponse(input);
      return CoachOutputSchema.parse({
        assistantMessage: payload.assistantMessage ?? "I'm ready to help. What would you like to focus on?",
        summaryBullets: payload.summaryBullets ?? [],
        actions: payload.actions ?? [],
        openQuestions: payload.openQuestions ?? [],
        metricsUsed: payload.metricsUsed ?? [],
        foundationUpdates: payload.foundationUpdates,
        transactionDrilldownRequest: payload.transactionDrilldownRequest,
      });
    },
  };
}
