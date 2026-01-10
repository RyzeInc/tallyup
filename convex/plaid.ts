/**
 * Plaid Integration - Convex Actions & Mutations
 * 
 * This module provides server-side Plaid integration for TallyUp.
 * It handles:
 * - Link token creation for Plaid Link
 * - Public token exchange for access tokens
 * - Account and transaction syncing
 * - Webhook processing
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// ============================================
// INTERNAL QUERIES (for actions to use)
// ============================================

export const getPlaidItemByItemId = internalQuery({
  args: { itemId: v.string() },
  handler: async (ctx, { itemId }) => {
    return await ctx.db
      .query("plaidItems")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .first();
  },
});

export const getUserPlaidItems = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("plaidItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getPlaidAccountsByItem = internalQuery({
  args: { plaidItemId: v.id("plaidItems") },
  handler: async (ctx, { plaidItemId }) => {
    return await ctx.db
      .query("plaidAccounts")
      .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", plaidItemId))
      .collect();
  },
});

export const getPlaidTransactionById = internalQuery({
  args: { plaidTransactionId: v.string() },
  handler: async (ctx, { plaidTransactionId }) => {
    return await ctx.db
      .query("plaidTransactions")
      .withIndex("by_plaidTransactionId", (q) => q.eq("plaidTransactionId", plaidTransactionId))
      .first();
  },
});

// ============================================
// INTERNAL MUTATIONS (for actions to use)
// ============================================

export const createPlaidItem = internalMutation({
  args: {
    userId: v.string(),
    itemId: v.string(),
    accessToken: v.string(),
    institutionId: v.optional(v.string()),
    institutionName: v.optional(v.string()),
    institutionLogo: v.optional(v.string()),
    institutionColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("plaidItems", {
      userId: args.userId,
      itemId: args.itemId,
      accessToken: args.accessToken,
      institutionId: args.institutionId,
      institutionName: args.institutionName,
      institutionLogo: args.institutionLogo,
      institutionColor: args.institutionColor,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePlaidItemStatus = internalMutation({
  args: {
    id: v.id("plaidItems"),
    status: v.union(
      v.literal("active"),
      v.literal("needs_reauth"),
      v.literal("revoked"),
      v.literal("error")
    ),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

export const updatePlaidItemCursor = internalMutation({
  args: {
    id: v.id("plaidItems"),
    cursor: v.string(),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      transactionCursor: args.cursor,
      lastSyncedAt: args.lastSyncedAt,
      updatedAt: Date.now(),
    });
  },
});

export const createPlaidAccount = internalMutation({
  args: {
    userId: v.string(),
    plaidItemId: v.id("plaidItems"),
    accountId: v.id("accounts"),
    plaidAccountId: v.string(),
    name: v.string(),
    officialName: v.optional(v.string()),
    type: v.string(),
    subtype: v.optional(v.string()),
    mask: v.optional(v.string()),
    balanceCurrent: v.optional(v.number()),
    balanceAvailable: v.optional(v.number()),
    balanceLimit: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("plaidAccounts", {
      userId: args.userId,
      plaidItemId: args.plaidItemId,
      accountId: args.accountId,
      plaidAccountId: args.plaidAccountId,
      name: args.name,
      officialName: args.officialName,
      type: args.type,
      subtype: args.subtype,
      mask: args.mask,
      balanceCurrent: args.balanceCurrent,
      balanceAvailable: args.balanceAvailable,
      balanceLimit: args.balanceLimit,
      currency: args.currency,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePlaidAccountBalances = internalMutation({
  args: {
    id: v.id("plaidAccounts"),
    balanceCurrent: v.optional(v.number()),
    balanceAvailable: v.optional(v.number()),
    balanceLimit: v.optional(v.number()),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      balanceCurrent: args.balanceCurrent,
      balanceAvailable: args.balanceAvailable,
      balanceLimit: args.balanceLimit,
      lastSyncedAt: args.lastSyncedAt,
      updatedAt: Date.now(),
    });
  },
});

export const createTallyUpAccount = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("credit"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("investment"),
      v.literal("loan"),
      v.literal("business"),
      v.literal("other")
    ),
    institutionName: v.optional(v.string()),
    last4: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
    isLinked: v.boolean(),
    plaidAccountId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("accounts", {
      userId: args.userId,
      name: args.name,
      type: args.type,
      institutionName: args.institutionName,
      last4: args.last4,
      creditLimit: args.creditLimit,
      isLinked: args.isLinked,
      plaidAccountId: args.plaidAccountId,
      showInTransactionSelector: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertPlaidTransaction = internalMutation({
  args: {
    userId: v.string(),
    plaidAccountId: v.id("plaidAccounts"),
    plaidTransactionId: v.string(),
    pendingTransactionId: v.optional(v.string()),
    amount: v.number(),
    date: v.string(),
    datetime: v.optional(v.string()),
    name: v.string(),
    merchantName: v.optional(v.string()),
    pending: v.boolean(),
    category: v.optional(v.string()),
    categoryDetailed: v.optional(v.string()),
    categoryConfidence: v.optional(v.string()),
    paymentChannel: v.string(),
    transactionType: v.optional(v.string()),
    locationCity: v.optional(v.string()),
    locationRegion: v.optional(v.string()),
    locationCountry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if transaction already exists
    const existing = await ctx.db
      .query("plaidTransactions")
      .withIndex("by_plaidTransactionId", (q) => 
        q.eq("plaidTransactionId", args.plaidTransactionId)
      )
      .first();
    
    if (existing) {
      // Update existing transaction
      await ctx.db.patch(existing._id, {
        amount: args.amount,
        date: args.date,
        datetime: args.datetime,
        name: args.name,
        merchantName: args.merchantName,
        pending: args.pending,
        category: args.category,
        categoryDetailed: args.categoryDetailed,
        categoryConfidence: args.categoryConfidence,
        paymentChannel: args.paymentChannel,
        transactionType: args.transactionType,
        locationCity: args.locationCity,
        locationRegion: args.locationRegion,
        locationCountry: args.locationCountry,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new transaction
      return await ctx.db.insert("plaidTransactions", {
        userId: args.userId,
        plaidAccountId: args.plaidAccountId,
        plaidTransactionId: args.plaidTransactionId,
        pendingTransactionId: args.pendingTransactionId,
        amount: args.amount,
        date: args.date,
        datetime: args.datetime,
        name: args.name,
        merchantName: args.merchantName,
        pending: args.pending,
        category: args.category,
        categoryDetailed: args.categoryDetailed,
        categoryConfidence: args.categoryConfidence,
        paymentChannel: args.paymentChannel,
        transactionType: args.transactionType,
        locationCity: args.locationCity,
        locationRegion: args.locationRegion,
        locationCountry: args.locationCountry,
        importStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const removePlaidTransaction = internalMutation({
  args: { plaidTransactionId: v.string() },
  handler: async (ctx, { plaidTransactionId }) => {
    const transaction = await ctx.db
      .query("plaidTransactions")
      .withIndex("by_plaidTransactionId", (q) => 
        q.eq("plaidTransactionId", plaidTransactionId)
      )
      .first();
    
    if (transaction) {
      await ctx.db.delete(transaction._id);
    }
  },
});

export const createSyncLog = internalMutation({
  args: {
    userId: v.string(),
    plaidItemId: v.id("plaidItems"),
    syncType: v.union(
      v.literal("initial"),
      v.literal("incremental"),
      v.literal("manual"),
      v.literal("webhook")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("plaidSyncLogs", {
      userId: args.userId,
      plaidItemId: args.plaidItemId,
      syncType: args.syncType,
      status: "started",
      startedAt: Date.now(),
    });
  },
});

export const completeSyncLog = internalMutation({
  args: {
    id: v.id("plaidSyncLogs"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    transactionsAdded: v.optional(v.number()),
    transactionsModified: v.optional(v.number()),
    transactionsRemoved: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      transactionsAdded: args.transactionsAdded,
      transactionsModified: args.transactionsModified,
      transactionsRemoved: args.transactionsRemoved,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
  },
});

// ============================================
// PUBLIC QUERIES
// ============================================

export const listPlaidItems = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    return await ctx.db
      .query("plaidItems")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const listPlaidAccounts = query({
  args: { plaidItemId: v.optional(v.id("plaidItems")) },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    if (plaidItemId) {
      return await ctx.db
        .query("plaidAccounts")
        .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", plaidItemId))
        .collect();
    }
    
    return await ctx.db
      .query("plaidAccounts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const listPendingTransactions = query({
  args: { 
    limit: v.optional(v.number()),
    plaidAccountId: v.optional(v.id("plaidAccounts")),
  },
  handler: async (ctx, { limit, plaidAccountId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const txQuery = ctx.db
      .query("plaidTransactions")
      .withIndex("by_user_importStatus", (q) => 
        q.eq("userId", identity.subject).eq("importStatus", "pending")
      );
    
    let results = await txQuery.collect();
    
    if (plaidAccountId) {
      results = results.filter(t => t.plaidAccountId === plaidAccountId);
    }
    
    if (limit) {
      results = results.slice(0, limit);
    }
    
    return results;
  },
});

export const getPlaidSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const items = await ctx.db
      .query("plaidItems")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    const status = await Promise.all(
      items.map(async (item) => {
        const accounts = await ctx.db
          .query("plaidAccounts")
          .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", item._id))
          .collect();
        
        const pendingTxns = await ctx.db
          .query("plaidTransactions")
          .withIndex("by_user_importStatus", (q) => 
            q.eq("userId", identity.subject).eq("importStatus", "pending")
          )
          .collect();
        
        const itemPendingCount = pendingTxns.filter(t => 
          accounts.some(a => a._id === t.plaidAccountId)
        ).length;
        
        return {
          itemId: item.itemId,
          institutionName: item.institutionName || "Unknown Institution",
          status: item.status,
          lastSyncedAt: item.lastSyncedAt,
          errorMessage: item.errorMessage,
          accountCount: accounts.length,
          pendingTransactions: itemPendingCount,
        };
      })
    );
    
    return status;
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

export const unlinkPlaidItem = mutation({
  args: { plaidItemId: v.id("plaidItems") },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const item = await ctx.db.get(plaidItemId);
    if (!item || item.userId !== identity.subject) {
      throw new Error("Item not found");
    }
    
    // Get all linked accounts
    const plaidAccounts = await ctx.db
      .query("plaidAccounts")
      .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", plaidItemId))
      .collect();
    
    // Update linked TallyUp accounts to unlink them
    for (const plaidAccount of plaidAccounts) {
      await ctx.db.patch(plaidAccount.accountId, {
        isLinked: false,
        plaidAccountId: undefined,
        lastPlaidSync: undefined,
        updatedAt: Date.now(),
      });
      
      // Delete the plaid account record
      await ctx.db.delete(plaidAccount._id);
    }
    
    // Delete sync logs
    const syncLogs = await ctx.db
      .query("plaidSyncLogs")
      .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", plaidItemId))
      .collect();
    
    for (const log of syncLogs) {
      await ctx.db.delete(log._id);
    }
    
    // Delete the item
    await ctx.db.delete(plaidItemId);
    
    return { success: true };
  },
});

export const hideUnhidePlaidAccount = mutation({
  args: {
    plaidAccountId: v.id("plaidAccounts"),
    isHidden: v.boolean(),
  },
  handler: async (ctx, { plaidAccountId, isHidden }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const account = await ctx.db.get(plaidAccountId);
    if (!account || account.userId !== identity.subject) {
      throw new Error("Account not found");
    }
    
    await ctx.db.patch(plaidAccountId, {
      isHidden,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

export const importPlaidTransaction = mutation({
  args: {
    plaidTransactionId: v.id("plaidTransactions"),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    skipImport: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidTxn = await ctx.db.get(args.plaidTransactionId);
    if (!plaidTxn || plaidTxn.userId !== identity.subject) {
      throw new Error("Transaction not found");
    }
    
    if (args.skipImport) {
      await ctx.db.patch(args.plaidTransactionId, {
        importStatus: "skipped",
        skipReason: "user_skipped",
        updatedAt: Date.now(),
      });
      return { success: true, skipped: true };
    }
    
    // Get the Plaid account to find the TallyUp account
    const plaidAccount = await ctx.db.get(plaidTxn.plaidAccountId);
    if (!plaidAccount) {
      throw new Error("Plaid account not found");
    }
    
    // Convert date string to timestamp
    const dateParts = plaidTxn.date.split("-");
    const dateObj = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );
    const dateTs = dateObj.getTime();
    
    // Determine transaction type (Plaid: positive = outflow/expense)
    const isExpense = plaidTxn.amount > 0;
    const amountCents = Math.round(Math.abs(plaidTxn.amount) * 100);
    
    // Create the entry
    const now = Date.now();
    const entryId = await ctx.db.insert("entries", {
      userId: identity.subject,
      type: isExpense ? "expense" : "income",
      category: args.category || plaidTxn.category || "Uncategorized",
      tags: args.tags,
      note: args.note || plaidTxn.name,
      merchant: plaidTxn.merchantName || plaidTxn.name,
      merchantRaw: plaidTxn.name,
      merchantNormalized: plaidTxn.merchantName,
      amountCents,
      status: plaidTxn.pending ? "pending" : "posted",
      date: dateTs,
      occurredAt: plaidTxn.datetime ? new Date(plaidTxn.datetime).getTime() : dateTs,
      enteredAt: now,
      accountId: plaidAccount.accountId,
      needsReview: !args.category,
      createdAt: now,
      updatedAt: now,
    });
    
    // Update the Plaid transaction
    await ctx.db.patch(args.plaidTransactionId, {
      importStatus: "imported",
      entryId,
      importedAt: now,
      updatedAt: now,
    });
    
    return { success: true, entryId };
  },
});

export const bulkImportPlaidTransactions = mutation({
  args: {
    transactionIds: v.array(v.id("plaidTransactions")),
  },
  handler: async (ctx, { transactionIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const txnId of transactionIds) {
      try {
        const plaidTxn = await ctx.db.get(txnId);
        if (!plaidTxn || plaidTxn.userId !== identity.subject) {
          errors.push(`Transaction ${txnId} not found`);
          skipped++;
          continue;
        }
        
        if (plaidTxn.importStatus !== "pending") {
          skipped++;
          continue;
        }
        
        const plaidAccount = await ctx.db.get(plaidTxn.plaidAccountId);
        if (!plaidAccount) {
          errors.push(`Account for ${txnId} not found`);
          skipped++;
          continue;
        }
        
        // Convert date
        const dateParts = plaidTxn.date.split("-");
        const dateObj = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        );
        const dateTs = dateObj.getTime();
        
        const isExpense = plaidTxn.amount > 0;
        const amountCents = Math.round(Math.abs(plaidTxn.amount) * 100);
        
        const now = Date.now();
        const entryId = await ctx.db.insert("entries", {
          userId: identity.subject,
          type: isExpense ? "expense" : "income",
          category: plaidTxn.category || "Uncategorized",
          note: plaidTxn.name,
          merchant: plaidTxn.merchantName || plaidTxn.name,
          merchantRaw: plaidTxn.name,
          merchantNormalized: plaidTxn.merchantName,
          amountCents,
          status: plaidTxn.pending ? "pending" : "posted",
          date: dateTs,
          occurredAt: plaidTxn.datetime ? new Date(plaidTxn.datetime).getTime() : dateTs,
          enteredAt: now,
          accountId: plaidAccount.accountId,
          needsReview: true, // Mark for review
          createdAt: now,
          updatedAt: now,
        });
        
        await ctx.db.patch(txnId, {
          importStatus: "imported",
          entryId,
          importedAt: now,
          updatedAt: now,
        });
        
        imported++;
      } catch (err) {
        errors.push(`Error importing ${txnId}: ${String(err)}`);
        skipped++;
      }
    }
    
    return { imported, skipped, errors };
  },
});
