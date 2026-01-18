import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { Entry as DetectorEntry, Candidate as DetectorCandidate } from "./detector";
import { v } from "convex/values";
import { getReviewReason, REVIEW_REASONS } from "../lib/constants";
import { internal } from "./_generated/api";
import { normalizeMerchant } from "./merchant";
import { resolveCategoryId } from "./categoryResolver";
import { resolveBudgetCategoryId } from "./budgetMatcher";

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };
type EntryDoc = Doc<"entries">;
type BudgetCategoryId = Id<"budgetCategories">;
type GoalId = Id<"goals">;

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

async function applyGoalDelta(
  ctx: MutationCtx,
  userId: string,
  goalId: GoalId,
  deltaAmountCents: number
) {
  const goal = await ctx.db.get(goalId);
  if (!goal || goal.userId !== userId) return;
  const nextAmount = Math.max(0, goal.currentAmountCents + deltaAmountCents);
  await ctx.db.patch(goalId, {
    currentAmountCents: nextAmount,
    updatedAt: Date.now(),
  });
}

async function getGoalContributionByEntry(
  ctx: MutationCtx,
  entryId: Id<"entries">
) {
  return await ctx.db
    .query("goalContributions")
    .withIndex("by_entry", (q) => q.eq("entryId", entryId))
    .first();
}

// Helper to get effective category from entry (handles migration from bucket)
function getEffectiveCategory(entry: Pick<EntryDoc, "category" | "bucket">): string | undefined {
  return entry.category ?? entry.bucket;
}

/**
 * Update account balance for manual (non-Plaid-linked) accounts.
 * 
 * For manual accounts, we adjust the latest snapshot balance when entries are
 * added, updated, or deleted. Plaid-linked accounts are skipped since they get
 * authoritative balances from Plaid sync.
 * 
 * @param deltaAmountCents - Positive for inflows (income), negative for outflows (expense)
 */
async function adjustManualAccountBalance(
  ctx: MutationCtx,
  userId: string,
  accountId: Id<"accounts"> | undefined,
  deltaAmountCents: number
) {
  if (!accountId || deltaAmountCents === 0) return;

  const account = await ctx.db.get(accountId);
  if (!account || account.userId !== userId) return;

  // Skip Plaid-linked accounts - they get authoritative balances from Plaid
  if (account.isLinked) return;

  const now = Date.now();

  // Get the latest snapshot for this account
  const latestSnapshots = await ctx.db
    .query("accountSnapshots")
    .withIndex("by_account_asOf", (q) => q.eq("accountId", accountId))
    .order("desc")
    .take(1);

  const latestSnapshot = latestSnapshots[0];

  if (latestSnapshot) {
    // Update the existing snapshot's balance
    const newBalance = latestSnapshot.balance + deltaAmountCents;
    await ctx.db.patch(latestSnapshot._id, { balance: newBalance });
  } else {
    // No snapshot exists, create one with the delta as the starting balance
    // This handles edge cases where an account was created without an initial balance
    await ctx.db.insert("accountSnapshots", {
      userId,
      accountId,
      asOf: now,
      balance: deltaAmountCents,
      createdAt: now,
    });
  }
}

/**
 * Calculate the balance delta for an entry.
 * Income increases balance, expenses decrease it.
 * Transfers are excluded from balance calculations.
 */
