import type { CoachOutput } from "./schema";
import type { CoachContextPacket } from "./types";

const DEFAULT_INTAKE_ITEMS = [
  "Monthly take-home income and pay cadence",
  "Fixed bills (rent/mortgage, utilities, insurance, subscriptions)",
  "Variable spending by category (food, transport, etc.)",
  "Debts: balances, interest rates, minimum payments",
  "Current savings and investment balances",
  "Employer retirement match details (if any)",
  "Emergency fund target",
  "Time horizon and risk comfort",
];

function hasListFormatting(message: string): boolean {
  return /\n\s*[-*]\s+|\n\s*\d+\.\s+|•\s+/.test(message);
}

function seemsIncomplete(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  const hasList = hasListFormatting(trimmed);

  if (trimmed.endsWith(":")) return true;
  if (lower.includes("please provide the following") && !hasList) return true;
  if (lower.includes("following information") && !hasList) return true;
  if (lower.endsWith("following") && !hasList) return true;

  return false;
}

function isIntakeQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("what information") ||
    lower.includes("what info") ||
    lower.includes("what following") ||
    lower.includes("information do you need") ||
    lower.includes("need to know")
  );
}

function buildIntakeList(contextPacket: CoachContextPacket, fallback: string[]): string[] {
  const items = fallback.slice();
  if (contextPacket.cashflow.incomeCents > 0 && contextPacket.cashflow.expenseCents > 0) {
    const idx = items.findIndex((item) => item.startsWith("Monthly take-home income"));
    if (idx >= 0) items[idx] = "Confirm take-home income and pay cadence";
  }
  return items;
}

function formatList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function getLastAssistantMessage(packet: CoachContextPacket): string | null {
  const last = [...packet.recentConversation].reverse().find((entry) => entry.role === "assistant");
  return last?.content?.trim() ?? null;
}

function pickNextStep(packet: CoachContextPacket): { action: string; question: string } {
  const foundation = packet.foundationSnapshot;
  if (!foundation?.balanceSheet) {
    return {
      action: "Share current cash, savings, and investment balances.",
      question: "What are your current cash, savings, and investment balances?",
    };
  }
  if (!foundation?.debts || foundation.debts.length === 0) {
    return {
      action: "List debts with balances, APRs, and minimum payments.",
      question: "What debts do you have, and what are their balances/APRs/minimums?",
    };
  }
  if (!foundation?.goals || foundation.goals.length === 0) {
    return {
      action: "Share your top goals and timelines (what matters most and by when).",
      question: "What are your top financial goals and timelines?",
    };
  }
  if (!foundation?.riskProfile) {
    return {
      action: "Share dependents count and basic insurance coverage status.",
      question: "Do you have dependents or any insurance coverage gaps I should know about?",
    };
  }
  if (!foundation?.taxProfile) {
    return {
      action: "Provide filing status and W-2 vs 1099 mix (high level).",
      question: "What is your filing status and W-2 vs 1099 mix (high level)?",
    };
  }
  return {
    action: "Tell me your top focus this week so I can build a short plan.",
    question: "What feels most urgent right now: spending, debt, or savings?",
  };
}

export function applyCoachResponseGuards(
  output: CoachOutput,
  input: { userMessage: string; contextPacket: CoachContextPacket }
): CoachOutput {
  const assistantMessage = output.assistantMessage ?? "";
  const needsList = seemsIncomplete(assistantMessage) && isIntakeQuestion(input.userMessage);

  const trimmedOutput: CoachOutput = {
    ...output,
    actions: output.actions.slice(0, 2),
    openQuestions: output.openQuestions.slice(0, 2),
  };

  const lastAssistantMessage = getLastAssistantMessage(input.contextPacket);
  if (lastAssistantMessage && lastAssistantMessage === assistantMessage.trim()) {
    const nextStep = pickNextStep(input.contextPacket);
    return {
      ...trimmedOutput,
      assistantMessage: [
        "Thanks for clarifying — I have that noted.",
        nextStep.action,
        nextStep.question,
      ].join(" "),
      actions: [nextStep.action],
      openQuestions: [nextStep.question],
    };
  }

  if (!needsList) return trimmedOutput;

  const listSource = trimmedOutput.actions.length ? trimmedOutput.actions : DEFAULT_INTAKE_ITEMS;
  const listItems = buildIntakeList(input.contextPacket, listSource);
  const cleanedBase = assistantMessage.replace(/:\s*$/, "").trim();
  const prefix = cleanedBase
    ? `${cleanedBase}\n\nHere is the information I need:\n`
    : "Here is the information I need:\n";

  return {
    ...trimmedOutput,
    assistantMessage: `${prefix}${formatList(listItems)}`,
    actions: trimmedOutput.actions.length ? [] : trimmedOutput.actions,
  };
}
