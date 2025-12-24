import { mutation, query, internalQuery } from "./_generated/server";
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
    // Optional Phase 1+ controls.
    needsReview: v.optional(v.boolean()),
    excludeFromTotals: v.optional(v.boolean()),
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
    const needsReview = args.needsReview ?? !category;

    const excludeFromTotals = args.excludeFromTotals ?? false;

    const insertedId = await ctx.db.insert("entries", {
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
      excludeFromTotals,
      occurredAt: args.date,
      enteredAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Autolink: if any active recurring rule matches this entry and autolinkEnabled is true,
    // link the entry to the best matching rule and update lastMatchedAt.
    try {
      const activeRules = await ctx.db
        .query("recurringRules")
        .withIndex("by_user_active", q => q.eq("userId", userId).eq("active", true))
        .order("desc")
        .take(200);

      const bucketLower = (bucket ?? "").trim().toLowerCase();
      const categoryLower = (category ?? "").trim().toLowerCase();

      let bestRule: any = null;
      let bestScore = 0;

      for (const r of activeRules) {
        if (r.type !== args.type) continue;
        if (!r.autolinkEnabled) continue;

        // Filter by bucket/category if present
        if (r.bucket && (r.bucket ?? "").trim().toLowerCase() !== bucketLower) continue;
        if (r.category && (r.category ?? "").trim().toLowerCase() !== categoryLower) continue;

        // Amount matching
        let amountMatchScore = 0;
        if (r.amountCents !== undefined && r.amountCents !== null) {
          const tol = r.amountTolerancePercent ?? 0;
          const diff = Math.abs(amountCents - r.amountCents);
          const ok = tol > 0 ? diff <= Math.max(1, Math.round((r.amountCents * tol) / 100)) : diff === 0;
          amountMatchScore = ok ? 1 : 0;
        } else if (r.minAmountCents !== undefined || r.maxAmountCents !== undefined) {
          const min = r.minAmountCents ?? -Infinity;
          const max = r.maxAmountCents ?? Infinity;
          amountMatchScore = amountCents >= min && amountCents <= max ? 1 : 0;
        } else {
          // no amount constraint
          amountMatchScore = 1;
        }

        if (!amountMatchScore) continue;

        // Basic scoring: use rule.confidence as primary score
        const score = (r.confidence ?? 0) + (r.autolinkEnabled ? 5 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestRule = r;
        }
      }

      if (bestRule) {
        await ctx.db.patch(insertedId, { recurringRuleId: bestRule._id, updatedAt: Date.now() });
        await ctx.db.patch(bestRule._id, { lastMatchedAt: Date.now(), updatedAt: Date.now() });
      }
    } catch (e) {
      // Do not block insert on autolink failures
      console.error("Autolink error:", e);
    }

    return { ok: true, id: insertedId };
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
    excludeFromTotals: v.optional(v.boolean()),
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
    if (args.date !== undefined) {
      patch.date = args.date;
      // Keep richer timestamp aligned unless you've already started using a different occurredAt.
      patch.occurredAt = args.date;
    }

    if (args.needsReview !== undefined) patch.needsReview = args.needsReview;
    else if (args.category !== undefined) patch.needsReview = !cleanStr(args.category);

    if (args.excludeFromTotals !== undefined) patch.excludeFromTotals = args.excludeFromTotals;

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

    // Inbox is intentionally simple for Phase 1:
    // show anything explicitly marked needsReview.
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

// Public helper to list recent entries across users (used by backfill actions).
export const listRecentEntries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 5000, 100), 5000);
    return await ctx.db.query("entries").order("desc").take(limit);
  },
});

// Internal query used by server actions to fetch entries for a specific user (bypasses auth checks).
export const listEntriesForUser = internalQuery({
  args: {
    userId: v.string(),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 2000, 20), 2000);
    const start = args.startDate ?? 0;
    const end = args.endDate ?? Date.now() + 365 * 24 * 60 * 60 * 1000;

    let rows: any[] = [];
    if (args.type) {
      rows = await ctx.db
        .query("entries")
        .withIndex("by_user_type_date", q =>
          q.eq("userId", args.userId).eq("type", args.type!).gte("date", start).lt("date", end)
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("entries")
        .withIndex("by_user_date", q => q.eq("userId", args.userId).gte("date", start).lt("date", end))
        .order("desc")
        .take(limit);
    }

    return rows;
  },
});