function getEntryBalanceDelta(
  type: "expense" | "income" | "transfer",
  amountCents: number,
  excludeFromTotals?: boolean
): number {
  // Don't affect balance if excluded from totals or is a transfer
  if (excludeFromTotals || type === "transfer") return 0;
  
  // Income adds to balance, expense subtracts
  return type === "income" ? amountCents : -amountCents;
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
    categoryId: v.optional(v.id("categories")),
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    merchant: v.optional(v.string()),
    title: v.optional(v.string()),
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

    let categoryFromId: string | undefined;
    let categoryIdInput: Id<"categories"> | undefined;
    if (args.categoryId) {
      const found = await ctx.db.get(args.categoryId);
      if (found && found.userId === userId) {
        categoryFromId = found.name;
        categoryIdInput = found._id;
      }
    }

    // Accept either category or bucket, prefer category
    const categoryValue = categoryFromId ?? cleanStr(args.category) ?? cleanStr(args.bucket);
    const category = categoryValue;
    const bucket = categoryValue ? (cleanStr(args.bucket) ?? categoryValue) : cleanStr(args.bucket);
    const categoryId = await resolveCategoryId(
      ctx,
      userId,
      category,
      args.type === "income" ? "income" : "expense",
      { createIfMissing: false }
    );

    const amountCents = Math.round(args.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error("Amount must be greater than 0.");
    }

    const note = cleanStr(args.note);
    const title = cleanStr(args.title);
    const merchant = cleanStr(args.merchant);
    const methodOrAccount = cleanStr(args.methodOrAccount);
    const merchantNormalized = normalizeMerchant(merchant);
    const tags = cleanTags(args.tags);
    const contextTags = cleanTags(args.contextTags);
    const intentTags = cleanTags(args.intentTags);
    const budgetCategoryId =
      args.budgetCategoryId ??
      (await resolveBudgetCategoryId(ctx, userId, {
        category,
        merchant,
        tags,
      }));

    const now = Date.now();
    const reviewReason = getReviewReason({
      category,
      contextTags,
      intentTags,
      amountCents,
      methodOrAccount,
    });
    const missingCanonicalCategory = !!category && !(categoryIdInput ?? categoryId);
    const effectiveReviewReason = missingCanonicalCategory ? REVIEW_REASONS.NEEDS_CATEGORY : reviewReason;
    const needsReview = args.needsReview ?? !!effectiveReviewReason;
    const transactionType = args.type === "income" ? "RECEIVED" : "SPENT";

    const excludeFromTotals = args.excludeFromTotals ?? false;

    const insertedId = await ctx.db.insert("entries", {
      userId,
      type: args.type,
      transactionType,
      bucket,
      category,
      categoryId: categoryIdInput ?? categoryId,
      tags,
      note,
      title,
      merchant,
      merchantRaw: merchant,
      merchantNormalized,
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
      reviewReason: effectiveReviewReason ?? undefined,
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
      budgetCategoryId,
    });

    if (args.goalId) {
      await applyGoalDelta(ctx, userId, args.goalId, amountCents);
      await ctx.db.insert("goalContributions", {
        userId,
        goalId: args.goalId,
        amountCents,
        date: args.date,
        entryId: insertedId,
        createdAt: now,
      });
    }

    if (shouldAffectBudgets({ type: args.type, excludeFromBudgets: false, excludeFromTotals: excludeFromTotals, status: args.status ?? "posted", entryType: args.entryType })) {
      await enqueueBudgetDirty(ctx, userId, args.date, budgetCategoryId, "entry_created");
    }

    // Update manual account balance if applicable
    const balanceDelta = getEntryBalanceDelta(args.type, amountCents, excludeFromTotals);
    await adjustManualAccountBalance(ctx, userId, args.accountId, balanceDelta);

    // Autolink: delegate to deterministic recurring matcher.
    try {
      await ctx.runMutation(internal.recurring.matchEntryToRecurring, { entryId: insertedId });
    } catch (e) {
      // Do not block insert on autolink failures
      console.error("Autolink error:", e);
    }

    return { ok: true, id: insertedId };
  },
});

// List archived entries for the current user (paginated)
export const listArchivedEntries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 200, 20), 1200);
    const rows = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    return rows.filter((r) => r.isArchived);
  },
});

// Internal: archive all entries for an account and reverse their effect on manual balances
export const archiveEntriesForAccount = internalMutation({
  args: { userId: v.string(), accountId: v.id("accounts"), archivedAt: v.number() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_user_account", (q) => q.eq("userId", args.userId).eq("accountId", args.accountId))
      .collect();
    const now = Date.now();
    let count = 0;
    for (const e of entries) {
      if (e.isArchived) continue;
      // Reverse balance effect for manual accounts
      const delta = getEntryBalanceDelta(e.type, e.amountCents, e.excludeFromTotals);
      await adjustManualAccountBalance(ctx, args.userId, e.accountId, -delta);
      await ctx.db.patch(e._id, { isArchived: true, archivedAt: args.archivedAt, updatedAt: now });
      count += 1;
    }
    return { ok: true, archivedCount: count };
  },
});

