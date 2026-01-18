import type { CoachProvider, CoachProviderInput } from "../types";
import { CoachOutputSchema } from "../schema";
import type { CoachFoundationUpdate } from "../../coach/foundation";

function formatCents(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const abs = Math.abs(amountCents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type PayCadence = "weekly" | "biweekly" | "semimonthly" | "monthly" | "irregular";

type ExtractedFacts = {
  incomeRangeCents?: { min: number; max: number };
  incomeCents?: number;
  payCadence?: PayCadence;
  mentionsMortgage?: boolean;
  goalMillionaire?: boolean;
};

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

function detectPayCadence(text: string): PayCadence | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("biweekly")) return "biweekly";
  if (lower.includes("semi-monthly") || lower.includes("semimonthly")) return "semimonthly";
  if (lower.includes("weekly")) return "weekly";
  if (lower.includes("monthly")) return "monthly";
  if (lower.includes("irregular") || lower.includes("seasonal")) return "irregular";
  return undefined;
}

function extractFacts(messages: string[]): ExtractedFacts {
  const facts: ExtractedFacts = {};
  for (const message of messages) {
    const lower = message.toLowerCase();
    const mentionsIncome = lower.includes("income") || lower.includes("after tax") || lower.includes("take home");
    const rangeMatch = mentionsIncome
      ? message.match(/(\$?\d[\d,]*(?:\.\d+)?k?)\s*(?:-|–|to)\s*(\$?\d[\d,]*(?:\.\d+)?k?)/i)
      : null;
    if (rangeMatch) {
      const minValue = parseMoneyToken(rangeMatch[1]);
      const maxValue = parseMoneyToken(rangeMatch[2]);
      if (minValue !== null && maxValue !== null) {
        const min = Math.min(minValue, maxValue) * 100;
        const max = Math.max(minValue, maxValue) * 100;
        facts.incomeRangeCents = { min, max };
      }
    } else if (mentionsIncome) {
      const singleMatch = message.match(/(\$?\d[\d,]*(?:\.\d+)?k?)/i);
      if (singleMatch) {
        const value = parseMoneyToken(singleMatch[1]);
        if (value !== null) facts.incomeCents = value * 100;
      }
    }

    const cadence = detectPayCadence(message);
    if (cadence) facts.payCadence = cadence;
    if (lower.includes("mortgage")) facts.mentionsMortgage = true;
    if (lower.includes("millionaire") || /\b\$?1m\b/.test(lower)) facts.goalMillionaire = true;
  }
  return facts;
}

function formatRange(minCents: number, maxCents: number): string {
  return `${formatCents(minCents)}–${formatCents(maxCents)}`;
}

