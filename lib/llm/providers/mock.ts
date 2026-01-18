import type { CoachProvider, CoachProviderInput } from "../types";
import { CoachOutputSchema } from "../schema";

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

function buildMockResponse(input: CoachProviderInput) {
  const { contextPacket } = input;
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
