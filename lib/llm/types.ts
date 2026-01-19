import type { CoachOutput } from "./schema";
import type { CoachFoundation } from "../coach/foundation";
import type { SlotLedger } from "../coach/slotLedger";

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
