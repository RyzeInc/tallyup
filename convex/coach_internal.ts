import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  computeAnomalies,
  computeMonthlyCashflow,
  computeSpendByCategory,
  computeTransactionDrilldown,
  computeUpcomingBills,
  type MonthInput,
} from "./finance_aggregates";
import {
  computeBalanceSheet,
  computeBaselineObligations,
  computeDebtSnapshot,
  computeGoalSnapshot,
  computeIncomeProfile,
  computeRiskProfile,
  computeTaxProfile,
  computeTransactionDiagnostics,
  computeHealthSummary,
} from "./coach_aggregates";
import {
  evaluateBudget,
  formatDayKey,
  GLOBAL_USAGE_USER_ID,
} from "../lib/llm/budgetGuard";
import type { 
  CoachContextPacket, 
  ContextDepth, 
  DataFreshnessInfo, 
  DataFreshnessLevel,
} from "../lib/llm/types";
import { cosineSimilarity, embedText } from "../lib/llm/embedding";

const CONTEXT_TTL_MS = 2 * 60 * 1000;
const KNOWLEDGE_TTL_MS = 2 * 60 * 1000;

// Data freshness thresholds (in milliseconds)
const FRESHNESS_THRESHOLDS = {
  fresh: 24 * 60 * 60 * 1000,      // 24 hours
  stale: 7 * 24 * 60 * 60 * 1000,  // 7 days
  old: 30 * 24 * 60 * 60 * 1000,   // 30 days
} as const;

type Ctx = QueryCtx | MutationCtx;

