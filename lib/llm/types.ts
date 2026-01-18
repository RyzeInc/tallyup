import type { CoachOutput } from "./schema";

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
};

export type CoachProviderInput = {
  message: string;
  contextPacket: CoachContextPacket;
  systemPrompt: string;
};

export type CoachProvider = {
  id: "mock" | "groq" | "cloudflare";
  generate: (input: CoachProviderInput) => Promise<CoachOutput>;
};
