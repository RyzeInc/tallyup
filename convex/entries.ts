import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function requireUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

function cleanStr(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t.length ? t : undefined;
}

function cleanTags(tags?: string[]): string[] | undefined {
  if (!tags?.length) return undefined;
  const cleaned = tags.map(t => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of cleaned) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.length ? out : undefined;
}

export const addEntry = mutation({
  args: {
    type: v.union(v.literal("expense"), v.literal("income")),
    bucket: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),
    amountCents: v.number(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const bucket = args.bucket.trim();
    if (!bucket) throw new Error("Bucket is required.");

    const amountCents = Math.round(args.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error("Amount must be greater than 0.");
    }

    const category = cleanStr(args.category);
    const note = cleanStr(args.note);
    const methodOrAccount = cleanStr(args.methodOrAccount);
    const tags = cleanTags(args.tags);

    const now = Date.now();
    const needsReview = !category;

    await ctx.db.insert("entries", {
      userId,
      type: args.type,
      bucket,
      category,
      tags,
      note,
      methodOrAccount,
      amountCents,
      date: args.date,
      needsReview,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const updateEntry = mutation({
  args: {
    id: v.id("entries"),
    bucket: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),
    amountCents: v.optional(v.number()),
    date: v.optional(v.number()),
    needsReview: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");

    const patch: any = { updatedAt: Date.now() };

    if (args.bucket !== undefined) patch.bucket = args.bucket.trim();
    if (args.category !== undefined) patch.category = cleanStr(args.category);
    if (args.tags !== undefined) patch.tags = cleanTags(args.tags);
    if (args.note !== undefined) patch.note = cleanStr(args.note);
    if (args.methodOrAccount !== undefined) patch.methodOrAccount = cleanStr(args.methodOrAccount);

    if (args.amountCents !== undefined) {
      const cents = Math.round(args.amountCents);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("Amount must be > 0");
      patch.amountCents = cents;
    }
    if (args.date !== undefined) patch.date = args.date;

    if (args.needsReview !== undefined) patch.needsReview = args.needsReview;
    else if (args.category !== undefined) patch.needsReview = !cleanStr(args.category);

    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

export const deleteEntry = mutation({
  args: { id: v.id("entries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const listInbox = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 60, 10), 200);

    return await ctx.db
      .query("entries")
      .withIndex("by_user_needsReview_date", q =>
        q.eq("userId", userId).eq("needsReview", true)
      )
      .order("desc")
      .take(limit);
  },
});

export const listEntries = query({
  args: {
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    bucket: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 300, 20), 800);

    const start = args.startDate ?? 0;
    const end = args.endDate ?? Date.now() + 365 * 24 * 60 * 60 * 1000;

    let rows: any[] = [];
    if (args.type) {
      rows = await ctx.db
        .query("entries")
        .withIndex("by_user_type_date", q =>
          q.eq("userId", userId).eq("type", args.type!).gte("date", start).lt("date", end)
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("entries")
        .withIndex("by_user_date", q =>
          q.eq("userId", userId).gte("date", start).lt("date", end)
        )
        .order("desc")
        .take(limit);
    }

    if (args.bucket?.trim()) {
      const b = args.bucket.trim().toLowerCase();
      rows = rows.filter(r => (r.bucket ?? "").toLowerCase() === b);
    }

    return rows;
  },
});

export const listCategories = query({
  args: {
    type: v.union(v.literal("expense"), v.literal("income")),
    bucket: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const rows = await ctx.db
      .query("entries")
      .withIndex("by_user_type_date", q => q.eq("userId", userId).eq("type", args.type))
      .order("desc")
      .take(500);

    const bucketFilter = args.bucket?.trim().toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];

    for (const r of rows) {
      if (bucketFilter && (r.bucket ?? "").toLowerCase() !== bucketFilter) continue;
      const c = (r.category ?? "").trim();
      if (!c) continue;
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
      if (out.length >= 60) break;
    }

    return out;
  },
});

export const listBuckets = query({
  args: { type: v.optional(v.union(v.literal("expense"), v.literal("income"))) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const rows = args.type
      ? await ctx.db
          .query("entries")
          .withIndex("by_user_type_date", q => q.eq("userId", userId).eq("type", args.type!))
          .order("desc")
          .take(800)
      : await ctx.db
          .query("entries")
          .withIndex("by_user_date", q => q.eq("userId", userId))
          .order("desc")
          .take(800);

    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
      const b = (r.bucket ?? "").trim();
      if (!b) continue;
      const k = b.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(b);
      if (out.length >= 30) break;
    }
    return out;
  },
});