// Internal: restore archived entries for an account and reapply their balance effects
export const restoreEntriesForAccount = internalMutation({
  args: { userId: v.string(), accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_user_account", (q) => q.eq("userId", args.userId).eq("accountId", args.accountId))
      .collect();
    const now = Date.now();
    let count = 0;
    for (const e of entries) {
      if (!e.isArchived) continue;
      // Reapply balance effect for manual accounts
      const delta = getEntryBalanceDelta(e.type, e.amountCents, e.excludeFromTotals);
      await adjustManualAccountBalance(ctx, args.userId, e.accountId, delta);
      await ctx.db.patch(e._id, { isArchived: false, archivedAt: undefined, updatedAt: now });
      count += 1;
    }
    return { ok: true, restoredCount: count };
  },
});

// Restore a single archived entry. If its account doesn't exist or is archived, clear accountId and set needsReview.
export const restoreEntry = mutation({
  args: { id: v.id("entries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Entry not found");
    if (!existing.isArchived) return { ok: true, restored: false };
    const now = Date.now();

    // Check account existence
    let accountValid = false;
    if (existing.accountId) {
      const account = await ctx.db.get(existing.accountId);
      if (account && !account.isArchived) accountValid = true;
    }

    const patch: Partial<EntryDoc> = { isArchived: false, archivedAt: undefined, updatedAt: now };
    if (!accountValid) {
      patch.accountId = undefined;
      patch.needsReview = true;
    }

    await ctx.db.patch(args.id, patch);

    // If account is valid, reapply balance effect
    if (accountValid && existing.accountId) {
      const delta = getEntryBalanceDelta(existing.type, existing.amountCents, existing.excludeFromTotals);
      await adjustManualAccountBalance(ctx, userId, existing.accountId, delta);
    }

    return { ok: true, restored: true };
  },
});

// Internal migration: convert existing transfer entries that used category "Transfer In"/"Transfer Out"
// into tagged entries and clear their category so the category can be supplied by the UI later.
export const migrateTransferEntriesToTags = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find all transfer entries with the literal category values
    const all = await ctx.db.query("entries").collect();
    const found = all.filter((r) => r.type === "transfer");
    let count = 0;
    for (const e of found) {
      if (!e.category) continue;
      const c = (e.category || "").toLowerCase();
      if (c === "transfer in" || c === "transfer out") {
        const tags = (e.tags ?? []).slice();
        if (c === "transfer in") tags.push("transfer_in");
        else tags.push("transfer_out");
        const patch: Partial<EntryDoc> = { tags, category: undefined, categoryId: undefined, updatedAt: Date.now() };
        await ctx.db.patch(e._id, patch);
        count += 1;
      }
    }
    return { ok: true, migrated: count };
  },
});

