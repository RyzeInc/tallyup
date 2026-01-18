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
  evaluateBudget,
  formatDayKey,
  GLOBAL_USAGE_USER_ID,
} from "../lib/llm/budgetGuard";
import type { CoachContextPacket } from "../lib/llm/types";
import { cosineSimilarity, embedText } from "../lib/llm/embedding";

const CONTEXT_TTL_MS = 2 * 60 * 1000;
const KNOWLEDGE_TTL_MS = 2 * 60 * 1000;

type Ctx = QueryCtx | MutationCtx;

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

export async function buildContextPacket(ctx: Ctx, userId: string): Promise<CoachContextPacket> {
  const now = new Date();
  const currentMonth: MonthInput = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
  const { start, end } = monthBounds(currentMonth);

  const [cashflow, spendByCategory, upcomingBills, anomalies] = await Promise.all([
    computeMonthlyCashflow(ctx, userId, currentMonth),
    computeSpendByCategory(ctx, userId, currentMonth),
    computeUpcomingBills(ctx, userId, 30),
    computeAnomalies(ctx, userId),
  ]);

  const coachState = await ctx.db
    .query("coachState")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const foundation = await ctx.db
    .query("coachFoundation")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const drilldownOptIn = (coachState?.preferences as { transactionDrilldownOptIn?: { enabled?: boolean; windowDays?: number; expiresAt?: number } } | undefined)
    ?.transactionDrilldownOptIn;
  const optInEnabled = !!drilldownOptIn?.enabled && (drilldownOptIn.expiresAt ?? 0) > Date.now();
  const windowDays = drilldownOptIn?.windowDays ?? 30;
  const drilldownItems = optInEnabled
    ? await computeTransactionDrilldown(ctx, userId, windowDays)
    : [];

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
    recentSummaries,
    recentActions,
    recentOpenQuestions,
    recentConversation: conversation.slice(-8),
    foundationSnapshot: (foundation?.snapshot as CoachContextPacket["foundationSnapshot"]) ?? null,
    transactionDrilldownOptIn: optInEnabled
      ? { enabled: true, windowDays, expiresAt: drilldownOptIn?.expiresAt ?? 0 }
      : { enabled: false, windowDays, expiresAt: drilldownOptIn?.expiresAt ?? 0 },
    transactionDrilldown: optInEnabled ? { windowDays, items: drilldownItems } : null,
  };
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
