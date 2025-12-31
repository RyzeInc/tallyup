import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const amountCents = Math.round(args.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const now = Date.now();

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
        category: "Transfer Out",
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
        category: "Transfer In",
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
