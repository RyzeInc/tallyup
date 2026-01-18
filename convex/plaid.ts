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
import type { Id } from "./_generated/dataModel";
import { getReviewReason } from "../lib/constants";
import { resolveCategoryId } from "./categoryResolver";
import { resolveBudgetCategoryId } from "./budgetMatcher";
import { normalizeMerchant } from "./merchant";

type EntryKind = "expense" | "income" | "transfer";

type PlaidCategoryInput = {
  primary?: string | null;
  detailed?: string | null;
};

const PLAID_CATEGORY_TO_SLUG: Record<string, string> = {
  INCOME_DIVIDENDS: "investment_income",
  INCOME_INTEREST_EARNED: "investment_income",
  INCOME_RETIREMENT_PENSION: "wages_salary",
  INCOME_TAX_REFUND: "wages_salary",
  INCOME_UNEMPLOYMENT: "wages_salary",
  INCOME_WAGES: "wages_salary",
  INCOME_OTHER_INCOME: "business_revenue",
  FOOD_AND_DRINK_GROCERIES: "groceries",
  FOOD_AND_DRINK_RESTAURANT: "food",
  FOOD_AND_DRINK_FAST_FOOD: "food",
  FOOD_AND_DRINK_COFFEE: "food",
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "food",
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: "food",
  TRANSPORTATION_GAS: "transportation",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "transportation",
  TRANSPORTATION_PUBLIC_TRANSIT: "transportation",
  TRANSPORTATION_PARKING: "transportation",
  TRANSPORTATION_TOLLS: "transportation",
  TRANSPORTATION_BIKES_AND_SCOOTERS: "transportation",
  TRANSPORTATION_OTHER_TRANSPORTATION: "transportation",
  TRAVEL_FLIGHTS: "transportation",
  TRAVEL_LODGING: "transportation",
  TRAVEL_RENTAL_CARS: "transportation",
  TRAVEL_OTHER_TRAVEL: "transportation",
  RENT_AND_UTILITIES_RENT: "housing",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "utilities",
  RENT_AND_UTILITIES_WATER: "utilities",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "utilities",
  RENT_AND_UTILITIES_TELEPHONE: "utilities",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "utilities",
  RENT_AND_UTILITIES_OTHER_UTILITIES: "utilities",
  HOME_IMPROVEMENT_FURNITURE: "housing",
  HOME_IMPROVEMENT_HARDWARE: "housing",
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: "housing",
  HOME_IMPROVEMENT_SECURITY: "housing",
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: "housing",
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "personal_care",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "personal_care",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "personal_care",
  PERSONAL_CARE_OTHER_PERSONAL_CARE: "personal_care",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "entertainment",
  ENTERTAINMENT_TV_AND_MOVIES: "entertainment",
  ENTERTAINMENT_MOVIES_AND_DVS: "entertainment",
  ENTERTAINMENT_VIDEO_GAMES: "entertainment",
  ENTERTAINMENT_GAMES: "entertainment",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: "entertainment",
  ENTERTAINMENT_CASINOS_AND_GAMBLING: "entertainment",
  ENTERTAINMENT_OTHER_ENTERTAINMENT: "entertainment",
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "miscellaneous",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "miscellaneous",
  GENERAL_MERCHANDISE_DISCOUNT_STORES: "miscellaneous",
  GENERAL_MERCHANDISE_SUPERSTORES: "miscellaneous",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "miscellaneous",
  GENERAL_MERCHANDISE_ELECTRONICS: "miscellaneous",
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: "miscellaneous",
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: "miscellaneous",
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: "miscellaneous",
  GENERAL_MERCHANDISE_PET_SUPPLIES: "miscellaneous",
  GENERAL_MERCHANDISE_SPORTING_GOODS: "miscellaneous",
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: "gifts_giving",
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: "work",
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: "miscellaneous",
  MEDICAL_DENTAL_CARE: "health",
  MEDICAL_EYE_CARE: "health",
  MEDICAL_HOSPITALS_AND_CLINICS: "health",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "health",
  MEDICAL_PRIMARY_CARE: "health",
  MEDICAL_VETERINARY_SERVICES: "health",
  MEDICAL_OTHER_MEDICAL: "health",
  GENERAL_SERVICES_EDUCATION: "education",
  BANK_FEES_ATM_FEES: "miscellaneous",
  BANK_FEES_FOREIGN_TRANSACTION_FEES: "miscellaneous",
  BANK_FEES_INSUFFICIENT_FUNDS: "miscellaneous",
  BANK_FEES_OVERDRAFT_FEES: "miscellaneous",
  BANK_FEES_OTHER_BANK_FEES: "miscellaneous",
  BANK_FEES_INTEREST_CHARGE: "debt",
  LOAN_PAYMENTS_CAR_PAYMENT: "debt",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "debt",
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: "debt",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "debt",
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: "debt",
  LOAN_PAYMENTS_OTHER_PAYMENT: "debt",
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: "gifts_giving",
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: "miscellaneous",
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: "miscellaneous",
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: "miscellaneous",
};