function deepMerge(base: Record<string, unknown>, update: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(update)) {
    if (Array.isArray(value) || value === null || value === undefined) {
      merged[key] = value;
      continue;
    }
    const baseValue = merged[key];
    if (
      typeof value === "object" &&
      value &&
      typeof baseValue === "object" &&
      baseValue &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = deepMerge(baseValue as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function monthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function monthBounds(month: MonthInput): { start: number; end: number } {
  const start = Date.UTC(month.year, month.month - 1, 1, 0, 0, 0, 0);
  const end = Date.UTC(month.year, month.month, 1, 0, 0, 0, 0);
  return { start, end };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function hashContextPacket(packet: CoachContextPacket): string {
  return hashString(JSON.stringify(packet));
}

/**
 * Compute data freshness based on Plaid sync timestamps and manual entry activity
 */
async function computeDataFreshness(ctx: Ctx, userId: string): Promise<DataFreshnessInfo> {
  const now = Date.now();
  
  // Get the most recent Plaid sync timestamp from linked accounts
  const linkedAccounts = await ctx.db
    .query("accounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isLinked"), true))
    .collect();
  
  // Get most recent entry timestamp (for manual tracking users)
  const recentEntry = await ctx.db
    .query("entries")
    .withIndex("by_user_date", (q) => q.eq("userId", userId))
    .filter((q) => q.neq(q.field("isArchived"), true))
    .order("desc")
    .first();
  
  // Determine the most recent data update
  let lastUpdatedAt: number | null = null;
  
  // Use the most recent of: Plaid sync or manual entry
  const plaidSyncTimes = linkedAccounts
    .map((a) => a.lastPlaidSync)
    .filter((t): t is number => t !== undefined && t !== null);
  
  const mostRecentPlaidSync = plaidSyncTimes.length > 0 
    ? Math.max(...plaidSyncTimes) 
    : null;
  
  const mostRecentEntry = recentEntry?.createdAt ?? null;
  
  if (mostRecentPlaidSync && mostRecentEntry) {
    lastUpdatedAt = Math.max(mostRecentPlaidSync, mostRecentEntry);
  } else {
    lastUpdatedAt = mostRecentPlaidSync ?? mostRecentEntry;
  }
  
  // If no data at all, return unknown
  if (lastUpdatedAt === null) {
    return {
      level: "unknown",
      lastUpdatedAt: null,
      daysSinceUpdate: null,
      shouldConfirm: false,
      message: "No financial data available yet",
    };
  }
  
  const msSinceUpdate = now - lastUpdatedAt;
  const daysSinceUpdate = Math.floor(msSinceUpdate / (24 * 60 * 60 * 1000));
  
  // Determine freshness level
  let level: DataFreshnessLevel;
  let shouldConfirm: boolean;
  let message: string | undefined;
  
  if (msSinceUpdate < FRESHNESS_THRESHOLDS.fresh) {
    level = "fresh";
    shouldConfirm = false;
  } else if (msSinceUpdate < FRESHNESS_THRESHOLDS.stale) {
    level = "stale";
    shouldConfirm = false;
    message = `Data last updated ${daysSinceUpdate} days ago`;
  } else if (msSinceUpdate < FRESHNESS_THRESHOLDS.old) {
    level = "old";
    shouldConfirm = true;
    message = `Data is ${daysSinceUpdate} days old. I should confirm it's still accurate before using it.`;
  } else {
    level = "old";
    shouldConfirm = true;
    message = `Data is over a month old (${daysSinceUpdate} days). I'll need to confirm current accuracy.`;
  }
  
  return {
    level,
    lastUpdatedAt,
    daysSinceUpdate,
    shouldConfirm,
    message,
  };
}

export async function buildContextPacket(ctx: Ctx, userId: string): Promise<CoachContextPacket> {
  const now = new Date();
  const currentMonth: MonthInput = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
  const { start, end } = monthBounds(currentMonth);

  // Core financial data (always computed)
  const [cashflow, spendByCategory, upcomingBills, anomalies] = await Promise.all([
    computeMonthlyCashflow(ctx, userId, currentMonth),
    computeSpendByCategory(ctx, userId, currentMonth),
    computeUpcomingBills(ctx, userId, 30),
    computeAnomalies(ctx, userId),
  ]);

  // Extended financial context (A-G) - computed in parallel
  const [
    balanceSheet,
    incomeProfile,
    debtSnapshot,
    goalSnapshot,
  ] = await Promise.all([
    computeBalanceSheet(ctx, userId),
    computeIncomeProfile(ctx, userId),
    computeDebtSnapshot(ctx, userId),
    computeGoalSnapshot(ctx, userId),
  ]);

  // Baseline obligations (depends on nothing else)
  const baselineObligations = await computeBaselineObligations(ctx, userId);

  const coachState = await ctx.db
    .query("coachState")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const sessionState = await ctx.db
    .query("coachSessionState")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const foundation = await ctx.db
    .query("coachFoundation")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const draft = await ctx.db
    .query("coachDraft")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  // Compute risk and tax profiles (depend on foundation + other snapshots)
  const foundationData = (foundation?.snapshot as Record<string, unknown>) ?? null;
  const [riskProfile, taxProfile] = await Promise.all([
    computeRiskProfile(ctx, userId, foundationData, balanceSheet, baselineObligations),
    computeTaxProfile(ctx, userId, foundationData, incomeProfile),
  ]);

  const drilldownOptIn = (coachState?.preferences as { transactionDrilldownOptIn?: { enabled?: boolean; windowDays?: number; expiresAt?: number } } | undefined)
    ?.transactionDrilldownOptIn;
  const optInEnabled = !!drilldownOptIn?.enabled && (drilldownOptIn.expiresAt ?? 0) > Date.now();
  const windowDays = drilldownOptIn?.windowDays ?? 30;
  const drilldownItems = optInEnabled
    ? await computeTransactionDrilldown(ctx, userId, windowDays)
    : [];

  // Transaction diagnostics only when drilldown is enabled (troubleshooting mode)
  const transactionDiagnostics = optInEnabled
    ? await computeTransactionDiagnostics(ctx, userId)
    : null;

  const events = await ctx.db
    .query("coachEvents")
    .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(5);

  const eventsChrono = [...events].reverse();
  const conversation: CoachContextPacket["recentConversation"] = [];
  for (const event of eventsChrono) {
    if (event.userMessage) {
      conversation.push({ role: "user", content: event.userMessage, createdAt: event.createdAt });
    }
    if (event.assistantMessage) {
      conversation.push({ role: "assistant", content: event.assistantMessage, createdAt: event.createdAt });
    }
  }

  const recentSummaries = events.flatMap((event) => event.summaryBullets).slice(0, 12);
  const recentActions = events.flatMap((event) => event.actions).slice(0, 12);
  const recentOpenQuestions = events.flatMap((event) => event.openQuestions).slice(0, 12);

  // Get slot ledger and established facts from session state
  const slotLedger = sessionState?.slotLedger ?? null;
  const establishedFacts = sessionState?.establishedFacts ?? null;
  const frustrationDetectedAt = sessionState?.frustrationDetectedAt ?? null;

  // Compute data freshness for context decisions
  const dataFreshness = await computeDataFreshness(ctx, userId);

  return {
    generatedAt: Date.now(),
    month: {
      year: currentMonth.year,
      month: currentMonth.month,
      label: monthLabel(currentMonth.year, currentMonth.month),
      startDate: start,
      endDate: end,
    },
    cashflow,
    spendByCategory,
    upcomingBills,
    anomalies,
    coachState: coachState
      ? {
          preferences: coachState.preferences,
          currentFocus: coachState.currentFocus ?? null,
        }
      : null,
    sessionSummary: sessionState?.summary ?? null,
    openLoops: sessionState?.openLoops ?? null,
    slotLedger,
    establishedFacts,
    frustrationDetectedAt,
    recentSummaries,
    recentActions,
    recentOpenQuestions,
    recentConversation: conversation.slice(-8),
    foundationSnapshot: (foundation?.snapshot as CoachContextPacket["foundationSnapshot"]) ?? null,
    draftProfile: (draft?.profileDraft as CoachContextPacket["draftProfile"]) ?? null,
    draftFoundation: (draft?.foundationDraft as CoachContextPacket["draftFoundation"]) ?? null,
    transactionDrilldownOptIn: optInEnabled
      ? { enabled: true, windowDays, expiresAt: drilldownOptIn?.expiresAt ?? 0 }
      : { enabled: false, windowDays, expiresAt: drilldownOptIn?.expiresAt ?? 0 },
    transactionDrilldown: optInEnabled ? { windowDays, items: drilldownItems } : null,
    
    // Extended financial context (A-G)
    balanceSheet,
    incomeProfile,
    baselineObligations,
    debtSnapshot,
    goalSnapshot,
    riskProfile,
    taxProfile,
    transactionDiagnostics,
    
    // H) Pre-computed health summary
    healthSummary: computeHealthSummary(balanceSheet, incomeProfile, debtSnapshot, riskProfile, cashflow),
    
    // Context depth for adaptive inclusion
    contextDepth: computeContextDepth(balanceSheet, goalSnapshot, conversation),
    
    // Data freshness for context decisions
    dataFreshness,
  };
}

/**
 * Determine context depth based on user's data completeness
 */
function computeContextDepth(
  balanceSheet: CoachContextPacket["balanceSheet"],
  goalSnapshot: CoachContextPacket["goalSnapshot"],
  conversation: CoachContextPacket["recentConversation"]
): ContextDepth {
  const hasAccounts = balanceSheet && (
    balanceSheet.checking.length > 0 || 
    balanceSheet.savings.length > 0 ||
    balanceSheet.creditCards.length > 0 ||
    balanceSheet.loans.length > 0
  );
  const hasGoals = goalSnapshot && goalSnapshot.goals.length > 0;
  const hasHistory = conversation && conversation.length > 3;
  
  if (!hasAccounts && !hasGoals) return "minimal"; // New user
  if (!hasHistory) return "standard"; // Has data but new to coach
  return "full"; // Established user
}

export function summarizePacket(packet: CoachContextPacket) {
  return {
    monthLabel: packet.month.label,
    cashflow: packet.cashflow,
    topCategories: packet.spendByCategory.slice(0, 5),
    upcomingBills: packet.upcomingBills.slice(0, 5),
    anomalies: packet.anomalies.slice(0, 5),
    currentFocus: packet.coachState?.currentFocus ?? null,
    recentSummaries: packet.recentSummaries,
    updatedAt: packet.generatedAt,
    foundation: packet.foundationSnapshot
      ? { updatedAt: packet.generatedAt, hasFoundation: true }
      : { updatedAt: packet.generatedAt, hasFoundation: false },
  };
}

// Conversation mode type imported from types
type ConversationMode = 
  | "default"
  | "learning"
  | "learning:exploration"
  | "learning:validation"
  | "planning"
  | "planning:action"
  | "planning:crisis";

export function classifyIntent(message: string): { 
  domain?: string; 
  task?: string;
  depth: "quick" | "standard" | "deep";
  needsStructuredPlan?: boolean;
  /** User is signaling they're a beginner and need education, not questions */
  needsEducation?: boolean;
  /** User is pushing back or expressing frustration */
  expressingFrustration?: boolean;
  /** User explicitly doesn't want to answer questions right now */
  resistingQuestions?: boolean;
  /** Auto-detected conversation mode based on message content */
  autoDetectedMode?: ConversationMode;
  /** Whether the question is conceptual (not about user's specific situation) */
  isConceptual?: boolean;
} {
  const lower = message.toLowerCase();
  const hasAny = (terms: string[]) => terms.some((term) => lower.includes(term));

  let domain: string | undefined;
  if (hasAny(["debt", "loan", "credit", "apr", "interest"])) domain = "debt";
  else if (hasAny(["invest", "ira", "401", "retire", "portfolio"])) domain = "investing";
  else if (hasAny(["budget", "cashflow", "spend", "category", "bill", "rent", "mortgage"])) domain = "budgeting";
  else if (hasAny(["tax", "withholding", "refund", "irs"])) domain = "tax";
  else if (hasAny(["save", "savings", "emergency fund", "buffer"])) domain = "savings";
  else if (hasAny(["app", "how do i", "where", "settings", "help"])) domain = "app_help";

  let task: string | undefined;
  if (hasAny(["plan", "roadmap", "strategy"])) task = "plan";
  else if (hasAny(["why", "how", "what is", "explain"])) task = "explain";
  else if (hasAny(["fix", "issue", "problem", "stuck"])) task = "troubleshoot";
  else if (hasAny(["compare", "versus", "vs"])) task = "compare";
  else if (hasAny(["summarize", "summary"])) task = "summarize";
  else if (hasAny(["should i", "do i"])) task = "decide";

  // ============================================
  // EMOTIONAL/CONTEXT SIGNALS (check these first)
  // ============================================
  
  // Beginner signals - user is saying they don't understand
  const beginnerSignals = [
    "don't know anything", "dont know anything",
    "don't understand", "dont understand",
    "never learned", "wasn't taught", "no idea",
    "new to this", "beginner", "just starting",
    "where do i start", "where do i begin",
    "explain like", "eli5", "basics",
    "i'm lost", "im lost", "confused about",
    "what even is", "what does that mean",
    "i don't get", "i dont get",
  ];
  const needsEducation = hasAny(beginnerSignals);
  
  // Frustration/pushback signals - user feels unheard
  const frustrationSignals = [
    "ignoring", "not listening", "you're not",
    "already told you", "already said", "i said",
    "that's not what i", "thats not what i",
    "you keep asking", "stop asking",
    "i feel like you", "feels like you",
    "frustrated", "annoying", "annoyed",
    "not helpful", "doesn't help", "doesnt help",
    "aren't important", "not important", "don't care about",
    "just tell me", "just show me", "just give me",
  ];
  const expressingFrustration = hasAny(frustrationSignals);
  
  // Resisting questions - user doesn't want to be interrogated
  const questionResistanceSignals = [
    "aren't important", "not important to me",
    "don't want to answer", "cant answer",
    "i don't know the answer", "how would i know",
    "you have my data", "you should know",
    "can you just", "why do you need",
    "stop asking", "quit asking",
  ];
  const resistingQuestions = hasAny(questionResistanceSignals);

  // ============================================
  // CONCEPTUAL VS PERSONAL DETECTION
  // ============================================
  
  // Signals that indicate a conceptual/learning question (not about their specific situation)
  const conceptualSignals = [
    // Generic "what is" questions
    "what is a", "what is an", "what's a", "what's an",
    "what are", "what does", "what do",
    "how does", "how do", "how can someone",
    // Hypotheticals
    "what if someone", "if someone", "let's say", "hypothetically",
    "in general", "generally speaking", "typically",
    "on average", "most people", "the average person",
    // Learning phrases
    "can you explain", "tell me about", "teach me",
    "i want to learn", "i want to understand",
    "how does x work", "what's the difference between",
    "pros and cons", "advantages and disadvantages",
    // Generic advice seeking
    "what should someone", "what would you recommend to someone",
    "best practice", "rule of thumb", "common advice",
    // FIRE, investing concepts
    "what is fire", "what's fire", "fire movement",
    "index fund", "compound interest", "dollar cost averaging",
    "roth vs traditional", "401k vs ira",
  ];
  
  // Signals that indicate a personal question (about their specific situation)
  const personalSignals = [
    // First person possessive
    "my", "mine", "i have", "i've", "i am", "i'm",
    "my debt", "my savings", "my budget", "my income",
    "my spending", "my account", "my balance",
    // Direct questions about their situation
    "how much do i", "how much have i", "how much can i",
    "what's my", "what is my", "where did my",
    "should i", "can i afford", "am i on track",
    "based on my", "looking at my", "given my",
    // Action-oriented
    "help me", "show me", "tell me my",
  ];
  
  const hasConceptualSignals = hasAny(conceptualSignals);
  const hasPersonalSignals = hasAny(personalSignals);
  
  // Determine if conceptual (learning-focused, not data-anchored)
  // Conceptual if: has conceptual signals AND doesn't have strong personal signals
  // OR if message is very generic without any personal context
  const isConceptual = hasConceptualSignals && !hasPersonalSignals;

  // ============================================
  // RESPONSE DEPTH DETERMINATION
  // ============================================
  
  let depth: "quick" | "standard" | "deep" = "standard";
  let needsStructuredPlan = false;
  
  // Deep indicators - user wants thorough, actionable guidance
  const deepIndicators = [
    "build me", "create a", "make me", "help me", "give me a",
    "plan", "strategy", "roadmap", "step by step", "steps",
    "comprehensive", "detailed", "thorough", "complete",
    "how should i", "what should i", "guide me", "walk me through",
    "analyze", "review my", "look at my",
    "payoff", "pay off", "get out of debt", "become debt free",
    "retirement", "financial independence", "fire",
    "long term", "long-term", "5 year", "10 year",
  ];
  
  // Quick indicators - user wants fast, simple answer
  const quickIndicators = [
    "what is", "what's", "define", "meaning of",
    "how much", "how many", "what was",
    "balance", "total", "amount",
    "yes or no", "quick question",
    "remind me",
  ];
  
  // Check for deep response needs
  if (hasAny(deepIndicators)) {
    depth = "deep";
    // Specifically check if they want a structured plan
    if (hasAny(["plan", "strategy", "roadmap", "step", "steps", "guide", "build me", "create"])) {
      needsStructuredPlan = true;
    }
  } else if (hasAny(quickIndicators)) {
    depth = "quick";
  }
  
  // OVERRIDE: If user needs education, go deep but in teaching mode
  if (needsEducation) {
    depth = "deep";
    needsStructuredPlan = false; // They need teaching, not a plan yet
  }
  
  // OVERRIDE: If user is frustrated, keep it focused and direct
  if (expressingFrustration || resistingQuestions) {
    // Don't ask questions, just provide value
    needsStructuredPlan = false;
  }
  
  // Override: If the message is very short (<30 chars), probably quick
  if (message.length < 30 && depth === "standard" && !needsEducation && !expressingFrustration) {
    depth = "quick";
  }
  
  // Override: If message contains "?" and is asking for plan/help, go deep
  if (message.includes("?") && hasAny(["plan", "help", "advice", "recommend", "suggest"])) {
    depth = "deep";
  }

  // ============================================
  // AUTO-DETECT CONVERSATION MODE
  // ============================================
  
  let autoDetectedMode: ConversationMode = "default";
  
  // Crisis signals - urgent financial distress
  const crisisSignals = [
    "emergency", "urgent", "asap", "right now", "immediately",
    "can't pay", "cant pay", "behind on", "overdue", "collections",
    "eviction", "foreclosure", "repossession",
    "lost my job", "laid off", "fired", "unemployed",
    "medical bills", "unexpected expense", "car broke",
    "don't know what to do", "desperate", "scared", "panicking",
  ];
  
  // Exploration signals - hypotheticals and curiosity
  const explorationSignals = [
    "what if", "hypothetically", "let's say", "imagine",
    "curious about", "wondering about", "interested in",
    "how would", "what would happen if",
    "just curious", "out of curiosity",
  ];
  
  // Validation signals - checking understanding
  const validationSignals = [
    "am i understanding", "is that right", "is that correct",
    "did i get that", "so basically", "in other words",
    "let me make sure", "just to confirm", "to clarify",
    "does that mean", "so what you're saying",
  ];
  
  // Action signals - ready to take steps
  const actionSignals = [
    "let's do it", "i'm ready", "im ready", "ready to",
    "what's the first step", "where do i start",
    "how do i actually", "practically",
    "set up", "open", "transfer", "pay off", "start",
    "this week", "today", "right now", "asap",
  ];
  
  // Determine auto-detected mode based on signals
  if (hasAny(crisisSignals)) {
    autoDetectedMode = "planning:crisis";
  } else if (hasAny(validationSignals)) {
    autoDetectedMode = "learning:validation";
  } else if (hasAny(explorationSignals)) {
    autoDetectedMode = "learning:exploration";
  } else if (hasAny(actionSignals) && !isConceptual) {
    autoDetectedMode = "planning:action";
  } else if (isConceptual || needsEducation) {
    autoDetectedMode = "learning";
  } else if (needsStructuredPlan || (depth === "deep" && !isConceptual)) {
    autoDetectedMode = "planning";
  }
  // Otherwise stays "default"

  return { 
    domain, 
    task, 
    depth, 
    needsStructuredPlan,
    needsEducation,
    expressingFrustration,
    resistingQuestions,
    autoDetectedMode,
    isConceptual,
  };
}

export const getOrBuildKnowledgeSnippets = internalMutation({
  args: {
    userId: v.string(),
    message: v.string(),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageHash = hashString(args.message.trim().toLowerCase());
    const cached = await ctx.db
      .query("coachKnowledgeCache")
      .withIndex("by_user_message", (q) => q.eq("userId", args.userId).eq("messageHash", messageHash))
      .first();

    if (cached && cached.expiresAt > now) {
      return cached.snippets;
    }

    const chunks = await ctx.db
      .query("coachKnowledge")
      .collect();

    if (!chunks.length) {
      return [];
    }

    const queryEmbedding = embedText(args.message);
    const scored = chunks.map((chunk) => ({
      docId: chunk.docId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    const topK = Math.min(Math.max(args.topK ?? 4, 1), 6);
    const snippets = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter((item) => item.score > 0);

    if (cached) {
      await ctx.db.patch(cached._id, {
        computedAt: now,
        expiresAt: now + KNOWLEDGE_TTL_MS,
        snippets,
      });
    } else {
      await ctx.db.insert("coachKnowledgeCache", {
        userId: args.userId,
        messageHash,
        computedAt: now,
        expiresAt: now + KNOWLEDGE_TTL_MS,
        snippets,
      });
    }

    return snippets;
  },
});

export const getRelevantMemories = internalMutation({
  args: {
    userId: v.string(),
    message: v.string(),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("coachMemory")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(200);

    if (!memories.length) return [];

    const queryEmbedding = embedText(args.message);
    const scored = memories.map((memory) => ({
      type: memory.type,
      content: memory.content,
      confidence: memory.confidence,
      tags: memory.tags,
      score: cosineSimilarity(queryEmbedding, memory.embedding),
    }));

    const topK = Math.min(Math.max(args.topK ?? 6, 1), 12);
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter((item) => item.score > 0);
  },
});

export const getOrBuildContextPacket = internalMutation({
  args: {
    userId: v.string(),
    clientContextHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("coachContextCache")
      .withIndex("by_user_computedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(1);

    const cached = existing[0];
    if (cached && cached.expiresAt > now) {
      const latestEvent = await ctx.db
        .query("coachEvents")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(1);
      const latestEventAt = latestEvent[0]?.createdAt ?? 0;
      if (latestEventAt <= cached.computedAt) {
        const coachState = await ctx.db
          .query("coachState")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .first();
        const optIn = (coachState?.preferences as { transactionDrilldownOptIn?: { enabled?: boolean; expiresAt?: number } } | undefined)
          ?.transactionDrilldownOptIn;
        const optInEnabled = !!optIn?.enabled && (optIn.expiresAt ?? 0) > now;
        const cachedPacket = cached.packet as CoachContextPacket;
        const cachedHasDrilldown = !!cachedPacket.transactionDrilldown && cachedPacket.transactionDrilldown.items.length > 0;
        if (!optInEnabled || cachedHasDrilldown) {
          return { hash: cached.hash, packet: cached.packet as CoachContextPacket };
        }
      }
    }

    const packet = await buildContextPacket(ctx, args.userId);
    const hash = hashContextPacket(packet);
    const payload = {
      hash,
      computedAt: now,
      expiresAt: now + CONTEXT_TTL_MS,
      packet,
    };

    if (cached) {
      await ctx.db.patch(cached._id, payload);
    } else {
      await ctx.db.insert("coachContextCache", {
        userId: args.userId,
        ...payload,
      });
    }

    return { hash, packet };
  },
});

export const upsertSessionState = internalMutation({
  args: {
    userId: v.string(),
    summary: v.optional(v.string()),
    openLoops: v.optional(v.array(v.string())),
    slotLedger: v.optional(v.any()),
    establishedFacts: v.optional(v.array(v.string())),
    frustrationDetectedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("coachSessionState")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary ?? existing.summary,
        openLoops: args.openLoops ?? existing.openLoops,
        slotLedger: args.slotLedger ?? existing.slotLedger,
        establishedFacts: args.establishedFacts ?? existing.establishedFacts,
        frustrationDetectedAt: args.frustrationDetectedAt ?? existing.frustrationDetectedAt,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("coachSessionState", {
      userId: args.userId,
      summary: args.summary,
      openLoops: args.openLoops,
      slotLedger: args.slotLedger,
      establishedFacts: args.establishedFacts,
      frustrationDetectedAt: args.frustrationDetectedAt,
      updatedAt: now,
    });
  },
});

export const upsertCoachMemory = internalMutation({
  args: {
    userId: v.string(),
    memories: v.array(
      v.object({
        type: v.string(),
        content: v.string(),
        confidence: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const memory of args.memories) {
      const contentKey = memory.content.trim();
      if (!contentKey) continue;

      const existing = await ctx.db
        .query("coachMemory")
        .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", memory.type))
        .filter((q) => q.eq(q.field("content"), contentKey))
        .first();

      const payload = {
        userId: args.userId,
        type: memory.type,
        content: contentKey,
        confidence: memory.confidence,
        tags: memory.tags,
        embedding: embedText(contentKey),
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("coachMemory", {
          ...payload,
          createdAt: now,
        });
      }
    }
  },
});

export const storeCoachEvent = internalMutation({
  args: {
    userId: v.string(),
    userMessage: v.string(),
    llmOutput: v.object({
      assistantMessage: v.string(),
      summaryBullets: v.array(v.string()),
      actions: v.array(v.string()),
      openQuestions: v.array(v.string()),
      metricsUsed: v.optional(v.array(v.string())),
    }),
    contextHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("coachEvents", {
      userId: args.userId,
      createdAt: now,
      userMessage: args.userMessage,
      assistantMessage: args.llmOutput.assistantMessage,
      summaryBullets: args.llmOutput.summaryBullets,
      actions: args.llmOutput.actions,
      openQuestions: args.llmOutput.openQuestions,
      metricsUsed: args.llmOutput.metricsUsed ?? [],
      contextHash: args.contextHash,
    });

    const state = await ctx.db
      .query("coachState")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (state) {
      await ctx.db.patch(state._id, { updatedAt: now });
    } else {
      await ctx.db.insert("coachState", {
        userId: args.userId,
        updatedAt: now,
      });
    }
  },
});

export const upsertCoachDraft = internalMutation({
  args: {
    userId: v.string(),
    profileUpdates: v.optional(v.any()),
    foundationUpdates: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("coachDraft")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const profileUpdates = (args.profileUpdates ?? {}) as Record<string, unknown>;
    const foundationUpdates = (args.foundationUpdates ?? {}) as Record<string, unknown>;

    if (existing) {
      const nextProfile = Object.keys(profileUpdates).length
        ? deepMerge((existing.profileDraft ?? {}) as Record<string, unknown>, profileUpdates)
        : existing.profileDraft ?? undefined;
      const nextFoundation = Object.keys(foundationUpdates).length
        ? deepMerge((existing.foundationDraft ?? {}) as Record<string, unknown>, foundationUpdates)
        : existing.foundationDraft ?? undefined;

      await ctx.db.patch(existing._id, {
        profileDraft: nextProfile,
        foundationDraft: nextFoundation,
        updatedAt: now,
      });
      return;
    }

    if (Object.keys(profileUpdates).length === 0 && Object.keys(foundationUpdates).length === 0) {
      return;
    }

    await ctx.db.insert("coachDraft", {
      userId: args.userId,
      profileDraft: Object.keys(profileUpdates).length ? profileUpdates : undefined,
      foundationDraft: Object.keys(foundationUpdates).length ? foundationUpdates : undefined,
      updatedAt: now,
    });
  },
});

export const clearCoachDraftFields = internalMutation({
  args: {
    userId: v.string(),
    clearProfile: v.optional(v.boolean()),
    clearFoundation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coachDraft")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!existing) return;

    const updates: Record<string, unknown> = {};
    if (args.clearProfile) updates.profileDraft = undefined;
    if (args.clearFoundation) updates.foundationDraft = undefined;
    if (Object.keys(updates).length === 0) return;

    await ctx.db.patch(existing._id, updates);
  },
});

export const incrementDailyUsage = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dayKey = formatDayKey(now);

    const userRow = await ctx.db
      .query("llmUsageDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("yyyymmdd", dayKey))
      .first();

    const globalRow = await ctx.db
      .query("llmUsageDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", GLOBAL_USAGE_USER_ID).eq("yyyymmdd", dayKey))
      .first();

    const nextUserCalls = (userRow?.calls ?? 0) + 1;
    const nextGlobalCalls = (globalRow?.calls ?? 0) + 1;

    const decision = evaluateBudget(nextUserCalls, nextGlobalCalls);
    if (!decision.allowed) {
      return {
        allowed: false,
        reason: decision.reason,
        userCalls: userRow?.calls ?? 0,
        globalCalls: globalRow?.calls ?? 0,
      };
    }

    if (userRow) {
      await ctx.db.patch(userRow._id, { calls: nextUserCalls, updatedAt: now });
    } else {
      await ctx.db.insert("llmUsageDaily", {
        userId: args.userId,
        yyyymmdd: dayKey,
        calls: nextUserCalls,
        updatedAt: now,
      });
    }

    if (globalRow) {
      await ctx.db.patch(globalRow._id, { calls: nextGlobalCalls, updatedAt: now });
    } else {
      await ctx.db.insert("llmUsageDaily", {
        userId: GLOBAL_USAGE_USER_ID,
        yyyymmdd: dayKey,
        calls: nextGlobalCalls,
        updatedAt: now,
      });
    }

    return {
      allowed: true,
      userCalls: nextUserCalls,
      globalCalls: nextGlobalCalls,
    };
  },
});
