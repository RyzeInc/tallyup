import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const upsertKnowledgeChunk = internalMutation({
  args: {
    docId: v.string(),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.number()),
    tokenCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coachKnowledge")
      .withIndex("by_doc_chunk", (q) => q.eq("docId", args.docId).eq("chunkIndex", args.chunkIndex))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        embedding: args.embedding,
        tokenCount: args.tokenCount,
        updatedAt: now,
      });
      return { ok: true, updated: true };
    }

    await ctx.db.insert("coachKnowledge", {
      docId: args.docId,
      chunkIndex: args.chunkIndex,
      content: args.content,
      embedding: args.embedding,
      tokenCount: args.tokenCount,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, updated: false };
  },
});

export const removeKnowledgeByDoc = internalMutation({
  args: { docId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("coachKnowledge")
      .withIndex("by_doc_chunk", (q) => q.eq("docId", args.docId).gte("chunkIndex", 0))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { ok: true, removed: rows.length };
  },
});

export const ingestKnowledge = action({
  args: {
    token: v.optional(v.string()),
    docId: v.string(),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        content: v.string(),
        embedding: v.array(v.number()),
        tokenCount: v.number(),
      })
    ),
    replaceExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const expectedToken = process.env.COACH_KNOWLEDGE_INGEST_TOKEN;
    if (expectedToken && args.token !== expectedToken) {
      throw new Error("Invalid ingest token.");
    }

    if (args.replaceExisting) {
      await ctx.runMutation(internal.coachKnowledge.removeKnowledgeByDoc, { docId: args.docId });
    }

    let updated = 0;
    let inserted = 0;
    for (const chunk of args.chunks) {
      const result = await ctx.runMutation(internal.coachKnowledge.upsertKnowledgeChunk, {
        docId: args.docId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        tokenCount: chunk.tokenCount,
      });
      if (result.updated) updated += 1;
      else inserted += 1;
    }

    return { ok: true, updated, inserted, total: args.chunks.length };
  },
});
