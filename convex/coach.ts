import { v } from "convex/values";
import { action, mutation, query, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildContextPacket, hashContextPacket, summarizePacket, classifyIntent } from "./coach_internal";
import { getCoachProvider } from "../lib/llm";
import { buildCoachSystemPrompt } from "../lib/llm/prompt";
import type { CoachOutput } from "../lib/llm/schema";
import type { CoachContextPacket, ConversationMode } from "../lib/llm/types";
import type { Id } from "./_generated/dataModel";
import { applyAntiLoopGuards } from "../lib/llm/antiLoopGuard";
import { CoachProfileUpdateSchema, type CoachProfileUpdate } from "../lib/coach/profile";
import { CoachFoundationUpdateSchema, type CoachFoundationUpdate } from "../lib/coach/foundation";

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };

async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

export const getSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const cached = await ctx.db
      .query("coachContextCache")
      .withIndex("by_user_computedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    const existing = cached[0];
    if (existing && existing.expiresAt > now) {
      return {
        contextHash: existing.hash,
        snapshot: summarizePacket(existing.packet),
      };
    }

    const packet = await buildContextPacket(ctx, userId);
    const hash = hashContextPacket(packet);
    return {
      contextHash: hash,
      snapshot: summarizePacket(packet),
    };
  },
});

type ChatResponse = {
  assistantMessage: string;
  actions: string[];
  followUps: string[];
  contextHash: string;
  profileUpdates?: CoachProfileUpdate;
  foundationUpdates?: CoachFoundationUpdate;
  transactionDrilldownRequest?: { reason: string; windowDays: number };
};

export type CoachTurnArgs = {
  message: string;
  clientContextHash?: string;
  conversationMode?: ConversationMode;
};

/**
 * Shared by `action` and `httpAction` contexts. Naming it lets the streaming
 * endpoint reuse the orchestration below without introducing a second Convex
 * function boundary (and a second copy of this logic that could drift).
 */
type CoachActionCtx = Pick<ActionCtx, "runMutation">;

export type PreparedTurn = {
  contextHash: string;
  packet: CoachContextPacket;
  packetWithKnowledge: CoachContextPacket;
  systemPrompt: string;
  provider: ReturnType<typeof getCoachProvider>["provider"];
  usesExternal: boolean;
  rawMode: boolean;
  /** Set when the daily budget is exhausted; callers should short-circuit. */
  budgetExceeded: boolean;
};

/** Everything that happens before the model is called. */
export async function prepareCoachTurn(
  ctx: CoachActionCtx,
  userId: string,
  args: CoachTurnArgs
): Promise<PreparedTurn> {
  const contextPacketResult: { hash: string; packet: CoachContextPacket } = await ctx.runMutation(
    internal.coach_internal.getOrBuildContextPacket,
    { userId, clientContextHash: args.clientContextHash }
  );
  const contextHash = contextPacketResult.hash;
  const packet = contextPacketResult.packet;

  const [knowledgeSnippets, memorySnippets] = await Promise.all([
    ctx.runMutation(internal.coach_internal.getOrBuildKnowledgeSnippets, {
      userId,
      message: args.message,
      topK: 4,
    }),
    ctx.runMutation(internal.coach_internal.getRelevantMemories, {
      userId,
      message: args.message,
      topK: 6,
    }),
  ]);

  const intent = classifyIntent(args.message);
  const packetWithKnowledge: CoachContextPacket = {
    ...packet,
    knowledgeSnippets,
    memorySnippets,
    intent,
    conversationMode: args.conversationMode ?? "default",
  };

  const { provider, usesExternal, selected, mockReason } = getCoachProvider();

  const systemPrompt = buildCoachSystemPrompt({
    healthSummary: packetWithKnowledge.healthSummary,
    contextDepth: packetWithKnowledge.contextDepth,
    intent: packetWithKnowledge.intent,
    conversationMode: packetWithKnowledge.conversationMode,
    dataFreshness: packetWithKnowledge.dataFreshness,
  });

  const rawMode = process.env.COACH_RAW_MODE === "true";
  if (process.env.COACH_DEBUG === "true") {
    console.info(
      `[coach] provider=${selected}${mockReason ? ` (mock: ${mockReason})` : ""} external=${usesExternal} rawMode=${rawMode} mode=${packetWithKnowledge.conversationMode}`
    );
  }

  let budgetExceeded = false;
  if (usesExternal) {
    const budget = await ctx.runMutation(internal.coach_internal.incrementDailyUsage, { userId });
    budgetExceeded = !budget.allowed;
  }

  return {
    contextHash,
    packet,
    packetWithKnowledge,
    systemPrompt,
    provider,
    usesExternal,
    rawMode,
    budgetExceeded,
  };
}

