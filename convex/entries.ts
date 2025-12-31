import { mutation, query, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { Entry as DetectorEntry, Candidate as DetectorCandidate } from "./detector";
import { v } from "convex/values";
import { getReviewReason } from "../lib/constants";

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };
type EntryDoc = Doc<"entries">;
type BudgetCategoryId = Id<"budgetCategories">;
type RecurringRuleDoc = Doc<"recurringRules">;

function isDetectorEntry(entry: EntryDoc): entry is EntryDoc & { type: "expense" | "income" } {
  return entry.type === "expense" || entry.type === "income";
}

async function requireUserId(ctx: AuthCtx): Promise<string> {
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

type BudgetRelevantEntry = Pick<EntryDoc, "type" | "excludeFromBudgets" | "excludeFromTotals" | "status" | "entryType">;

function shouldAffectBudgets(entry: BudgetRelevantEntry): boolean {
  if (entry.type !== "expense") return false;
  if (entry.excludeFromBudgets) return false;
  if (entry.excludeFromTotals) return false;
  if (entry.status && entry.status !== "posted") return false;
  if (entry.entryType && (entry.entryType === "transfer" || entry.entryType === "payment")) return false;
  return true;
}

async function enqueueBudgetDirty(
  ctx: MutationCtx,
  userId: string,
  dirtyDate: number,
  budgetCategoryId: BudgetCategoryId | undefined,
  reason: string
) {
  const now = Date.now();
  await ctx.db.insert("budgetDirtyQueue", {
    userId,
    budgetCategoryId,
    dirtyDate,
    reason,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
}

// Helper to get effective category from entry (handles migration from bucket)
function getEffectiveCategory(entry: Pick<EntryDoc, "category" | "bucket">): string | undefined {
  return entry.category ?? entry.bucket;
}

function resolveBounds(args: { startDate?: number; endDate?: number }): { start: number; end: number } {
  return {
    start: args.startDate ?? 0,
    end: args.endDate ?? Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
}

export const addEntry = mutation({
  args: {
    type: v.union(v.literal("expense"), v.literal("income")),
    category: v.optional(v.string()),
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    merchant: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),
    accountId: v.optional(v.id("accounts")),
    contextTags: v.optional(v.array(v.string())),
    intentTags: v.optional(v.array(v.string())),
    amountCents: v.number(),
    date: v.number(),
    status: v.optional(v.union(v.literal("pending"), v.literal("posted"))),
    entryType: v.optional(v.union(
      v.literal("purchase"),
      v.literal("refund"),
      v.literal("transfer"),
      v.literal("payment"),
      v.literal("income"),
      v.literal("fee")
    )),
    stableId: v.optional(v.string()),
    originalEntryId: v.optional(v.id("entries")),
    splitParts: v.optional(v.array(v.object({
      budgetCategoryId: v.optional(v.id("budgetCategories")),
      amountCents: v.number(),
    }))),
    currency: v.optional(v.string()),
    // Optional Phase 1+ controls.
    needsReview: v.optional(v.boolean()),
    excludeFromTotals: v.optional(v.boolean()),
    // Gig worker fields
    hoursWorked: v.optional(v.number()),
    platformType: v.optional(v.string()),
    // Linking fields
    goalId: v.optional(v.id("goals")),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Accept either category or bucket, prefer category
    const categoryValue = cleanStr(args.category) ?? cleanStr(args.bucket);
    const category = categoryValue;
    const bucket = categoryValue ? (cleanStr(args.bucket) ?? categoryValue) : cleanStr(args.bucket);

    const amountCents = Math.round(args.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error("Amount must be greater than 0.");
    }

    const note = cleanStr(args.note);
    const merchant = cleanStr(args.merchant);
    const methodOrAccount = cleanStr(args.methodOrAccount);
    const tags = cleanTags(args.tags);
    const contextTags = cleanTags(args.contextTags);
    const intentTags = cleanTags(args.intentTags);

    const now = Date.now();
    const reviewReason = getReviewReason({
      category,
      contextTags,
      intentTags,
      amountCents,
      methodOrAccount,
    });
    const needsReview = args.needsReview ?? !!reviewReason;
    const transactionType = args.type === "income" ? "RECEIVED" : "SPENT";

    const excludeFromTotals = args.excludeFromTotals ?? false;

    const insertedId = await ctx.db.insert("entries", {
      userId,
      type: args.type,
      transactionType,
      bucket,
      category,
      tags,
      note,
      merchant,
      methodOrAccount,
      accountId: args.accountId,
      contextTags,
      intentTags,
      amountCents,
      date: args.date,
      status: args.status ?? "posted",
      entryType: args.entryType ?? (args.type === "income" ? "income" : "purchase"),
      stableId: cleanStr(args.stableId),
      originalEntryId: args.originalEntryId,
      splitParts: args.splitParts,
      currency: args.currency,
      needsReview,
      reviewReason: reviewReason ?? undefined,
      excludeFromTotals,
      occurredAt: args.date,
      enteredAt: now,
      createdAt: now,
      updatedAt: now,
      // Gig worker fields
      hoursWorked: args.hoursWorked,
      platformType: args.platformType,
      // Linking fields (stored as strings, validated on read)
      goalId: args.goalId,
      budgetCategoryId: args.budgetCategoryId,
    });

    if (shouldAffectBudgets({ type: args.type, excludeFromBudgets: false, excludeFromTotals: excludeFromTotals, status: args.status ?? "posted", entryType: args.entryType })) {
      await enqueueBudgetDirty(ctx, userId, args.date, args.budgetCategoryId, "entry_created");
    }

    // Autolink: if any active recurring rule matches this entry and autolinkEnabled is true,
    // link the entry to the best matching rule and update lastMatchedAt.
    try {
      const activeRules = await ctx.db
        .query("recurringRules")
        .withIndex("by_user_active", q => q.eq("userId", userId).eq("active", true))
        .order("desc")
        .take(200);

      const categoryLower = (category ?? "").toLowerCase();
      const bucketLower = (bucket ?? "").toLowerCase();

      let bestRule: RecurringRuleDoc | null = null;
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
    category: v.optional(v.string()),
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    merchant: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),
    accountId: v.optional(v.union(v.id("accounts"), v.null())),
    amountCents: v.optional(v.number()),
    date: v.optional(v.number()),
    status: v.optional(v.union(v.literal("pending"), v.literal("posted"))),
    entryType: v.optional(v.union(
      v.literal("purchase"),
      v.literal("refund"),
      v.literal("transfer"),
      v.literal("payment"),
      v.literal("income"),
      v.literal("fee")
    )),
    stableId: v.optional(v.string()),
    originalEntryId: v.optional(v.union(v.id("entries"), v.null())),
    splitParts: v.optional(v.array(v.object({
      budgetCategoryId: v.optional(v.id("budgetCategories")),
      amountCents: v.number(),
    }))),
    currency: v.optional(v.string()),
    needsReview: v.optional(v.boolean()),
    excludeFromTotals: v.optional(v.boolean()),
    // Gig worker fields
    hoursWorked: v.optional(v.number()),
    platformType: v.optional(v.string()),
    // Phase 1: New fields for goals, budgets, context, and intent
    goalId: v.optional(v.union(v.id("goals"), v.null())),
    budgetCategoryId: v.optional(v.union(v.id("budgetCategories"), v.null())),
    contextTags: v.optional(v.array(v.string())),
    intentTags: v.optional(v.array(v.string())),
    recurringRuleId: v.optional(v.union(v.id("recurringRules"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");

    const patch: Partial<EntryDoc> & { updatedAt: number } = { updatedAt: Date.now() };

    if (args.category !== undefined) {
      const cat = args.category.trim();
      if (cat) {
        patch.category = cat;
        patch.bucket = args.bucket?.trim() || cat;
      }
    }
    if (args.bucket !== undefined && args.category === undefined) {
      patch.bucket = args.bucket.trim();
    }
    if (args.tags !== undefined) patch.tags = cleanTags(args.tags);
    if (args.note !== undefined) patch.note = cleanStr(args.note);
    if (args.merchant !== undefined) patch.merchant = cleanStr(args.merchant);
    if (args.methodOrAccount !== undefined) patch.methodOrAccount = cleanStr(args.methodOrAccount);
    if (args.accountId !== undefined) patch.accountId = args.accountId ?? undefined;

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

    if (args.excludeFromTotals !== undefined) patch.excludeFromTotals = args.excludeFromTotals;
    if (args.status !== undefined) patch.status = args.status;
    if (args.entryType !== undefined) patch.entryType = args.entryType;
    if (args.stableId !== undefined) patch.stableId = cleanStr(args.stableId);
    if (args.originalEntryId !== undefined) patch.originalEntryId = args.originalEntryId === null ? undefined : args.originalEntryId;
    if (args.splitParts !== undefined) patch.splitParts = args.splitParts;
    if (args.currency !== undefined) patch.currency = cleanStr(args.currency);

    // Gig worker fields
    if (args.hoursWorked !== undefined) patch.hoursWorked = args.hoursWorked;
    if (args.platformType !== undefined) patch.platformType = args.platformType;

    // Phase 1: Handle goal, budget, context, intent, recurring links
    if (args.goalId !== undefined) {
      patch.goalId = args.goalId === null ? undefined : args.goalId;
    }
    if (args.budgetCategoryId !== undefined) {
      patch.budgetCategoryId = args.budgetCategoryId === null ? undefined : args.budgetCategoryId;
    }
    if (args.contextTags !== undefined) {
      patch.contextTags = args.contextTags.length > 0 ? args.contextTags : undefined;
    }
    if (args.intentTags !== undefined) {
      patch.intentTags = args.intentTags.length > 0 ? args.intentTags : undefined;
    }
    if (args.recurringRuleId !== undefined) {
      patch.recurringRuleId = args.recurringRuleId === null ? undefined : args.recurringRuleId;
    }

    const next = { ...existing, ...patch };
    if (next.type === "transfer") {
      patch.reviewReason = undefined;
      patch.needsReview = false;
      patch.transactionType = "TRANSFER";
    } else {
      const reviewReason = getReviewReason({
        category: next.category,
        contextTags: next.contextTags,
        intentTags: next.intentTags,
        amountCents: next.amountCents,
        methodOrAccount: next.methodOrAccount,
      });
      patch.reviewReason = reviewReason ?? undefined;
      patch.needsReview = !!reviewReason;
      if (!patch.transactionType) {
        patch.transactionType = next.type === "income" ? "RECEIVED" : "SPENT";
      }
    }

    await ctx.db.patch(args.id, patch);

    const nextEntry = {
      ...existing,
      ...patch,
      budgetCategoryId:
        args.budgetCategoryId !== undefined ? (args.budgetCategoryId === null ? undefined : args.budgetCategoryId) : existing.budgetCategoryId,
      date: args.date !== undefined ? args.date : existing.date,
    };

    const budgetRelevantChange =
      existing.date !== nextEntry.date ||
      existing.budgetCategoryId !== nextEntry.budgetCategoryId ||
      existing.amountCents !== nextEntry.amountCents ||
      existing.excludeFromBudgets !== nextEntry.excludeFromBudgets ||
      existing.excludeFromTotals !== nextEntry.excludeFromTotals ||
      existing.type !== nextEntry.type ||
      existing.status !== nextEntry.status ||
      existing.entryType !== nextEntry.entryType ||
      existing.splitParts !== nextEntry.splitParts;

    if (budgetRelevantChange) {
      if (shouldAffectBudgets(existing)) {
        await enqueueBudgetDirty(ctx, userId, existing.date, existing.budgetCategoryId, "entry_updated_old");
      }
      if (shouldAffectBudgets(nextEntry)) {
        await enqueueBudgetDirty(ctx, userId, nextEntry.date, nextEntry.budgetCategoryId, "entry_updated_new");
      }
    }
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

    if (shouldAffectBudgets(existing)) {
      await enqueueBudgetDirty(ctx, userId, existing.date, existing.budgetCategoryId, "entry_deleted");
    }
    return { ok: true };
  },
});

export const bulkMarkReviewed = mutation({
  args: { ids: v.array(v.id("entries")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const ops: Array<Promise<unknown>> = [];
    for (const id of args.ids) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== userId) continue;
      ops.push(ctx.db.patch(id, { needsReview: false, updatedAt: Date.now() }));
    }
    await Promise.all(ops);
    return { ok: true, count: ops.length };
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

    const { start, end } = resolveBounds(args);

    let rows: EntryDoc[] = [];
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
      rows = rows.filter(r => {
        const effectiveCategory = getEffectiveCategory(r);
        return effectiveCategory?.toLowerCase() === b || (r.bucket ?? "").toLowerCase() === b;
      });
    }

    return rows;
  },
});

export const listEntriesPaged = query({
  args: {
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    buckets: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    needsReview: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    // cursor is the last date seen (ms since epoch). When provided, fetch rows with date < cursor
    cursorDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 60, 10), 200);

    const { start, end } = resolveBounds(args);

    const useTypeIndex = !!args.type;
    const cursorDate = args.cursorDate;

    const takeFactor = 3; // heuristic: fetch extra to account for server-side filters
    const take = limit * takeFactor;

    let fetched: EntryDoc[] = [];

    if (useTypeIndex) {
      const upper = cursorDate !== undefined ? Math.min(cursorDate, end) : end;
      const q = ctx.db
        .query("entries")
        .withIndex("by_user_type_date", (idx) =>
          idx.eq("userId", userId).eq("type", args.type!).gte("date", start).lt("date", upper)
        )
        .order("desc")
        .take(take);
      fetched = await q;
    } else {
      const upper = cursorDate !== undefined ? Math.min(cursorDate, end) : end;
      const q = ctx.db
        .query("entries")
        .withIndex("by_user_date", (idx) =>
          idx.eq("userId", userId).gte("date", start).lt("date", upper)
        )
        .order("desc")
        .take(take);
      fetched = await q;
    }

    // server-side filtering for fields that can't be indexed
    const bucketsSet = args.buckets?.map((s: string) => s.trim().toLowerCase());
    const categoriesSet = args.categories?.map((s: string) => s.trim().toLowerCase());
    const tagsSet = args.tags?.map((s: string) => s.trim().toLowerCase());
    const search = args.search?.trim().toLowerCase();

    const out: EntryDoc[] = [];
    for (const r of fetched) {
      if (args.needsReview !== undefined && r.needsReview !== args.needsReview) continue;
      if (bucketsSet && bucketsSet.length) {
        if (!r.bucket) continue;
        const b = (r.bucket ?? "").toLowerCase();
        if (!bucketsSet.includes(b)) continue;
      }
      if (categoriesSet && categoriesSet.length) {
        const c = (r.category ?? "").toLowerCase();
        if (!categoriesSet.includes(c)) continue;
      }
      if (tagsSet && tagsSet.length) {
        const rs = [
          ...(r.tags ?? []),
          ...(r.contextTags ?? []),
          ...(r.intentTags ?? []),
        ].map((t: string) => (t ?? "").toLowerCase());
        let ok = false;
        for (const t of tagsSet) if (rs.includes(t)) { ok = true; break; }
        if (!ok) continue;
      }
      if (search) {
        const hay = (
          (r.note ?? "") +
          " " +
          (r.merchant ?? "") +
          " " +
          (r.category ?? "") +
          " " +
          (r.methodOrAccount ?? "") +
          " " +
          (r.tags ?? []).join(" ") +
          " " +
          (r.contextTags ?? []).join(" ") +
          " " +
          (r.intentTags ?? []).join(" ")
        ).toLowerCase();
        if (!hay.includes(search)) continue;
      }
      out.push(r);
      if (out.length >= limit) break;
    }

    const nextCursor = out.length ? out[out.length - 1].date : undefined;

    return { rows: out, nextCursor };
  },
});

export const listCategories = query({
  args: {
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    bucket: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // If a type is provided, use the type index for efficiency. Otherwise fall back to the date index.
    let rows: EntryDoc[] = [];
    if (args.type) {
      rows = await ctx.db
        .query("entries")
        .withIndex("by_user_type_date", (idx) => idx.eq("userId", userId).eq("type", args.type!))
        .order("desc")
        .take(500);
    } else {
      rows = await ctx.db
        .query("entries")
        .withIndex("by_user_date", q => q.eq("userId", userId))
        .order("desc")
        .take(500);
    }

    const bucketFilter = args.bucket?.trim().toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];

    for (const r of rows) {
      // Filter by bucket if specified (check both bucket and category for match)
      if (bucketFilter) {
        const effectiveCategory = getEffectiveCategory(r);
        const matchesBucket = effectiveCategory?.toLowerCase() === bucketFilter || (r.bucket ?? "").toLowerCase() === bucketFilter;
        if (!matchesBucket) continue;
      }
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
      // Use category if present, fallback to bucket for legacy data
      const effectiveCategory = getEffectiveCategory(r);
      if (!effectiveCategory) continue;
      const k = effectiveCategory.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(effectiveCategory);
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

export const entrySuggestions = query({
  args: { id: v.id("entries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== userId) throw new Error("Not found");

    const text = ((entry.note ?? "") + " " + (entry.methodOrAccount ?? "") + " " + (entry.bucket ?? "") + " " + (entry.category ?? "")).toLowerCase();

    const suggestions: Array<{
      kind: "tag" | "category" | "rule";
      value: string | DetectorCandidate;
      reason: string;
      confidence: number;
    }> = [];

    // commodity merchant heuristics
    const subs = ["netflix", "spotify", "hulu", "disney", "apple", "amazon prime", "prime video", "youtube premium"];
    for (const s of subs) {
      if (text.includes(s)) {
        suggestions.push({ kind: "tag", value: "Subscription", reason: `note contains ${s}`, confidence: 70 });
        suggestions.push({ kind: "category", value: "Subscription", reason: `note contains ${s}`, confidence: 70 });
        break;
      }
    }

    // candidate recurring detection: fetch recent entries for user in the last year
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const rows = await ctx.db.query("entries").withIndex("by_user_date", q => q.eq("userId", userId).gte("date", cutoff)).order("desc").take(2000);

    // Convert rows to detector.Entry
    const recent: DetectorEntry[] = rows
      .filter(isDetectorEntry)
      .map((r) => ({
        _id: r._id,
        date: r.date,
        amountCents: r.amountCents,
        type: r.type,
        bucket: r.bucket,
        category: r.category,
        tags: r.tags,
      }));

    try {
      const det = await import("./detector");
      const candidates = det.detectRecurringCandidatesFromEntries(recent);
      for (const c of candidates) {
        // if this entry is part of the candidate examples, suggest creating a rule
        if ((c.exampleEntryIds || []).includes(args.id)) {
          suggestions.push({ kind: "rule", value: c, reason: "Repeating pattern detected", confidence: c.confidence ?? 50 });
        }
      }
    } catch {
      // ignore detector errors
    }

    return suggestions;
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

    let rows: EntryDoc[] = [];
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
