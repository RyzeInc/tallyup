import { applyEntryCreated, syncEntryBalance, validateEntryLinks } from "./entryEffects";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { resolveCategoryId } from "./categoryResolver";
import type { Id } from "./_generated/dataModel";

// ============================================
// TRANSFERS QUERIES & MUTATIONS
// ============================================

/**
 * List transfers for the current user
 */
export const listTransfers = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const limit = Math.min(Math.max(args.limit ?? 100, 10), 500);
    const start = args.startDate ?? 0;
    const end = args.endDate ?? Date.now() + 365 * 24 * 60 * 60 * 1000;

    const transfers = await ctx.db
      .query("transfers")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", start).lt("date", end)
      )
      .order("desc")
      .take(limit);

    return transfers;
  },
});

/**
 * Get a single transfer by ID
 */
export const getTransfer = query({
  args: { id: v.id("transfers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const transfer = await ctx.db.get(args.id);
    if (!transfer || transfer.userId !== userId) return null;
    return transfer;
  },
});

/**
 * Create a new transfer
 */
export const createTransfer = mutation({
  args: {
    amountCents: v.number(),
    date: v.number(),
    fromAccountId: v.optional(v.id("accounts")),
    toAccountId: v.optional(v.id("accounts")),
    transferType: v.union(
      v.literal("internal"),
      v.literal("external"),
      v.literal("payment"),
      v.literal("investment")
    ),
    note: v.optional(v.string()),
    merchant: v.optional(v.string()),
    title: v.optional(v.string()),
    // Category can be either a Convex ID or a category name/slug string
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const amountCents = Math.round(args.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!Number.isFinite(args.date)) throw new Error("Invalid transfer date");
    if (!args.fromAccountId && !args.toAccountId) throw new Error("Choose at least one transfer account");
    if (args.fromAccountId && args.fromAccountId === args.toAccountId) throw new Error("Choose two different accounts");
    await validateEntryLinks(ctx, userId, { accountId: args.fromAccountId });
    await validateEntryLinks(ctx, userId, { accountId: args.toAccountId });

    const now = Date.now();

    // Resolve category - can be a Convex ID, category name, or slug
    let resolvedCategoryId: Id<"categories"> | undefined;
    let categoryName: string | undefined;
    if (args.category) {
      // Try to get as Convex ID first
      try {
        const byId = await ctx.db.get(args.category as Id<"categories">);
        if (byId && byId.userId === userId) {
          resolvedCategoryId = byId._id;
          categoryName = byId.name;
        }
      } catch {
        // Not a valid Convex ID, try to resolve as name/slug
      }
      
      // If not found by ID, resolve using the category resolver
      if (!resolvedCategoryId) {
        resolvedCategoryId = await resolveCategoryId(
          ctx,
          userId,
          args.category,
          "expense", // transfers use expense-style categories
          { createIfMissing: false }
        );
        if (resolvedCategoryId) {
          const cat = await ctx.db.get(resolvedCategoryId);
          categoryName = cat?.name;
        }
      }
    }

    // Create the transfer record
    const transferId = await ctx.db.insert("transfers", {
      userId,
      amountCents,
      date: args.date,
      fromAccountId: args.fromAccountId,
      toAccountId: args.toAccountId,
      transferType: args.transferType,
      note: args.note?.trim() || undefined,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    // Shared entry fields for both from and to entries
    const merchant = args.merchant?.trim() || undefined;
    const title = args.title?.trim() || undefined;
    const note = args.note?.trim() || undefined;

    // Create linked entries for the transfer (outflow and inflow)
    // This enables the transfer to show up in transaction lists

    // Outflow entry (from account)
    if (args.fromAccountId) {
      const fromEntryId = await ctx.db.insert("entries", {
        userId,
        type: "transfer",
        transactionType: "TRANSFER",
        amountCents,
        date: args.date,
        accountId: args.fromAccountId,
        transferId,
        isTransferSource: true,
        // Category fields - both the ID and name for display
        categoryId: resolvedCategoryId,
        category: categoryName,
        // Propagate merchant/title/note into entries so manual transfers keep their context
        merchant: merchant || note || undefined,
        merchantRaw: merchant || note || undefined,
        title,
        note,
        // Tag the entry as a transfer-out so it can be filtered without using category
        tags: ["transfer_out"],
        excludeFromTotals: true,
        excludeFromBudgets: true,
        ignoredForBudgets: true,
        ignoredForInsights: true,
        excludeFromCashFlow: true,
        needsReview: false,
        reviewReason: undefined,
        createdAt: now,
        updatedAt: now,
      });

      const entry = await ctx.db.get(fromEntryId);
      if (entry) await applyEntryCreated(ctx, entry);
      // Link entry back to transfer
      await ctx.db.patch(transferId, { fromEntryId: fromEntryId });
    }

    // Inflow entry (to account)
    if (args.toAccountId) {
      const toEntryId = await ctx.db.insert("entries", {
        userId,
        type: "transfer",
        transactionType: "TRANSFER",
        amountCents,
        date: args.date,
        accountId: args.toAccountId,
        transferId,
        isTransferSource: false,
        // Category fields - both the ID and name for display
        categoryId: resolvedCategoryId,
        category: categoryName,
        // Propagate merchant/title/note into entries so manual transfers keep their context
        merchant: merchant || note || undefined,
        merchantRaw: merchant || note || undefined,
        title,
        note,
        tags: ["transfer_in"],
        excludeFromTotals: true,
        excludeFromBudgets: true,
        ignoredForBudgets: true,
        ignoredForInsights: true,
        excludeFromCashFlow: true,
        needsReview: false,
        reviewReason: undefined,
        createdAt: now,
        updatedAt: now,
      });

      const entry = await ctx.db.get(toEntryId);
      if (entry) await applyEntryCreated(ctx, entry);
      // Link entry back to transfer
      await ctx.db.patch(transferId, { toEntryId: toEntryId });
    }

    return { ok: true, id: transferId };
  },
});

/**
 * Update transfer status
 */
export const updateTransferStatus = mutation({
  args: {
    id: v.id("transfers"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const transfer = await ctx.db.get(args.id);
    if (!transfer || transfer.userId !== userId) {
      throw new Error("Transfer not found");
    }

    if (transfer.status === args.status) return;
    for (const id of [transfer.fromEntryId, transfer.toEntryId]) {
      if (!id) continue;
      const entry = await ctx.db.get(id);
      if (!entry || entry.userId !== userId) continue;
      const status = args.status === "completed" ? "posted" as const : "pending" as const;
      const isArchived = args.status === "failed" || args.status === "cancelled";
      const next = { ...entry, status, isArchived };
      await syncEntryBalance(ctx, entry, next);
      await ctx.db.patch(id, { status, isArchived, updatedAt: Date.now() });
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark transfer as reconciled
 */
export const reconcileTransfer = mutation({
  args: {
    id: v.id("transfers"),
    reconciled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const transfer = await ctx.db.get(args.id);
    if (!transfer || transfer.userId !== userId) {
      throw new Error("Transfer not found");
    }

    await ctx.db.patch(args.id, {
      reconciled: args.reconciled,
      updatedAt: Date.now(),
    });
  },
});
