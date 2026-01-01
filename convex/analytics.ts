import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

async function requireUserId(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

export const logEvent = mutation({
  args: {
    event: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ctx.db.insert("analyticsEvents", {
      userId,
      event: args.event,
      data: args.data ?? {},
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