function isTransferCategory(category: PlaidCategoryInput): boolean {
  const detailed = category.detailed?.toUpperCase() ?? "";
  const primary = category.primary?.toUpperCase() ?? "";
  if (detailed.startsWith("TRANSFER_")) return true;
  if (primary.startsWith("TRANSFER")) return true;
  return false;
}

function mapPlaidCategoryToSlug(category: PlaidCategoryInput): string | undefined {
  if (isTransferCategory(category)) return "transfers";
  const detailed = category.detailed?.toUpperCase() ?? "";
  if (detailed && PLAID_CATEGORY_TO_SLUG[detailed]) return PLAID_CATEGORY_TO_SLUG[detailed];
  const primary = category.primary?.toUpperCase() ?? "";

  if (primary.startsWith("FOOD_AND_DRINK")) return "food";
  if (primary.startsWith("TRANSPORTATION")) return "transportation";
  if (primary.startsWith("TRAVEL")) return "transportation";
  if (primary.startsWith("RENT_AND_UTILITIES")) return "utilities";
  if (primary.startsWith("HOME_IMPROVEMENT")) return "housing";
  if (primary.startsWith("PERSONAL_CARE")) return "personal_care";
  if (primary.startsWith("ENTERTAINMENT")) return "entertainment";
  if (primary.startsWith("GENERAL_MERCHANDISE")) return "miscellaneous";
  if (primary.startsWith("MEDICAL")) return "health";
  if (primary.startsWith("EDUCATION")) return "education";
  if (primary.startsWith("BANK_FEES")) return "miscellaneous";
  if (primary.startsWith("LOAN_PAYMENTS")) return "debt";
  if (primary.startsWith("INCOME")) return "wages_salary";

  return undefined;
}

function deriveEntryType(amount: number, category: PlaidCategoryInput): { type: EntryKind; entryType: "purchase" | "income" | "transfer" | "fee" } {
  const transfer = isTransferCategory(category);
  if (transfer) return { type: "transfer", entryType: "transfer" };
  if (category.detailed?.toUpperCase().startsWith("BANK_FEES_")) return { type: "expense", entryType: "fee" };
  const isExpense = amount > 0;
  return { type: isExpense ? "expense" : "income", entryType: isExpense ? "purchase" : "income" };
}