export const BUDGET_EXCEEDED_MESSAGE =
  "I'm at my daily coaching limit right now. Please try again later today.";

/** Everything that happens after the model returns. */
export async function finalizeCoachTurn(
  ctx: CoachActionCtx,
  userId: string,
  userMessage: string,
  prepared: PreparedTurn,
  output: CoachOutput
): Promise<ChatResponse> {
  const { contextHash, packet, rawMode } = prepared;

  // In raw mode, skip all post-processing and just persist the response.
  if (rawMode) {
    await ctx.runMutation(internal.coach_internal.storeCoachEvent, {
      userId,
      userMessage,
      llmOutput: {
        assistantMessage: output.assistantMessage,
        summaryBullets: output.summaryBullets ?? [],
        actions: output.actions ?? [],
        openQuestions: output.openQuestions ?? [],
        metricsUsed: output.metricsUsed ?? [],
      },
      contextHash,
    });

    return {
      assistantMessage: output.assistantMessage,
      actions: output.actions ?? [],
      followUps: output.openQuestions ?? [],
      contextHash,
    };
  }

  const guardResult = applyAntiLoopGuards(output, { userMessage, contextPacket: packet });
  const llmOutput = guardResult.output;

  await ctx.runMutation(internal.coach_internal.storeCoachEvent, {
    userId,
    userMessage,
    llmOutput: {
      assistantMessage: llmOutput.assistantMessage,
      summaryBullets: llmOutput.summaryBullets,
      actions: llmOutput.actions,
      openQuestions: llmOutput.openQuestions,
      metricsUsed: llmOutput.metricsUsed,
    },
    contextHash,
  });

  const fallbackSummary = llmOutput.summaryBullets.length
    ? llmOutput.summaryBullets.join(" ")
    : undefined;
  const fallbackOpenLoops = llmOutput.openQuestions.length ? llmOutput.openQuestions : undefined;

  await ctx.runMutation(internal.coach_internal.upsertSessionState, {
    userId,
    summary: llmOutput.memoryDelta?.summary ?? fallbackSummary,
    openLoops: llmOutput.memoryDelta?.openLoops ?? fallbackOpenLoops,
    slotLedger: guardResult.slotLedger,
    establishedFacts: guardResult.establishedFacts,
    frustrationDetectedAt: guardResult.frustrationDetectedAt ?? undefined,
  });

  if (llmOutput.memoryUpdates && llmOutput.memoryUpdates.length > 0) {
    await ctx.runMutation(internal.coach_internal.upsertCoachMemory, {
      userId,
      memories: llmOutput.memoryUpdates,
    });
  }

  if (llmOutput.profileUpdates || llmOutput.foundationUpdates) {
    await ctx.runMutation(internal.coach_internal.upsertCoachDraft, {
      userId,
      profileUpdates: llmOutput.profileUpdates ?? undefined,
      foundationUpdates: llmOutput.foundationUpdates ?? undefined,
    });
  }

  return {
    assistantMessage: llmOutput.assistantMessage,
    actions: llmOutput.actions,
    followUps: llmOutput.openQuestions,
    contextHash,
    profileUpdates: llmOutput.profileUpdates,
    foundationUpdates: llmOutput.foundationUpdates,
    transactionDrilldownRequest: llmOutput.transactionDrilldownRequest,
  };
}

export const chat: ReturnType<typeof action> = action({
  args: {
    message: v.string(),
    clientContextHash: v.optional(v.string()),
    /** User-selected conversation mode (optional - defaults to auto-detect) */
    conversationMode: v.optional(v.union(
      v.literal("default"),
      v.literal("learning"),
      v.literal("learning:exploration"),
      v.literal("learning:validation"),
      v.literal("planning"),
      v.literal("planning:action"),
      v.literal("planning:crisis")
    )),
  },
  handler: async (ctx, args): Promise<ChatResponse> => {
    const userId = await requireUserId(ctx);
    const prepared = await prepareCoachTurn(ctx, userId, args);

    if (prepared.budgetExceeded) {
      return {
        assistantMessage: BUDGET_EXCEEDED_MESSAGE,
        actions: [],
        followUps: [],
        contextHash: prepared.contextHash,
      };
    }

    let llmOutput: CoachOutput;
    try {
      llmOutput = await prepared.provider.generate({
        message: args.message,
        contextPacket: prepared.packetWithKnowledge,
        systemPrompt: prepared.systemPrompt,
      });
    } catch (err) {
      console.error(`[coach.chat] LLM provider error:`, err);
      const fallback = getCoachProvider({ forceMock: true });
      llmOutput = await fallback.provider.generate({
        message: args.message,
        contextPacket: prepared.packetWithKnowledge,
        systemPrompt: prepared.systemPrompt,
      });
    }

    return finalizeCoachTurn(ctx, userId, args.message, prepared, llmOutput);
  },
});

