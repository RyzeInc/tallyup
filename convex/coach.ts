import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildContextPacket, hashContextPacket, summarizePacket, classifyIntent } from "./coach_internal";
import { getCoachProvider } from "../lib/llm";
import { buildCoachSystemPrompt } from "../lib/llm/prompt";
import type { CoachOutput } from "../lib/llm/schema";
import type { CoachContextPacket } from "../lib/llm/types";
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

export const chat: ReturnType<typeof action> = action({
  args: {
    message: v.string(),
    clientContextHash: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ChatResponse> => {
    const userId = await requireUserId(ctx);

    const contextPacketResult: { hash: string; packet: CoachContextPacket } = await ctx.runMutation(
      internal.coach_internal.getOrBuildContextPacket,
      {
        userId,
        clientContextHash: args.clientContextHash,
      }
    );
    const contextHash = contextPacketResult.hash;
    const packet = contextPacketResult.packet;

    const knowledgeSnippets = await ctx.runMutation(
      internal.coach_internal.getOrBuildKnowledgeSnippets,
      { userId, message: args.message, topK: 4 }
    );
    const memorySnippets = await ctx.runMutation(
      internal.coach_internal.getRelevantMemories,
      { userId, message: args.message, topK: 6 }
    );
    const intent = classifyIntent(args.message);
    const packetWithKnowledge: CoachContextPacket = {
      ...packet,
      knowledgeSnippets,
      memorySnippets,
      intent,
    };

    const { provider, usesExternal, selected } = getCoachProvider();
    
    // Dynamic system prompt based on user's health summary and context depth
    const systemPrompt = buildCoachSystemPrompt({
      healthSummary: packetWithKnowledge.healthSummary,
      contextDepth: packetWithKnowledge.contextDepth,
    });
    
    const rawMode = process.env.COACH_RAW_MODE === "true";
    if (process.env.COACH_DEBUG === "true") {
      console.info(`[coach.chat] provider=${selected} external=${usesExternal} rawMode=${rawMode}`);
    }

    if (usesExternal) {
      const budget = await ctx.runMutation(internal.coach_internal.incrementDailyUsage, { userId });
      if (!budget.allowed) {
        return {
          assistantMessage: "I'm at my daily coaching limit right now. Please try again later today.",
          actions: [],
          followUps: [],
          contextHash,
        };
      }
    }

    let llmOutput: CoachOutput;
    try {
      llmOutput = await provider.generate({
        message: args.message,
        contextPacket: packetWithKnowledge,
        systemPrompt,
      });
    } catch (err) {
      console.error(`[coach.chat] LLM provider error:`, err);
      const fallback = getCoachProvider({ forceMock: true });
      llmOutput = await fallback.provider.generate({
        message: args.message,
        contextPacket: packetWithKnowledge,
        systemPrompt,
      });
    }

    // In raw mode, skip all post-processing and just return the LLM response
    if (rawMode) {
      await ctx.runMutation(internal.coach_internal.storeCoachEvent, {
        userId,
        userMessage: args.message,
        llmOutput: {
          assistantMessage: llmOutput.assistantMessage,
          summaryBullets: llmOutput.summaryBullets ?? [],
          actions: llmOutput.actions ?? [],
          openQuestions: llmOutput.openQuestions ?? [],
          metricsUsed: llmOutput.metricsUsed ?? [],
        },
        contextHash,
      });

      return {
        assistantMessage: llmOutput.assistantMessage,
        actions: llmOutput.actions ?? [],
        followUps: llmOutput.openQuestions ?? [],
        contextHash,
      };
    }

    // Apply anti-loop guards and get updated state
    const guardResult = applyAntiLoopGuards(llmOutput, {
      userMessage: args.message,
      contextPacket: packet,
    });
    llmOutput = guardResult.output;

    await ctx.runMutation(internal.coach_internal.storeCoachEvent, {
      userId,
      userMessage: args.message,
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

    // Always update session state with slot ledger and established facts
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