function cleanStr(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

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
    // Products enabled on this item (from /item/get response)
    products: v.optional(v.array(v.string())),
    availableProducts: v.optional(v.array(v.string())),
    billedProducts: v.optional(v.array(v.string())),
    consentedProducts: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    console.info("[plaid] createPlaidItem: products=", args.products);
    return await ctx.db.insert("plaidItems", {
      userId: args.userId,
      itemId: args.itemId,
      accessToken: args.accessToken,
      institutionId: args.institutionId,
      institutionName: args.institutionName,
      institutionLogo: args.institutionLogo,
      institutionColor: args.institutionColor,
      products: args.products,
      availableProducts: args.availableProducts,
      billedProducts: args.billedProducts,
      consentedProducts: args.consentedProducts,
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
    // Normalize type/subtype to lower-case for consistent querying
    const storedType = args.type ? args.type.toLowerCase() : args.type;
    const storedSubtype = args.subtype ? args.subtype.toLowerCase() : args.subtype;

    console.info("[plaid] createPlaidAccount", { plaidAccountId: args.plaidAccountId, type: storedType, subtype: storedSubtype });

    return await ctx.db.insert("plaidAccounts", {
      userId: args.userId,
      plaidItemId: args.plaidItemId,
      accountId: args.accountId,
      plaidAccountId: args.plaidAccountId,
      name: args.name,
      officialName: args.officialName,
      type: storedType,
      subtype: storedSubtype,
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
    initialBalanceCents: v.optional(v.number()),
    isLinked: v.boolean(),
    plaidAccountId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if an account with this plaidAccountId already exists (prevent duplicates)
    if (args.plaidAccountId) {
      const existingAccounts = await ctx.db
        .query("accounts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      
      const existingLinked = existingAccounts.find((a) => a.plaidAccountId === args.plaidAccountId);
      if (existingLinked) {
        // Account already exists, return its ID
        return existingLinked._id;
      }
    }
    
    // Build the account name - include last4 if provided to make it unique
    // Also include institution name if provided
    let accountName = args.name;
    if (args.last4) {
      accountName = `${args.name} (...${args.last4})`;
    }
    if (args.institutionName && !accountName.toLowerCase().includes(args.institutionName.toLowerCase())) {
      accountName = `${args.institutionName} ${accountName}`;
    }
    
    const accountId = await ctx.db.insert("accounts", {
      userId: args.userId,
      name: accountName,
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

    console.info("[plaid] createTallyUpAccount created", { accountId, userId: args.userId, type: args.type, plaidAccountId: args.plaidAccountId });

    if (args.initialBalanceCents !== undefined) {
      await ctx.db.insert("accountSnapshots", {
        userId: args.userId,
        accountId,
        asOf: now,
        balance: Math.round(args.initialBalanceCents),
        createdAt: now,
      });
    }

    return accountId;
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
    authorizedDate: v.optional(v.string()),
    authorizedDatetime: v.optional(v.string()),
    name: v.string(),
    merchantName: v.optional(v.string()),
    pending: v.boolean(),
    category: v.optional(v.string()),
    categoryDetailed: v.optional(v.string()),
    categoryConfidence: v.optional(v.string()),
    categoryIconUrl: v.optional(v.string()),
    paymentChannel: v.string(),
    transactionType: v.optional(v.string()),
    transactionCode: v.optional(v.string()),
    checkNumber: v.optional(v.string()),
    // Location
    locationCity: v.optional(v.string()),
    locationRegion: v.optional(v.string()),
    locationCountry: v.optional(v.string()),
    locationPostalCode: v.optional(v.string()),
    locationAddress: v.optional(v.string()),
    locationLat: v.optional(v.number()),
    locationLon: v.optional(v.number()),
    locationStoreNumber: v.optional(v.string()),
    // Merchant enrichment
    logoUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    merchantEntityId: v.optional(v.string()),
    // Counterparties
    counterparties: v.optional(v.array(v.object({
      name: v.optional(v.string()),
      type: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      website: v.optional(v.string()),
      entityId: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      confidenceLevel: v.optional(v.string()),
    }))),
    // Currency
    isoCurrencyCode: v.optional(v.string()),
    unofficialCurrencyCode: v.optional(v.string()),
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
    
    const txnData = {
      amount: args.amount,
      date: args.date,
      datetime: args.datetime,
      authorizedDate: args.authorizedDate,
      authorizedDatetime: args.authorizedDatetime,
      name: args.name,
      merchantName: args.merchantName,
      pending: args.pending,
      category: args.category,
      categoryDetailed: args.categoryDetailed,
      categoryConfidence: args.categoryConfidence,
      categoryIconUrl: args.categoryIconUrl,
      paymentChannel: args.paymentChannel,
      transactionType: args.transactionType,
      transactionCode: args.transactionCode,
      checkNumber: args.checkNumber,
      locationCity: args.locationCity,
      locationRegion: args.locationRegion,
      locationCountry: args.locationCountry,
      locationPostalCode: args.locationPostalCode,
      locationAddress: args.locationAddress,
      locationLat: args.locationLat,
      locationLon: args.locationLon,
      locationStoreNumber: args.locationStoreNumber,
      logoUrl: args.logoUrl,
      website: args.website,
      merchantEntityId: args.merchantEntityId,
      counterparties: args.counterparties,
      isoCurrencyCode: args.isoCurrencyCode,
      unofficialCurrencyCode: args.unofficialCurrencyCode,
      updatedAt: now,
    };
    
    if (existing) {
      // Update existing transaction
      await ctx.db.patch(existing._id, txnData);
      return existing._id;
    } else {
      // Create new transaction
      return await ctx.db.insert("plaidTransactions", {
        userId: args.userId,
        plaidAccountId: args.plaidAccountId,
        plaidTransactionId: args.plaidTransactionId,
        pendingTransactionId: args.pendingTransactionId,
        ...txnData,
        importStatus: "pending",
        createdAt: now,
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
// INVESTMENT INTERNAL MUTATIONS
// ============================================

export const upsertPlaidSecurity = internalMutation({
  args: {
    securityId: v.string(),
    isin: v.optional(v.string()),
    cusip: v.optional(v.string()),
    sedol: v.optional(v.string()),
    institutionSecurityId: v.optional(v.string()),
    institutionId: v.optional(v.string()),
    tickerSymbol: v.optional(v.string()),
    name: v.string(),
    securityType: v.string(),
    isCashEquivalent: v.optional(v.boolean()),
    closePrice: v.optional(v.number()),
    closePriceAsOf: v.optional(v.string()),
    sector: v.optional(v.string()),
    industry: v.optional(v.string()),
    isoCurrencyCode: v.optional(v.string()),
    unofficialCurrencyCode: v.optional(v.string()),
    marketIdentifierCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if security already exists
    const existing = await ctx.db
      .query("plaidSecurities")
      .withIndex("by_securityId", (q) => q.eq("securityId", args.securityId))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        isin: args.isin,
        cusip: args.cusip,
        sedol: args.sedol,
        institutionSecurityId: args.institutionSecurityId,
        institutionId: args.institutionId,
        tickerSymbol: args.tickerSymbol,
        name: args.name,
        securityType: args.securityType,
        isCashEquivalent: args.isCashEquivalent,
        closePrice: args.closePrice,
        closePriceAsOf: args.closePriceAsOf,
        sector: args.sector,
        industry: args.industry,
        isoCurrencyCode: args.isoCurrencyCode,
        unofficialCurrencyCode: args.unofficialCurrencyCode,
        marketIdentifierCode: args.marketIdentifierCode,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("plaidSecurities", {
        securityId: args.securityId,
        isin: args.isin,
        cusip: args.cusip,
        sedol: args.sedol,
        institutionSecurityId: args.institutionSecurityId,
        institutionId: args.institutionId,
        tickerSymbol: args.tickerSymbol,
        name: args.name,
        securityType: args.securityType,
        isCashEquivalent: args.isCashEquivalent,
        closePrice: args.closePrice,
        closePriceAsOf: args.closePriceAsOf,
        sector: args.sector,
        industry: args.industry,
        isoCurrencyCode: args.isoCurrencyCode,
        unofficialCurrencyCode: args.unofficialCurrencyCode,
        marketIdentifierCode: args.marketIdentifierCode,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const getPlaidSecurityBySecurityId = internalQuery({
  args: { securityId: v.string() },
  handler: async (ctx, { securityId }) => {
    return await ctx.db
      .query("plaidSecurities")
      .withIndex("by_securityId", (q) => q.eq("securityId", securityId))
      .first();
  },
});

export const upsertPlaidHolding = internalMutation({
  args: {
    userId: v.string(),
    plaidAccountId: v.id("plaidAccounts"),
    plaidSecurityId: v.id("plaidSecurities"),
    quantity: v.number(),
    institutionPrice: v.number(),
    institutionPriceAsOf: v.optional(v.string()),
    institutionPriceDatetime: v.optional(v.string()),
    institutionValue: v.optional(v.number()),
    costBasis: v.optional(v.number()),
    vestedQuantity: v.optional(v.number()),
    vestedValue: v.optional(v.number()),
    unvestedQuantity: v.optional(v.number()),
    unvestedValue: v.optional(v.number()),
    isoCurrencyCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if holding already exists for this account + security
    const existingHoldings = await ctx.db
      .query("plaidHoldings")
      .withIndex("by_account", (q) => q.eq("plaidAccountId", args.plaidAccountId))
      .collect();
    
    const existing = existingHoldings.find(
      (h) => h.plaidSecurityId === args.plaidSecurityId
    );
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        institutionPrice: args.institutionPrice,
        institutionPriceAsOf: args.institutionPriceAsOf,
        institutionPriceDatetime: args.institutionPriceDatetime,
        institutionValue: args.institutionValue,
        costBasis: args.costBasis,
        vestedQuantity: args.vestedQuantity,
        vestedValue: args.vestedValue,
        unvestedQuantity: args.unvestedQuantity,
        unvestedValue: args.unvestedValue,
        isoCurrencyCode: args.isoCurrencyCode,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("plaidHoldings", {
        userId: args.userId,
        plaidAccountId: args.plaidAccountId,
        plaidSecurityId: args.plaidSecurityId,
        quantity: args.quantity,
        institutionPrice: args.institutionPrice,
        institutionPriceAsOf: args.institutionPriceAsOf,
        institutionPriceDatetime: args.institutionPriceDatetime,
        institutionValue: args.institutionValue,
        costBasis: args.costBasis,
        vestedQuantity: args.vestedQuantity,
        vestedValue: args.vestedValue,
        unvestedQuantity: args.unvestedQuantity,
        unvestedValue: args.unvestedValue,
        isoCurrencyCode: args.isoCurrencyCode,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const upsertPlaidInvestmentTransaction = internalMutation({
  args: {
    userId: v.string(),
    plaidAccountId: v.id("plaidAccounts"),
    plaidSecurityId: v.optional(v.id("plaidSecurities")),
    investmentTransactionId: v.string(),
    date: v.string(),
    name: v.string(),
    quantity: v.number(),
    amount: v.number(),
    price: v.number(),
    fees: v.optional(v.number()),
    transactionType: v.string(),
    subtype: v.optional(v.string()),
    isoCurrencyCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if transaction already exists
    const existing = await ctx.db
      .query("plaidInvestmentTransactions")
      .withIndex("by_transactionId", (q) => 
        q.eq("investmentTransactionId", args.investmentTransactionId)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        plaidSecurityId: args.plaidSecurityId,
        date: args.date,
        name: args.name,
        quantity: args.quantity,
        amount: args.amount,
        price: args.price,
        fees: args.fees,
        transactionType: args.transactionType,
        subtype: args.subtype,
        isoCurrencyCode: args.isoCurrencyCode,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("plaidInvestmentTransactions", {
        userId: args.userId,
        plaidAccountId: args.plaidAccountId,
        plaidSecurityId: args.plaidSecurityId,
        investmentTransactionId: args.investmentTransactionId,
        date: args.date,
        name: args.name,
        quantity: args.quantity,
        amount: args.amount,
        price: args.price,
        fees: args.fees,
        transactionType: args.transactionType,
        subtype: args.subtype,
        isoCurrencyCode: args.isoCurrencyCode,
        importStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updatePlaidItemInvestmentsSyncState = internalMutation({
  args: {
    id: v.id("plaidItems"),
    lastInvestmentsSyncAt: v.number(),
    investmentsCursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastInvestmentsSyncAt: args.lastInvestmentsSyncAt,
      investmentsCursor: args.investmentsCursor,
      updatedAt: Date.now(),
    });
  },
});

// ============================================
// LIABILITIES INTERNAL MUTATIONS
// ============================================

export const upsertPlaidLiability = internalMutation({
  args: {
    userId: v.string(),
    plaidAccountId: v.id("plaidAccounts"),
    accountId: v.id("accounts"),
    liabilityType: v.union(
      v.literal("credit"),
      v.literal("mortgage"),
      v.literal("student")
    ),
    // Common fields
    accountNumber: v.optional(v.string()),
    isOverdue: v.optional(v.boolean()),
    lastPaymentAmount: v.optional(v.number()),
    lastPaymentDate: v.optional(v.string()),
    lastStatementIssueDate: v.optional(v.string()),
    minimumPaymentAmount: v.optional(v.number()),
    nextPaymentDueDate: v.optional(v.string()),
    // Credit fields
    aprs: v.optional(v.array(v.object({
      aprPercentage: v.number(),
      aprType: v.string(),
      balanceSubjectToApr: v.optional(v.number()),
      interestChargeAmount: v.optional(v.number()),
    }))),
    lastStatementBalance: v.optional(v.number()),
    // Mortgage fields
    currentLateFee: v.optional(v.number()),
    escrowBalance: v.optional(v.number()),
    hasPmi: v.optional(v.boolean()),
    hasPrepaymentPenalty: v.optional(v.boolean()),
    interestRate: v.optional(v.object({
      percentage: v.number(),
      type: v.string(),
    })),
    loanTerm: v.optional(v.string()),
    loanTypeDescription: v.optional(v.string()),
    maturityDate: v.optional(v.string()),
    nextMonthlyPayment: v.optional(v.number()),
    originationDate: v.optional(v.string()),
    originationPrincipalAmount: v.optional(v.number()),
    pastDueAmount: v.optional(v.number()),
    propertyAddress: v.optional(v.object({
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      street: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      country: v.optional(v.string()),
    })),
    ytdInterestPaid: v.optional(v.number()),
    ytdPrincipalPaid: v.optional(v.number()),
    // Student loan fields
    disbursementDates: v.optional(v.array(v.string())),
    expectedPayoffDate: v.optional(v.string()),
    guarantor: v.optional(v.string()),
    interestRatePercentage: v.optional(v.number()),
    loanName: v.optional(v.string()),
    loanStatus: v.optional(v.object({
      type: v.string(),
      endDate: v.optional(v.string()),
    })),
    outstandingInterestAmount: v.optional(v.number()),
    paymentReferenceNumber: v.optional(v.string()),
    pslfStatus: v.optional(v.object({
      estimatedEligibilityDate: v.optional(v.string()),
      paymentsMade: v.optional(v.number()),
      paymentsRemaining: v.optional(v.number()),
    })),
    repaymentPlan: v.optional(v.object({
      type: v.string(),
      description: v.optional(v.string()),
    })),
    sequenceNumber: v.optional(v.string()),
    servicerAddress: v.optional(v.object({
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      street: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      country: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if liability already exists for this account
    const existing = await ctx.db
      .query("plaidLiabilities")
      .withIndex("by_account", (q) => q.eq("plaidAccountId", args.plaidAccountId))
      .first();
    
    const data = {
      userId: args.userId,
      plaidAccountId: args.plaidAccountId,
      accountId: args.accountId,
      liabilityType: args.liabilityType,
      accountNumber: args.accountNumber,
      isOverdue: args.isOverdue,
      lastPaymentAmount: args.lastPaymentAmount,
      lastPaymentDate: args.lastPaymentDate,
      lastStatementIssueDate: args.lastStatementIssueDate,
      minimumPaymentAmount: args.minimumPaymentAmount,
      nextPaymentDueDate: args.nextPaymentDueDate,
      aprs: args.aprs,
      lastStatementBalance: args.lastStatementBalance,
      currentLateFee: args.currentLateFee,
      escrowBalance: args.escrowBalance,
      hasPmi: args.hasPmi,
      hasPrepaymentPenalty: args.hasPrepaymentPenalty,
      interestRate: args.interestRate,
      loanTerm: args.loanTerm,
      loanTypeDescription: args.loanTypeDescription,
      maturityDate: args.maturityDate,
      nextMonthlyPayment: args.nextMonthlyPayment,
      originationDate: args.originationDate,
      originationPrincipalAmount: args.originationPrincipalAmount,
      pastDueAmount: args.pastDueAmount,
      propertyAddress: args.propertyAddress,
      ytdInterestPaid: args.ytdInterestPaid,
      ytdPrincipalPaid: args.ytdPrincipalPaid,
      disbursementDates: args.disbursementDates,
      expectedPayoffDate: args.expectedPayoffDate,
      guarantor: args.guarantor,
      interestRatePercentage: args.interestRatePercentage,
      loanName: args.loanName,
      loanStatus: args.loanStatus,
      outstandingInterestAmount: args.outstandingInterestAmount,
      paymentReferenceNumber: args.paymentReferenceNumber,
      pslfStatus: args.pslfStatus,
      repaymentPlan: args.repaymentPlan,
      sequenceNumber: args.sequenceNumber,
      servicerAddress: args.servicerAddress,
      updatedAt: now,
    };
    
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("plaidLiabilities", {
        ...data,
        createdAt: now,
      });
    }
  },
});

export const updatePlaidItemLiabilitiesSyncState = internalMutation({
  args: {
    id: v.id("plaidItems"),
    lastLiabilitiesSyncAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastLiabilitiesSyncAt: args.lastLiabilitiesSyncAt,
      updatedAt: Date.now(),
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

    const amountCents = Math.round(Math.abs(plaidTxn.amount) * 100);
    const categoryInput = cleanStr(args.category);
    const categoryFromPlaid = mapPlaidCategoryToSlug({
      primary: plaidTxn.category,
      detailed: plaidTxn.categoryDetailed,
    });
    const { type, entryType } = deriveEntryType(plaidTxn.amount, {
      primary: plaidTxn.category,
      detailed: plaidTxn.categoryDetailed,
    });
    const isTransfer = type === "transfer";
    const stableId = plaidTxn.pendingTransactionId || plaidTxn.plaidTransactionId;
    const merchantLabel = plaidTxn.merchantName || plaidTxn.name;
    const merchantNormalized = normalizeMerchant(merchantLabel);
    const existingEntry = stableId
      ? await ctx.db
          .query("entries")
          .withIndex("by_user_stableId", (q) =>
            q.eq("userId", identity.subject).eq("stableId", stableId)
          )
          .first()
      : null;
    const resolvedCategory =
      categoryInput ?? existingEntry?.category ?? categoryFromPlaid;
    const resolvedTags = args.tags ?? existingEntry?.tags;
    const resolvedNote = cleanStr(args.note) ?? existingEntry?.note ?? plaidTxn.name;
    const categoryId = isTransfer
      ? undefined
      : existingEntry?.categoryId ??
        (await resolveCategoryId(
          ctx,
          identity.subject,
          resolvedCategory,
          type === "income" ? "income" : "expense",
          { createIfMissing: false }
        ));
    let budgetCategoryId = existingEntry?.budgetCategoryId;
    if (!isTransfer && (!budgetCategoryId || categoryInput)) {
      budgetCategoryId = await resolveBudgetCategoryId(ctx, identity.subject, {
        category: resolvedCategory,
        merchant: merchantLabel,
        tags: resolvedTags,
      });
    }
    const reviewReason = isTransfer
      ? null
      : getReviewReason({
          category: resolvedCategory,
          contextTags: undefined,
          intentTags: undefined,
          amountCents,
          methodOrAccount: plaidAccount.name,
        });
    const needsReview = existingEntry
      ? existingEntry.needsReview
      : isTransfer
      ? false
      : !!reviewReason;
    const reviewReasonValue =
      existingEntry?.reviewReason ?? reviewReason ?? undefined;

    // Create or update the entry
    const now = Date.now();
    const entryBase = {
      userId: identity.subject,
      type,
      transactionType: isTransfer
        ? "TRANSFER"
        : type === "income"
        ? "RECEIVED"
        : "SPENT",
      entryType,
      category: resolvedCategory,
      categoryId,
      budgetCategoryId,
      tags: resolvedTags,
      note: resolvedNote,
      merchant: merchantLabel,
      merchantRaw: plaidTxn.name,
      merchantNormalized,
      methodOrAccount: plaidAccount.name,
      amountCents,
      status: plaidTxn.pending ? "pending" : "posted",
      date: dateTs,
      occurredAt: plaidTxn.datetime ? new Date(plaidTxn.datetime).getTime() : dateTs,
      enteredAt: now,
      accountId: plaidAccount.accountId,
      stableId,
      needsReview,
      reviewReason: reviewReasonValue,
      excludeFromTotals: isTransfer ? true : undefined,
      excludeFromBudgets: isTransfer ? true : undefined,
      excludeFromCashFlow: isTransfer ? true : undefined,
      ignoredForBudgets: isTransfer ? true : undefined,
      ignoredForInsights: isTransfer ? true : undefined,
      isTransferSource: isTransfer ? plaidTxn.amount > 0 : undefined,
      updatedAt: now,
    } as const;
    let entryId: Id<"entries">;
    if (existingEntry) {
      await ctx.db.patch(existingEntry._id, entryBase);
      entryId = existingEntry._id;
    } else {
      entryId = await ctx.db.insert("entries", { ...entryBase, createdAt: now });
    }
    
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
        
        const amountCents = Math.round(Math.abs(plaidTxn.amount) * 100);
        const categoryFromPlaid = mapPlaidCategoryToSlug({
          primary: plaidTxn.category,
          detailed: plaidTxn.categoryDetailed,
        });
        const { type, entryType } = deriveEntryType(plaidTxn.amount, {
          primary: plaidTxn.category,
          detailed: plaidTxn.categoryDetailed,
        });
        const isTransfer = type === "transfer";
        const stableId = plaidTxn.pendingTransactionId || plaidTxn.plaidTransactionId;
        const merchantLabel = plaidTxn.merchantName || plaidTxn.name;
        const merchantNormalized = normalizeMerchant(merchantLabel);
        const existingEntry = stableId
          ? await ctx.db
              .query("entries")
              .withIndex("by_user_stableId", (q) =>
                q.eq("userId", identity.subject).eq("stableId", stableId)
              )
              .first()
          : null;
        const resolvedCategory = existingEntry?.category ?? categoryFromPlaid;
        const resolvedTags = existingEntry?.tags;
        const resolvedNote = existingEntry?.note ?? plaidTxn.name;
        const categoryId = isTransfer
          ? undefined
          : existingEntry?.categoryId ??
            (await resolveCategoryId(
              ctx,
              identity.subject,
              resolvedCategory,
              type === "income" ? "income" : "expense",
              { createIfMissing: false }
            ));
        let budgetCategoryId = existingEntry?.budgetCategoryId;
        if (!isTransfer && !budgetCategoryId) {
          budgetCategoryId = await resolveBudgetCategoryId(ctx, identity.subject, {
            category: resolvedCategory,
            merchant: merchantLabel,
          });
        }
        const reviewReason = isTransfer
          ? null
          : getReviewReason({
              category: resolvedCategory,
              contextTags: undefined,
              intentTags: undefined,
              amountCents,
              methodOrAccount: plaidAccount.name,
            });
        const needsReview = existingEntry
          ? existingEntry.needsReview
          : isTransfer
          ? false
          : !!reviewReason;
        const reviewReasonValue =
          existingEntry?.reviewReason ?? reviewReason ?? undefined;

        const now = Date.now();
        const entryBase = {
          userId: identity.subject,
          type,
          transactionType: isTransfer
            ? "TRANSFER"
            : type === "income"
            ? "RECEIVED"
            : "SPENT",
          entryType,
          category: resolvedCategory,
          categoryId,
          budgetCategoryId,
          tags: resolvedTags,
          note: resolvedNote,
          merchant: merchantLabel,
          merchantRaw: plaidTxn.name,
          merchantNormalized,
          methodOrAccount: plaidAccount.name,
          amountCents,
          status: plaidTxn.pending ? "pending" : "posted",
          date: dateTs,
          occurredAt: plaidTxn.datetime ? new Date(plaidTxn.datetime).getTime() : dateTs,
          enteredAt: now,
          accountId: plaidAccount.accountId,
          stableId,
          needsReview,
          reviewReason: reviewReasonValue,
          excludeFromTotals: isTransfer ? true : undefined,
          excludeFromBudgets: isTransfer ? true : undefined,
          excludeFromCashFlow: isTransfer ? true : undefined,
          ignoredForBudgets: isTransfer ? true : undefined,
          ignoredForInsights: isTransfer ? true : undefined,
          isTransferSource: isTransfer ? plaidTxn.amount > 0 : undefined,
          updatedAt: now,
        } as const;

        let entryId: Id<"entries">;
        if (existingEntry) {
          await ctx.db.patch(existingEntry._id, entryBase);
          entryId = existingEntry._id;
        } else {
          entryId = await ctx.db.insert("entries", { ...entryBase, createdAt: now });
        }
        
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
