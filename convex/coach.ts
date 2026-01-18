import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildContextPacket, hashContextPacket, summarizePacket } from "./coach_internal";
import { getCoachProvider } from "../lib/llm";
import { buildCoachSystemPrompt } from "../lib/llm/prompt";
import type { CoachOutput } from "../lib/llm/schema";
import type { CoachContextPacket } from "../lib/llm/types";

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

    const { provider, usesExternal } = getCoachProvider();
    const systemPrompt = buildCoachSystemPrompt();

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
        contextPacket: packet,
        systemPrompt,
      });
    } catch {
      const fallback = getCoachProvider({ forceMock: true });
      llmOutput = await fallback.provider.generate({
        message: args.message,
        contextPacket: packet,
        systemPrompt,
      });
    }

    await ctx.runMutation(internal.coach_internal.storeCoachEvent, {
      userId,
      llmOutput,
      contextHash,
    });

    return {
      assistantMessage: llmOutput.assistantMessage,
      actions: llmOutput.actions,
      followUps: llmOutput.openQuestions,
      contextHash,
    };
  },
});