export const updateEntry = mutation({
  args: {
    id: v.id("entries"),
    category: v.optional(v.string()),
    categoryId: v.optional(v.union(v.id("categories"), v.null())),
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    title: v.optional(v.string()),
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

    let categoryTouched = false;
    if (args.category !== undefined) {
      const cat = args.category.trim();
      if (cat) {
        patch.category = cat;
        patch.bucket = args.bucket?.trim() || cat;
        categoryTouched = true;
      }
    }
    if (args.bucket !== undefined && args.category === undefined) {
      patch.bucket = args.bucket.trim();
      categoryTouched = true;
    }
    if (args.categoryId !== undefined) {
      categoryTouched = true;
      if (args.categoryId === null) {
        patch.categoryId = undefined;
      } else {
        const found = await ctx.db.get(args.categoryId);
        if (found && found.userId === userId) {
          patch.categoryId = found._id;
          patch.category = found.name;
          patch.bucket = args.bucket?.trim() || found.name;
        }
      }
    }
    if (args.tags !== undefined) patch.tags = cleanTags(args.tags);
    if (args.note !== undefined) patch.note = cleanStr(args.note);
    if (args.title !== undefined) patch.title = cleanStr(args.title);
    if (args.merchant !== undefined) {
      const nextMerchant = cleanStr(args.merchant);
      patch.merchant = nextMerchant;
      patch.merchantRaw = nextMerchant;
      patch.merchantNormalized = normalizeMerchant(nextMerchant);
    }
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

    if (categoryTouched) {
      const nextCategoryValue = getEffectiveCategory({
        category: patch.category ?? existing.category,
        bucket: patch.bucket ?? existing.bucket,
      });
      patch.categoryId = await resolveCategoryId(
        ctx,
        userId,
        nextCategoryValue,
        existing.type === "income" ? "income" : "expense",
        { createIfMissing: false }
      );
    }

    if (
      args.budgetCategoryId === undefined &&
      existing.budgetCategoryId === undefined &&
      (categoryTouched || args.tags !== undefined || args.merchant !== undefined)
    ) {
      const nextCategoryValue = getEffectiveCategory({
        category: patch.category ?? existing.category,
        bucket: patch.bucket ?? existing.bucket,
      });
      const nextMerchant = patch.merchant ?? existing.merchant;
      const nextTags = patch.tags ?? existing.tags;
      patch.budgetCategoryId = await resolveBudgetCategoryId(ctx, userId, {
        category: nextCategoryValue,
        merchant: nextMerchant,
        tags: nextTags,
      });
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
      const missingCanonicalCategory = !!next.category && !next.categoryId;
      const effectiveReviewReason = missingCanonicalCategory ? REVIEW_REASONS.NEEDS_CATEGORY : reviewReason;
      patch.reviewReason = effectiveReviewReason ?? undefined;
      // Honor explicit needsReview: false from client (user clicked "Resolve")
      // Only auto-compute needsReview if client didn't explicitly set it to false
      if (args.needsReview === false) {
        patch.needsReview = false;
      } else {
        patch.needsReview = !!effectiveReviewReason;
      }
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

    if (existing.goalId || nextEntry.goalId) {
      const contribution = await getGoalContributionByEntry(ctx, args.id);
      const prevGoalId = existing.goalId;
      const nextGoalId = nextEntry.goalId;
      const prevAmount = contribution?.amountCents ?? existing.amountCents;
      const nextAmount = nextEntry.amountCents;

      if (prevGoalId && (!nextGoalId || nextGoalId !== prevGoalId || prevAmount !== nextAmount)) {
        await applyGoalDelta(ctx, userId, prevGoalId, -prevAmount);
      }

      if (nextGoalId) {
        const delta =
          prevGoalId && nextGoalId === prevGoalId ? nextAmount - prevAmount : nextAmount;
        if (delta !== 0) {
          await applyGoalDelta(ctx, userId, nextGoalId, delta);
        }

        if (contribution) {
          await ctx.db.patch(contribution._id, {
            goalId: nextGoalId,
            amountCents: nextAmount,
            date: nextEntry.date,
          });
        } else {
          await ctx.db.insert("goalContributions", {
            userId,
            goalId: nextGoalId,
            amountCents: nextAmount,
            date: nextEntry.date,
            entryId: args.id,
            createdAt: Date.now(),
          });
        }
      } else if (contribution) {
        await ctx.db.delete(contribution._id);
      }
    }

    // Update manual account balances if relevant fields changed
    const balanceRelevantChange =
      existing.amountCents !== nextEntry.amountCents ||
      existing.type !== nextEntry.type ||
      existing.accountId !== nextEntry.accountId ||
      existing.excludeFromTotals !== nextEntry.excludeFromTotals;

    if (balanceRelevantChange) {
      // Calculate old and new balance effects
      const oldDelta = getEntryBalanceDelta(existing.type, existing.amountCents, existing.excludeFromTotals);
      const newDelta = getEntryBalanceDelta(nextEntry.type, nextEntry.amountCents, nextEntry.excludeFromTotals);

      // If the account changed, reverse from old account and apply to new account
      if (existing.accountId !== nextEntry.accountId) {
        // Reverse the old entry's effect on the old account
        if (existing.accountId) {
          await adjustManualAccountBalance(ctx, userId, existing.accountId, -oldDelta);
        }
        // Apply the new entry's effect on the new account
        if (nextEntry.accountId) {
          await adjustManualAccountBalance(ctx, userId, nextEntry.accountId, newDelta);
        }
      } else if (existing.accountId) {
        // Same account, just apply the difference
        const netDelta = newDelta - oldDelta;
        await adjustManualAccountBalance(ctx, userId, existing.accountId, netDelta);
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
    
    // If entry is part of a transfer, delete the paired entry and transfer record too
    if (existing.transferId) {
      const transfer = await ctx.db.get(existing.transferId);
      if (transfer) {
        // Delete both linked entries
        if (transfer.fromEntryId && transfer.fromEntryId !== args.id) {
          const pairedEntry = await ctx.db.get(transfer.fromEntryId);
          if (pairedEntry) {
            // Reverse the paired entry's balance effect
            if (pairedEntry.accountId) {
              const delta = getEntryBalanceDelta(pairedEntry.type, pairedEntry.amountCents, pairedEntry.excludeFromTotals);
              await adjustManualAccountBalance(ctx, userId, pairedEntry.accountId, -delta);
            }
            await ctx.db.delete(transfer.fromEntryId);
          }
        }
        if (transfer.toEntryId && transfer.toEntryId !== args.id) {
          const pairedEntry = await ctx.db.get(transfer.toEntryId);
          if (pairedEntry) {
            // Reverse the paired entry's balance effect
            if (pairedEntry.accountId) {
              const delta = getEntryBalanceDelta(pairedEntry.type, pairedEntry.amountCents, pairedEntry.excludeFromTotals);
              await adjustManualAccountBalance(ctx, userId, pairedEntry.accountId, -delta);
            }
            await ctx.db.delete(transfer.toEntryId);
          }
        }
        // Delete the transfer record
        await ctx.db.delete(transfer._id);
      }
    }
    
    await ctx.db.delete(args.id);

    if (existing.goalId) {
      const contribution = await getGoalContributionByEntry(ctx, args.id);
      const amount = contribution?.amountCents ?? existing.amountCents;
      await applyGoalDelta(ctx, userId, existing.goalId, -amount);
      if (contribution) {
        await ctx.db.delete(contribution._id);
      }
    }

    if (shouldAffectBudgets(existing)) {
      await enqueueBudgetDirty(ctx, userId, existing.date, existing.budgetCategoryId, "entry_deleted");
    }

    // Reverse the entry's effect on manual account balance
    if (existing.accountId) {
      const balanceDelta = getEntryBalanceDelta(existing.type, existing.amountCents, existing.excludeFromTotals);
      await adjustManualAccountBalance(ctx, userId, existing.accountId, -balanceDelta);
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
    const categoryFilters = args.categories?.map((s: string) => s.trim()) ?? [];
    const categoryFilterSet = new Set(categoryFilters.filter(Boolean));
    const categoryFilterLowerSet = new Set(
      categoryFilters.map((s: string) => s.toLowerCase()).filter(Boolean)
    );
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
      if (categoryFilters.length) {
        const categoryId = r.categoryId ? String(r.categoryId) : "";
        const categoryValue = (r.category ?? "").toLowerCase();
        const bucketValue = (r.bucket ?? "").toLowerCase();
        const matchesId = categoryId && categoryFilterSet.has(categoryId);
        const matchesName =
          (!!categoryValue && categoryFilterLowerSet.has(categoryValue)) ||
          (!!bucketValue && categoryFilterLowerSet.has(bucketValue));
        if (!matchesId && !matchesName) continue;
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

// Permanently delete an archived entry (bypasses archive flow)
export const permanentDeleteEntry = mutation({
  args: { id: v.id("entries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Entry not found");
    
    // If entry is linked to a transfer, also delete the paired entry and the transfer
    if (existing.transferId) {
      const transfer = await ctx.db.get(existing.transferId);
      if (transfer) {
        // Delete both linked entries
        if (transfer.fromEntryId && transfer.fromEntryId !== args.id) {
          await ctx.db.delete(transfer.fromEntryId);
        }
        if (transfer.toEntryId && transfer.toEntryId !== args.id) {
          await ctx.db.delete(transfer.toEntryId);
        }
        // Delete the transfer record
        await ctx.db.delete(transfer._id);
      }
    }
    
    // Delete the entry
    await ctx.db.delete(args.id);
    
    return { ok: true };
  },
});