function buildIntakeFollowup(
  input: CoachProviderInput,
  facts: ExtractedFacts
) {
  const foundation = (input.contextPacket.foundationSnapshot ?? {}) as CoachFoundationUpdate;
  const needsDebts = !foundation.debts || foundation.debts.length === 0;
  const needsGoals = !foundation.goals || foundation.goals.length === 0;
  const needsBalanceSheet = !foundation.balanceSheet;
  const needsRisk = !foundation.riskProfile;
  const needsTax = !foundation.taxProfile;

  const knownLines: string[] = [];
  if (facts.incomeRangeCents) {
    knownLines.push(`After-tax income range: ${formatRange(facts.incomeRangeCents.min, facts.incomeRangeCents.max)} per month.`);
  } else if (facts.incomeCents) {
    knownLines.push(`After-tax income: ${formatCents(facts.incomeCents)} per month.`);
  }
  if (facts.payCadence) knownLines.push(`Pay cadence: ${facts.payCadence}.`);
  if (facts.mentionsMortgage) knownLines.push("Fixed bill mentioned: mortgage.");

  const missingPrompts: Array<{ action: string; question: string }> = [];
  if (facts.mentionsMortgage) {
    missingPrompts.push({
      action: "Share your monthly mortgage amount and due date.",
      question: "What is your monthly mortgage payment and due date?",
    });
  }
  if (!facts.payCadence) {
    missingPrompts.push({
      action: "Confirm your pay cadence (weekly, biweekly, semimonthly, monthly).",
      question: "What is your pay cadence?",
    });
  }
  if (needsDebts) {
    missingPrompts.push({
      action: "List debts with balances, APRs, and minimum payments.",
      question: "What debts do you have, and what are their balances/APRs/minimums?",
    });
  }
  if (needsBalanceSheet) {
    missingPrompts.push({
      action: "Share current cash/savings and investment balances.",
      question: "What are your current cash, savings, and investment balances?",
    });
  }
  if (needsGoals) {
    missingPrompts.push({
      action: facts.goalMillionaire
        ? "State your $1M target timeline and priority order for goals."
        : "Share your top goals and timelines (what matters most and by when).",
      question: facts.goalMillionaire
        ? "What is your target timeline to reach $1M?"
        : "What are your top financial goals and timelines?",
    });
  }
  if (needsRisk) {
    missingPrompts.push({
      action: "Share dependents count and basic insurance coverage status.",
      question: "Do you have dependents or any insurance coverage gaps I should know about?",
    });
  }
  if (needsTax) {
    missingPrompts.push({
      action: "Provide filing status and W-2 vs 1099 mix (high level).",
      question: "What is your filing status and W-2 vs 1099 mix (high level)?",
    });
  }

  const primaryPrompt = missingPrompts[0] ?? {
    action: "Tell me your top focus this week so I can build a short plan.",
    question: "What feels most urgent right now: spending, debt, or savings?",
  };

  const lowerMessage = input.message.toLowerCase();
  const overwhelmed =
    lowerMessage.includes("don't know where to start") ||
    lowerMessage.includes("dont know where to start") ||
    lowerMessage.includes("overwhelmed") ||
    lowerMessage.includes("lost") ||
    lowerMessage.includes("no idea where to start");

  const assistantMessageParts: string[] = [];
  assistantMessageParts.push(
    overwhelmed
      ? "Totally fair — starting can feel overwhelming."
      : "Got it — thanks for sharing."
  );
  if (knownLines.length) {
    assistantMessageParts.push(`Here is what I heard: ${knownLines.join(" ")}`);
  }
  assistantMessageParts.push("Let’s start with one anchor so I can build a simple plan.");
  assistantMessageParts.push(primaryPrompt.action);
  assistantMessageParts.push(primaryPrompt.question);

  const incomeUpdates: CoachFoundationUpdate["incomeProfile"] = {};
  if (facts.payCadence) incomeUpdates.cadence = facts.payCadence;
  if (facts.incomeRangeCents) {
    const midpoint = Math.round((facts.incomeRangeCents.min + facts.incomeRangeCents.max) / 2);
    incomeUpdates.worstMonthCents = facts.incomeRangeCents.min;
    incomeUpdates.bestMonthCents = facts.incomeRangeCents.max;
    incomeUpdates.typicalMonthCents = midpoint;
  } else if (facts.incomeCents) {
    incomeUpdates.baselineMonthlyCents = facts.incomeCents;
    incomeUpdates.typicalMonthCents = facts.incomeCents;
  }

  const foundationUpdates: CoachFoundationUpdate | undefined =
    Object.keys(incomeUpdates).length > 0 ? { incomeProfile: incomeUpdates } : undefined;

  return {
    assistantMessage: assistantMessageParts.join(" "),
    summaryBullets: [
      ...knownLines,
      `Next step: ${primaryPrompt.action}`,
    ],
    actions: [primaryPrompt.action],
    openQuestions: [primaryPrompt.question],
    metricsUsed: ["intake", "recentConversation"],
    foundationUpdates,
  };
}

