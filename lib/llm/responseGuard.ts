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