export const updateCoachState = mutation({
  args: { update: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const parsed = CoachProfileUpdateSchema.safeParse(args.update);
    if (!parsed.success) {
      throw new Error("Invalid coach profile update.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("coachState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const currentPrefs = (existing?.preferences ?? {}) as Record<string, unknown>;
    const nextPrefs = { ...currentPrefs, ...parsed.data };

    if (existing) {
      await ctx.db.patch(existing._id, { preferences: nextPrefs, updatedAt: now });
      await ctx.runMutation(internal.coach_internal.clearCoachDraftFields, {
        userId,
        clearProfile: true,
      });
      return { ok: true };
    }

    await ctx.db.insert("coachState", {
      userId,
      preferences: nextPrefs,
      updatedAt: now,
    });

    await ctx.runMutation(internal.coach_internal.clearCoachDraftFields, {
      userId,
      clearProfile: true,
    });

    return { ok: true };
  },
});

export const updateCoachFoundation = mutation({
  args: { update: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const parsed = CoachFoundationUpdateSchema.safeParse(args.update);
    if (!parsed.success) {
      throw new Error("Invalid coach foundation update.");
    }

    const deepMerge = (
      base: Record<string, unknown>,
      update: Record<string, unknown>
    ): Record<string, unknown> => {
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
    };

    const now = Date.now();
    const existing = await ctx.db
      .query("coachFoundation")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const current = (existing?.snapshot ?? {}) as Record<string, unknown>;
    const nextSnapshot = deepMerge(current, parsed.data as Record<string, unknown>);

    if (existing) {
      await ctx.db.patch(existing._id, { snapshot: nextSnapshot, updatedAt: now });
      await ctx.runMutation(internal.coach_internal.clearCoachDraftFields, {
        userId,
        clearFoundation: true,
      });
      return { ok: true };
    }

    await ctx.db.insert("coachFoundation", {
      userId,
      snapshot: nextSnapshot,
      updatedAt: now,
    });

    await ctx.runMutation(internal.coach_internal.clearCoachDraftFields, {
      userId,
      clearFoundation: true,
    });

    return { ok: true };
  },
});

export const setTransactionDrilldownOptIn = mutation({
  args: {
    windowDays: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const windowDays = Math.min(Math.max(args.windowDays ?? 30, 7), 90);
    const enabled = args.enabled ?? true;
    const expiresAt = enabled ? now + 60 * 60 * 1000 : now;

    const existing = await ctx.db
      .query("coachState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const currentPrefs = (existing?.preferences ?? {}) as Record<string, unknown>;
    const nextPrefs = {
      ...currentPrefs,
      transactionDrilldownOptIn: { enabled, windowDays, expiresAt },
    };

    if (existing) {
      await ctx.db.patch(existing._id, { preferences: nextPrefs, updatedAt: now });
      return { ok: true };
    }

    await ctx.db.insert("coachState", {
      userId,
      preferences: nextPrefs,
      updatedAt: now,
    });

    return { ok: true };
  },
});

/**
 * Reset the coach session state, clearing slot ledger and established facts.
 * Useful when the user wants to start fresh or the coach gets stuck in a loop.
 */
export const resetSession = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    // Clear session state (slot ledger, established facts, frustration)
    const sessionState = await ctx.db
      .query("coachSessionState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (sessionState) {
      await ctx.db.patch(sessionState._id, {
        slotLedger: undefined,
        establishedFacts: undefined,
        frustrationDetectedAt: undefined,
        summary: undefined,
        openLoops: undefined,
        updatedAt: now,
      });
    }

    // Clear context cache to force rebuild
    const contextCache = await ctx.db
      .query("coachContextCache")
      .withIndex("by_user_computedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    if (contextCache[0]) {
      await ctx.db.delete(contextCache[0]._id);
    }

    // Clear draft
    const draft = await ctx.db
      .query("coachDraft")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (draft) {
      await ctx.db.patch(draft._id, {
        profileDraft: undefined,
        foundationDraft: undefined,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});

/**
 * List conversation history grouped by session.
 * Returns conversations from coachEvents table.
 */
export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = args.limit ?? 50;

    // Get all coach events for this user, ordered by most recent
    const events = await ctx.db
      .query("coachEvents")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Group events into "conversations" by time gaps (>30 min = new conversation)
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes
    const conversations: Array<{
      id: string;
      startedAt: number;
      lastMessageAt: number;
      messageCount: number;
      summary: string;
      tags: string[];
      events: Array<{
        id: string;
        userMessage?: string;
        assistantMessage?: string;
        createdAt: number;
        summaryBullets: string[];
      }>;
    }> = [];

    let currentConversation: typeof conversations[0] | null = null;

    // Events are in descending order, so iterate normally and check gaps
    for (const event of events) {
      const needsNewConversation = !currentConversation || 
        (currentConversation.events[currentConversation.events.length - 1].createdAt - event.createdAt) > SESSION_GAP_MS;

      if (needsNewConversation) {
        // Start a new conversation
        currentConversation = {
          id: event._id,
          startedAt: event.createdAt,
          lastMessageAt: event.createdAt,
          messageCount: 0,
          summary: "",
          tags: [],
          events: [],
        };
        conversations.push(currentConversation);
      }

      // Add event to current conversation
      currentConversation!.events.push({
        id: event._id,
        userMessage: event.userMessage,
        assistantMessage: event.assistantMessage,
        createdAt: event.createdAt,
        summaryBullets: event.summaryBullets,
      });
      currentConversation!.messageCount++;
      currentConversation!.startedAt = Math.min(currentConversation!.startedAt, event.createdAt);
      
      // Build summary from first user message
      if (event.userMessage && !currentConversation!.summary) {
        currentConversation!.summary = event.userMessage.slice(0, 100);
      }
      
      // Extract tags from summary bullets
      event.summaryBullets.forEach(bullet => {
        const lower = bullet.toLowerCase();
        if (lower.includes("budget") && !currentConversation!.tags.includes("budgeting")) {
          currentConversation!.tags.push("budgeting");
        }
        if ((lower.includes("debt") || lower.includes("loan") || lower.includes("credit")) && 
            !currentConversation!.tags.includes("debt")) {
          currentConversation!.tags.push("debt");
        }
        if ((lower.includes("save") || lower.includes("saving") || lower.includes("emergency")) && 
            !currentConversation!.tags.includes("saving")) {
          currentConversation!.tags.push("saving");
        }
        if ((lower.includes("invest") || lower.includes("stock") || lower.includes("401k")) && 
            !currentConversation!.tags.includes("investing")) {
          currentConversation!.tags.push("investing");
        }
        if ((lower.includes("spend") || lower.includes("expense")) && 
            !currentConversation!.tags.includes("spending")) {
          currentConversation!.tags.push("spending");
        }
      });
    }

    return conversations;
  },
});

/**
 * Get a specific conversation's full message history.
 */
export const getConversation = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    
    // The conversation id is the id of its first coachEvents row.
    const firstEvent = await ctx.db.get(args.conversationId as Id<"coachEvents">);
    if (!firstEvent || firstEvent.userId !== userId) {
      return null;
    }

    const SESSION_GAP_MS = 30 * 60 * 1000;
    
    // Get events around this time to find the full conversation
    const events = await ctx.db
      .query("coachEvents")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();

    // Find the conversation window
    const messages: Array<{
      role: "user" | "assistant";
      content: string;
      createdAt: number;
    }> = [];

    let inConversation = false;
    let lastTime = 0;

    for (const event of events) {
      const gap = lastTime > 0 ? event.createdAt - lastTime : 0;
      
      if (event._id === args.conversationId) {
        inConversation = true;
      }
      
      if (inConversation) {
        // Check if we've moved to a new conversation
        if (gap > SESSION_GAP_MS && messages.length > 0) {
          break;
        }
        
        if (event.userMessage) {
          messages.push({
            role: "user",
            content: event.userMessage,
            createdAt: event.createdAt,
          });
        }
        if (event.assistantMessage) {
          messages.push({
            role: "assistant",
            content: event.assistantMessage,
            createdAt: event.createdAt,
          });
        }
      }
      
      lastTime = event.createdAt;
    }

    return {
      id: args.conversationId,
      messages,
      startedAt: messages[0]?.createdAt,
      lastMessageAt: messages[messages.length - 1]?.createdAt,
    };
  },
});