function buildMockResponse(input: CoachProviderInput) {
  const { contextPacket } = input;
  const message = input.message.trim().toLowerCase();
  const recentUserMessages = contextPacket.recentConversation
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content);
  const facts = extractFacts([...recentUserMessages, input.message]);

  if (!contextPacket.transactionDrilldown && (message.includes("leak") || message.includes("transactions") || message.includes("charges"))) {
    return {
      assistantMessage:
        "I can do a deeper leak check if you opt in to share transaction-level detail for a short window. Would you like me to review the last 30 days?",
      summaryBullets: ["Transaction-level detail is needed for leak troubleshooting."],
      actions: ["Enable a short transaction drilldown window for review."],
      openQuestions: ["Do you want me to review the last 30 days of transactions?"],
      metricsUsed: ["intake"],
      transactionDrilldownRequest: { reason: "Investigate potential spend leaks and miscategorized transfers.", windowDays: 30 },
    };
  }

  if (message.includes("ai model") || message.includes("are you an ai")) {
    return {
      assistantMessage:
        "Yes. I am an alpha-safe financial coach. I can help you build budgets and plans using your data in this app.",
      summaryBullets: ["Confirmed coach role and scope."],
      actions: ["Share your primary money goal for this month."],
      openQuestions: ["What do you want to improve first: spending, saving, or debt payoff?"],
      metricsUsed: ["intake"],
    };
  }

  if (message.includes("what information") || message.includes("information do you need")) {
    return {
      assistantMessage:
        "To build a budget and long-term plan, I need your after-tax income, pay schedule, fixed bills, variable spending, debts (balances and rates), savings/investments, emergency fund target, and your time horizon/risk comfort. Share whatever you can.",
      summaryBullets: [
        "Need income, bills, variable spend, debts, savings/investments, and goal timeline.",
      ],
      actions: [
        "Share monthly take-home income and pay cadence.",
        "List fixed bills and debt balances/rates.",
        "Share current savings/investment totals.",
      ],
      openQuestions: [
        "What is your target timeline for reaching $1M?",
      ],
      metricsUsed: ["intake"],
    };
  }

  const askingForNextAction =
    message.includes("next action") ||
    message.includes("what should i do") ||
    message.includes("what do i do") ||
    message.includes("given what i said") ||
    message.includes("next step");
  const sharedIntakeInfo = !!facts.incomeRangeCents || !!facts.incomeCents || !!facts.payCadence || !!facts.mentionsMortgage;
  const planningIntent = message.includes("plan") || message.includes("budget") || message.includes("investment") || message.includes("millionaire");

  if (askingForNextAction || sharedIntakeInfo || planningIntent) {
    return buildIntakeFollowup(input, facts);
  }

  const cashflow = contextPacket.cashflow;
  const topCategory = contextPacket.spendByCategory[0];
  const nextBill = contextPacket.upcomingBills[0];
  const focus = contextPacket.coachState?.currentFocus ?? undefined;

  const summaryBullets: string[] = [
    `Net cashflow for ${contextPacket.month.label}: ${formatCents(cashflow.netCents)}.`,
    `Income: ${formatCents(cashflow.incomeCents)}. Expenses: ${formatCents(cashflow.expenseCents)}.`,
  ];

  if (topCategory) {
    summaryBullets.push(`Top spend so far: ${topCategory.category} at ${formatCents(topCategory.amountCents)}.`);
  }
  if (nextBill) {
    summaryBullets.push(`Next bill: ${nextBill.name} due ${formatDate(nextBill.expectedDate)}.`);
  }
  if (focus) {
    summaryBullets.push(`Current focus: ${focus}.`);
  }

  const actions: string[] = [];
  if (topCategory) actions.push(`Review ${topCategory.category} transactions for quick wins.`);
  actions.push("Confirm upcoming bills and amounts for the next 30 days.");

  const openQuestions: string[] = [
    "What goal should we prioritize this week: savings, debt payoff, or reducing a spend category?",
  ];

  const assistantMessage = [
    `Here is a quick snapshot for ${contextPacket.month.label}.`,
    `Net cashflow is ${formatCents(cashflow.netCents)}.`,
    topCategory
      ? `Your top spend category is ${topCategory.category} at ${formatCents(topCategory.amountCents)}.`
      : "I do not see a dominant spend category yet.",
    nextBill
      ? `Upcoming bill: ${nextBill.name} around ${formatDate(nextBill.expectedDate)}.`
      : "No upcoming bills are flagged in the next 30 days.",
    "Tell me what you want to focus on next, and I will build a simple plan.",
  ].join(" ");

  const metricsUsed = ["cashflow", "spendByCategory", "upcomingBills", "coachState"];

  return {
    assistantMessage,
    summaryBullets,
    actions,
    openQuestions,
    metricsUsed,
  };
}

export function createMockProvider(): CoachProvider {
  return {
    id: "mock",
    generate: async (input) => {
      const payload = buildMockResponse(input);
      return CoachOutputSchema.parse(payload);
    },
  };
}
