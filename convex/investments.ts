import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// INVESTMENTS QUERIES & MUTATIONS
// ============================================

/**
 * List all investments for the current user
 */
export const listInvestments = query({
  args: {
    accountId: v.optional(v.id("accounts")),
    assetType: v.optional(v.union(
      v.literal("stock"),
      v.literal("etf"),
      v.literal("mutual_fund"),
      v.literal("bond"),
      v.literal("crypto"),
      v.literal("cash"),
      v.literal("real_estate"),
      v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by account
    if (args.accountId) {
      investments = investments.filter((i) => i.accountId === args.accountId);
    }

    // Filter by asset type
    if (args.assetType) {
      investments = investments.filter((i) => i.assetType === args.assetType);
    }

    // Sort by current value (descending)
    return investments.sort((a, b) => {
      const valA = a.currentValueCents ?? 0;
      const valB = b.currentValueCents ?? 0;
      return valB - valA;
    });
  },
});

/**
 * Get a single investment by ID
 */
export const getInvestment = query({
  args: { id: v.id("investments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const investment = await ctx.db.get(args.id);
    if (!investment || investment.userId !== userId) return null;
    return investment;
  },
});

/**
 * Create a new investment holding
 */
export const createInvestment = mutation({
  args: {
    accountId: v.optional(v.id("accounts")),
    symbol: v.optional(v.string()),
    name: v.string(),
    assetType: v.union(
      v.literal("stock"),
      v.literal("etf"),
      v.literal("mutual_fund"),
      v.literal("bond"),
      v.literal("crypto"),
      v.literal("cash"),
      v.literal("real_estate"),
      v.literal("other")
    ),
    quantity: v.number(),
    costBasisCents: v.number(),
    currentPriceCents: v.optional(v.number()),
    purchaseDate: v.optional(v.number()),
    purchasePriceCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Calculate current value if price provided
    const currentValueCents = args.currentPriceCents
      ? Math.round(args.quantity * args.currentPriceCents)
      : undefined;

    // Calculate unrealized gain
    const unrealizedGainCents = currentValueCents !== undefined
      ? currentValueCents - args.costBasisCents
      : undefined;

    const now = Date.now();
    return await ctx.db.insert("investments", {
      userId,
      accountId: args.accountId,
      symbol: args.symbol?.toUpperCase(),
      name: args.name,
      assetType: args.assetType,
      quantity: args.quantity,
      costBasisCents: args.costBasisCents,
      currentPriceCents: args.currentPriceCents,
      currentValueCents,
      valuationAsOf: args.currentPriceCents ? now : undefined,
      unrealizedGainCents,
      purchaseDate: args.purchaseDate,
      purchasePriceCents: args.purchasePriceCents,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update investment price/valuation
 */
export const updateInvestmentPrice = mutation({
  args: {
    id: v.id("investments"),
    currentPriceCents: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const investment = await ctx.db.get(args.id);
    if (!investment || investment.userId !== userId) {
      throw new Error("Investment not found");
    }

    const currentValueCents = Math.round(investment.quantity * args.currentPriceCents);
    const unrealizedGainCents = currentValueCents - investment.costBasisCents;

    await ctx.db.patch(args.id, {
      currentPriceCents: args.currentPriceCents,
      currentValueCents,
      unrealizedGainCents,
      valuationAsOf: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update investment quantity (buy/sell)
 */
export const updateInvestmentQuantity = mutation({
  args: {
    id: v.id("investments"),
    quantityChange: v.number(), // positive = buy, negative = sell
    pricePerUnitCents: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const investment = await ctx.db.get(args.id);
    if (!investment || investment.userId !== userId) {
      throw new Error("Investment not found");
    }

    const newQuantity = investment.quantity + args.quantityChange;
    if (newQuantity < 0) {
      throw new Error("Cannot sell more than owned");
    }

    let newCostBasis = investment.costBasisCents;
    let realizedGain = investment.realizedGainCents ?? 0;

    if (args.quantityChange > 0) {
      // Buying: add to cost basis
      newCostBasis += Math.round(args.quantityChange * args.pricePerUnitCents);
    } else {
      // Selling: reduce cost basis proportionally, calculate realized gain
      const sellAmount = Math.abs(args.quantityChange);
      const costPerUnit = investment.costBasisCents / investment.quantity;
      const soldCostBasis = Math.round(sellAmount * costPerUnit);
      const saleProceeds = Math.round(sellAmount * args.pricePerUnitCents);
      realizedGain += saleProceeds - soldCostBasis;
      newCostBasis -= soldCostBasis;
    }

    const currentValueCents = investment.currentPriceCents
      ? Math.round(newQuantity * investment.currentPriceCents)
      : undefined;
    const unrealizedGainCents = currentValueCents !== undefined
      ? currentValueCents - newCostBasis
      : undefined;

    await ctx.db.patch(args.id, {
      quantity: newQuantity,
      costBasisCents: newCostBasis,
      currentValueCents,
      unrealizedGainCents,
      realizedGainCents: realizedGain,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get portfolio summary
 */
export const getPortfolioSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let totalValueCents = 0;
    let totalCostBasisCents = 0;
    let totalUnrealizedGainCents = 0;
    let totalRealizedGainCents = 0;

    const byType: Record<string, number> = {};

    for (const inv of investments) {
      const value = inv.currentValueCents ?? inv.costBasisCents;
      totalValueCents += value;
      totalCostBasisCents += inv.costBasisCents;
      totalUnrealizedGainCents += inv.unrealizedGainCents ?? 0;
      totalRealizedGainCents += inv.realizedGainCents ?? 0;

      byType[inv.assetType] = (byType[inv.assetType] ?? 0) + value;
    }

    return {
      totalValueCents,
      totalCostBasisCents,
      totalUnrealizedGainCents,
      totalRealizedGainCents,
      totalGainCents: totalUnrealizedGainCents + totalRealizedGainCents,
      holdingCount: investments.length,
      allocationByType: byType,
    };
  },
});
