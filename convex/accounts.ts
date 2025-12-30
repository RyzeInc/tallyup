import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// ACCOUNTS QUERIES & MUTATIONS
// ============================================

/**
 * List all accounts for the current user
 */
export const listAccounts = query({
  args: {
    includeHidden: v.optional(v.boolean()),
    includeClosed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by status
    if (!args.includeHidden) {
      accounts = accounts.filter((a) => a.status !== "hidden");
    }
    if (!args.includeClosed) {
      accounts = accounts.filter((a) => a.status !== "closed");
    }

    // Sort by display order, then name
    return accounts.sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Get a single account by ID
 */
export const getAccount = query({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) return null;
    return account;
  },
});

/**
 * Create a new account
 */
export const createAccount = mutation({
  args: {
    name: v.string(),
    accountType: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("credit_card"),
      v.literal("investment"),
      v.literal("loan"),
      v.literal("cash"),
      v.literal("manual")
    ),
    institution: v.optional(v.string()),
    balanceCurrentCents: v.optional(v.number()),
    balanceAvailableCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    ownership: v.optional(v.union(v.literal("personal"), v.literal("shared"), v.literal("business"))),
    creditLimitCents: v.optional(v.number()),
    interestRatePercent: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const now = Date.now();
    return await ctx.db.insert("accounts", {
      userId,
      name: args.name,
      accountType: args.accountType,
      institution: args.institution,
      balanceCurrentCents: args.balanceCurrentCents,
      balanceAvailableCents: args.balanceAvailableCents,
      balanceAsOf: args.balanceCurrentCents !== undefined ? now : undefined,
      currency: args.currency ?? "USD",
      ownership: args.ownership ?? "personal",
      status: "active",
      creditLimitCents: args.creditLimitCents,
      interestRatePercent: args.interestRatePercent,
      icon: args.icon,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an account
 */
export const updateAccount = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    institution: v.optional(v.string()),
    balanceCurrentCents: v.optional(v.number()),
    balanceAvailableCents: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("hidden"), v.literal("closed"))),
    ownership: v.optional(v.union(v.literal("personal"), v.literal("shared"), v.literal("business"))),
    creditLimitCents: v.optional(v.number()),
    interestRatePercent: v.optional(v.number()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
    excludeFromNetWorth: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }

    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }

    // Update balance timestamp if balance changed
    if (updates.balanceCurrentCents !== undefined || updates.balanceAvailableCents !== undefined) {
      filtered.balanceAsOf = Date.now();
    }

    filtered.updatedAt = Date.now();

    await ctx.db.patch(id, filtered);
  },
});

/**
 * Get total balances across all accounts
 */
export const getAccountSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeAccounts = accounts.filter((a) => a.status === "active" && !a.excludeFromNetWorth);

    let totalAssetsCents = 0;
    let totalLiabilitiesCents = 0;

    for (const acc of activeAccounts) {
      const balance = acc.balanceCurrentCents ?? 0;
      if (acc.accountType === "credit_card" || acc.accountType === "loan") {
        totalLiabilitiesCents += Math.abs(balance);
      } else {
        totalAssetsCents += balance;
      }
    }

    return {
      totalAssetsCents,
      totalLiabilitiesCents,
      netWorthCents: totalAssetsCents - totalLiabilitiesCents,
      accountCount: activeAccounts.length,
    };
  },
});
