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
  // Income
  INCOME_DIVIDENDS: "income_dividends",
  INCOME_INTEREST_EARNED: "income_interest",
  INCOME_RETIREMENT_PENSION: "income_retirement",
  INCOME_TAX_REFUND: "income_tax_refund",
  INCOME_UNEMPLOYMENT: "income_unemployment",
  INCOME_WAGES: "income_wages",
  INCOME_OTHER_INCOME: "income_other",
  
  // Food & Drink
  FOOD_AND_DRINK_GROCERIES: "food_groceries",
  FOOD_AND_DRINK_RESTAURANT: "food_restaurant",
  FOOD_AND_DRINK_FAST_FOOD: "food_fast_food",
  FOOD_AND_DRINK_COFFEE: "food_coffee",
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "food_beer_wine_liquor",
  FOOD_AND_DRINK_VENDING_MACHINES: "food_vending_machines",
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: "food_other",
  
  // Transportation
  TRANSPORTATION_GAS: "transport_gas",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "transport_rideshare",
  TRANSPORTATION_PUBLIC_TRANSIT: "transport_public_transit",
  TRANSPORTATION_PARKING: "transport_parking",
  TRANSPORTATION_TOLLS: "transport_tolls",
  TRANSPORTATION_BIKES_AND_SCOOTERS: "transport_bikes_scooters",
  TRANSPORTATION_OTHER_TRANSPORTATION: "transport_other",
  
  // Travel
  TRAVEL_FLIGHTS: "travel_flights",
  TRAVEL_LODGING: "travel_lodging",
  TRAVEL_RENTAL_CARS: "travel_rental_cars",
  TRAVEL_OTHER_TRAVEL: "travel_other",
  
  // Rent & Utilities
  RENT_AND_UTILITIES_RENT: "utilities_rent",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "utilities_gas_electric",
  RENT_AND_UTILITIES_WATER: "utilities_water",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "utilities_internet_cable",
  RENT_AND_UTILITIES_TELEPHONE: "utilities_telephone",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "utilities_sewage",
  RENT_AND_UTILITIES_OTHER_UTILITIES: "utilities_other",
  
  // Home Improvement
  HOME_IMPROVEMENT_FURNITURE: "home_furniture",
  HOME_IMPROVEMENT_HARDWARE: "home_hardware",
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: "home_repair",
  HOME_IMPROVEMENT_SECURITY: "home_security",
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: "home_other",
  
  // Personal Care
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "personal_gyms",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "personal_hair_beauty",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "personal_laundry",
  PERSONAL_CARE_OTHER_PERSONAL_CARE: "personal_other",
  
  // Entertainment
  ENTERTAINMENT_MUSIC_AND_AUDIO: "entertainment_music_audio",
  ENTERTAINMENT_TV_AND_MOVIES: "entertainment_tv_movies",
  ENTERTAINMENT_MOVIES_AND_DVS: "entertainment_tv_movies",
  ENTERTAINMENT_VIDEO_GAMES: "entertainment_video_games",
  ENTERTAINMENT_GAMES: "entertainment_video_games",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: "entertainment_sporting_events",
  ENTERTAINMENT_CASINOS_AND_GAMBLING: "entertainment_casinos_gambling",
  ENTERTAINMENT_OTHER_ENTERTAINMENT: "entertainment_other",
  
  // General Merchandise
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "merchandise_clothing",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "merchandise_department",
  GENERAL_MERCHANDISE_DISCOUNT_STORES: "merchandise_discount",
  GENERAL_MERCHANDISE_SUPERSTORES: "merchandise_superstores",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "merchandise_online",
  GENERAL_MERCHANDISE_ELECTRONICS: "merchandise_electronics",
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: "merchandise_bookstores",
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: "merchandise_convenience",
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: "merchandise_other",
  GENERAL_MERCHANDISE_PET_SUPPLIES: "merchandise_pets",
  GENERAL_MERCHANDISE_SPORTING_GOODS: "merchandise_sporting_goods",
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: "merchandise_gifts",
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: "merchandise_office",
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: "merchandise_tobacco",
  
  // Medical
  MEDICAL_DENTAL_CARE: "medical_dental",
  MEDICAL_EYE_CARE: "medical_eye",
  MEDICAL_HOSPITALS_AND_CLINICS: "medical_hospitals",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "medical_pharmacy",
  MEDICAL_PRIMARY_CARE: "medical_primary_care",
  MEDICAL_VETERINARY_SERVICES: "medical_veterinary",
  MEDICAL_OTHER_MEDICAL: "medical_other",
  
  // General Services
  GENERAL_SERVICES_EDUCATION: "services_education",
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: "services_accounting_tax",
  GENERAL_SERVICES_AUTOMOTIVE: "services_automotive",
  GENERAL_SERVICES_CHILDCARE: "services_childcare",
  GENERAL_SERVICES_CONSULTING_AND_LEGAL: "services_consulting",
  GENERAL_SERVICES_INSURANCE: "services_insurance",
  GENERAL_SERVICES_POSTAGE_AND_SHIPPING: "services_postage_shipping",
  GENERAL_SERVICES_STORAGE: "services_storage",
  GENERAL_SERVICES_VETERINARY_SERVICES: "services_veterinary",
  GENERAL_SERVICES_OTHER_GENERAL_SERVICES: "services_other",
  
  // Bank Fees
  BANK_FEES_ATM_FEES: "bank_fees_atm",
  BANK_FEES_FOREIGN_TRANSACTION_FEES: "bank_fees_foreign_transaction",
  BANK_FEES_INSUFFICIENT_FUNDS: "bank_fees_insufficient_funds",
  BANK_FEES_OVERDRAFT_FEES: "bank_fees_overdraft",
  BANK_FEES_OTHER_BANK_FEES: "bank_fees_other",
  BANK_FEES_INTEREST_CHARGE: "bank_fees_interest_charge",
  
  // Loan Payments
  LOAN_PAYMENTS_CAR_PAYMENT: "loan_car_payment",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "loan_credit_card",
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: "loan_personal",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "loan_mortgage",
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: "loan_student",
  LOAN_PAYMENTS_OTHER_PAYMENT: "loan_other",
  
  // Government & Non-Profit
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: "government_donations",
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: "government_tax_payment",
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: "government_other",
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: "government_departments",
  
  // Transfers
  TRANSFER_IN_ACCOUNT_TRANSFER: "transfer_in_account",
  TRANSFER_IN_CASH_ADVANCES_AND_LOANS: "transfer_in_cash_advance",
  TRANSFER_IN_DEPOSIT: "transfer_in_deposit",
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: "transfer_in_investment",
  TRANSFER_IN_SAVINGS: "transfer_in_savings",
  TRANSFER_IN_OTHER_TRANSFER: "transfer_in_other",
  TRANSFER_OUT_ACCOUNT_TRANSFER: "transfer_out_account",
  TRANSFER_OUT_CASH_ADVANCES_AND_LOANS: "transfer_out_cash_advance",
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: "transfer_out_investment",
  TRANSFER_OUT_SAVINGS: "transfer_out_savings",
  TRANSFER_OUT_WITHDRAWAL: "transfer_out_withdrawal",
  TRANSFER_OUT_OTHER_TRANSFER: "transfer_out_other",
};

function isTransferCategory(category: PlaidCategoryInput): boolean {
  const detailed = category.detailed?.toUpperCase() ?? "";
  const primary = category.primary?.toUpperCase() ?? "";
  if (detailed.startsWith("TRANSFER_")) return true;
  if (primary.startsWith("TRANSFER")) return true;
  return false;
}

function mapPlaidCategoryToSlug(category: PlaidCategoryInput): string | undefined {
  if (isTransferCategory(category)) return "transfer_in"; // Default to transfer_in, will be refined later
  const detailed = category.detailed?.toUpperCase() ?? "";
  if (detailed && PLAID_CATEGORY_TO_SLUG[detailed]) return PLAID_CATEGORY_TO_SLUG[detailed];
  const primary = category.primary?.toUpperCase() ?? "";

  // Fallback to parent category slugs when detailed mapping not found
  if (primary.startsWith("FOOD_AND_DRINK")) return "food_and_drink";
  if (primary.startsWith("TRANSPORTATION")) return "transportation";
  if (primary.startsWith("TRAVEL")) return "travel";
  if (primary.startsWith("RENT_AND_UTILITIES")) return "rent_utilities";
  if (primary.startsWith("HOME_IMPROVEMENT")) return "home_improvement";
  if (primary.startsWith("PERSONAL_CARE")) return "personal_care";
  if (primary.startsWith("ENTERTAINMENT")) return "entertainment";
  if (primary.startsWith("GENERAL_MERCHANDISE")) return "general_merchandise";
  if (primary.startsWith("GENERAL_SERVICES")) return "general_services";
  if (primary.startsWith("MEDICAL")) return "medical";
  if (primary.startsWith("BANK_FEES")) return "bank_fees";
  if (primary.startsWith("LOAN_PAYMENTS")) return "loan_payments";
  if (primary.startsWith("GOVERNMENT_AND_NON_PROFIT")) return "government_nonprofit";
  if (primary.startsWith("INCOME")) return "income_wages";

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
// SYNC PLAID HOLDINGS TO INVESTMENTS
// ============================================

// Map Plaid security type to TallyUp asset type
const PLAID_TO_TALLYUP_ASSET_TYPE: Record<string, "stock" | "etf" | "mutual_fund" | "bond" | "crypto" | "cash" | "real_estate" | "other"> = {
  "cash": "cash",
  "cryptocurrency": "crypto",
  "derivative": "other",
  "equity": "stock",
  "etf": "etf",
  "fixed income": "bond",
  "loan": "other",
  "mutual fund": "mutual_fund",
  "other": "other",
};

export const syncPlaidHoldingsToInvestments = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // Get all Plaid holdings for this user
    const holdings = await ctx.db
      .query("plaidHoldings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    const now = Date.now();
    let created = 0;
    let updated = 0;
    
    for (const holding of holdings) {
      // Get the security info
      const security = await ctx.db.get(holding.plaidSecurityId);
      if (!security) continue;
      
      // Get the Plaid account to find the TallyUp account
      const plaidAccount = await ctx.db.get(holding.plaidAccountId);
      if (!plaidAccount) continue;
      
      // Check if investment already exists for this holding
      const existingInvestments = await ctx.db
        .query("investments")
        .withIndex("by_plaidHolding", (q) => q.eq("plaidHoldingId", holding._id))
        .collect();
      
      const assetType = PLAID_TO_TALLYUP_ASSET_TYPE[security.securityType.toLowerCase()] || "other";
      const currentPriceCents = security.closePrice ? Math.round(security.closePrice * 100) : undefined;
      const costBasisCents = holding.costBasis ? Math.round(holding.costBasis * 100) : Math.round(holding.institutionValue ?? 0 * 100);
      const currentValueCents = holding.institutionValue ? Math.round(holding.institutionValue * 100) : undefined;
      const unrealizedGainCents = currentValueCents && costBasisCents 
        ? currentValueCents - costBasisCents 
        : undefined;
      
      if (existingInvestments.length > 0) {
        // Update existing investment
        const existing = existingInvestments[0];
        await ctx.db.patch(existing._id, {
          quantity: holding.quantity,
          costBasisCents,
          currentPriceCents,
          currentValueCents,
          unrealizedGainCents,
          vestedQuantity: holding.vestedQuantity ?? undefined,
          unvestedQuantity: holding.unvestedQuantity ?? undefined,
          priceAsOf: security.closePriceAsOf ? new Date(security.closePriceAsOf).getTime() : undefined,
          valuationAsOf: now,
          updatedAt: now,
        });
        updated++;
      } else {
        // Create new investment
        await ctx.db.insert("investments", {
          userId,
          accountId: plaidAccount.accountId,
          plaidSecurityId: holding.plaidSecurityId,
          plaidHoldingId: holding._id,
          symbol: security.tickerSymbol,
          name: security.name,
          assetType,
          isin: security.isin,
          cusip: security.cusip,
          sector: security.sector,
          industry: security.industry,
          quantity: holding.quantity,
          costBasisCents,
          currentPriceCents,
          currentValueCents,
          unrealizedGainCents,
          vestedQuantity: holding.vestedQuantity ?? undefined,
          unvestedQuantity: holding.unvestedQuantity ?? undefined,
          priceAsOf: security.closePriceAsOf ? new Date(security.closePriceAsOf).getTime() : undefined,
          valuationAsOf: now,
          isoCurrencyCode: security.isoCurrencyCode,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      }
    }
    
    return { created, updated, total: holdings.length };
  },
});

// Query to list Plaid holdings that haven't been linked to investments yet
export const listUnlinkedPlaidHoldings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    
    const holdings = await ctx.db
      .query("plaidHoldings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    const unlinked = [];
    for (const holding of holdings) {
      // Check if already linked to an investment
      const linked = await ctx.db
        .query("investments")
        .withIndex("by_plaidHolding", (q) => q.eq("plaidHoldingId", holding._id))
        .first();
      
      if (!linked) {
        // Get security info
        const security = await ctx.db.get(holding.plaidSecurityId);
        unlinked.push({
          ...holding,
          security,
        });
      }
    }
    
    return unlinked;
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

// List ALL Plaid transactions (for debugging/inspection view)
export const listAllPlaidTransactions = query({
  args: { 
    limit: v.optional(v.number()),
    importStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("imported"),
      v.literal("skipped"),
      v.literal("duplicate"),
      v.literal("all")
    )),
    startDate: v.optional(v.string()), // YYYY-MM-DD
    endDate: v.optional(v.string()),   // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const limit = Math.min(args.limit ?? 200, 500);
    
    // Get all Plaid transactions for user
    let results = await ctx.db
      .query("plaidTransactions")
      .withIndex("by_user_importStatus", (q) => {
        if (args.importStatus && args.importStatus !== "all") {
          return q.eq("userId", identity.subject).eq("importStatus", args.importStatus);
        }
        return q.eq("userId", identity.subject);
      })
      .collect();
    
    // If "all" status, we need to get all statuses (the index only returns one)
    if (args.importStatus === "all" || !args.importStatus) {
      // Re-query without import status filter using by_user index
      const allStatuses = await ctx.db
        .query("plaidTransactions")
        .filter(q => q.eq(q.field("userId"), identity.subject))
        .collect();
      results = allStatuses;
    }
    
    // Filter by date if provided
    if (args.startDate) {
      results = results.filter(t => t.date >= args.startDate!);
    }
    if (args.endDate) {
      results = results.filter(t => t.date <= args.endDate!);
    }
    
    // Sort by date descending (most recent first)
    results.sort((a, b) => b.date.localeCompare(a.date));
    
    // Apply limit
    results = results.slice(0, limit);
    
    // Get account info for enrichment
    const accountIds = [...new Set(results.map(t => t.plaidAccountId))];
    const accounts = await Promise.all(
      accountIds.map(id => ctx.db.get(id))
    );
    const accountMap = new Map(
      accounts.filter(Boolean).map(a => [a!._id, a!])
    );
    
    // Return enriched transactions
    return results.map(t => ({
      ...t,
      accountName: accountMap.get(t.plaidAccountId)?.name || "Unknown",
      accountMask: accountMap.get(t.plaidAccountId)?.mask,
    }));
  },
});

// Delete a raw Plaid transaction
export const deletePlaidTransaction = mutation({
  args: { 
    id: v.id("plaidTransactions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the transaction first to verify ownership
    const transaction = await ctx.db.get(args.id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    
    // Verify ownership
    if (transaction.userId !== identity.subject) {
      throw new Error("Not authorized to delete this transaction");
    }
    
    // Delete the transaction
    await ctx.db.delete(args.id);
    
    return { success: true };
  },
});

// Bulk delete raw Plaid transactions
export const deletePlaidTransactionsBulk = mutation({
  args: { 
    ids: v.array(v.id("plaidTransactions")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    let deleted = 0;
    let failed = 0;
    
    for (const id of args.ids) {
      const transaction = await ctx.db.get(id);
      if (!transaction) {
        failed++;
        continue;
      }
      
      // Verify ownership
      if (transaction.userId !== identity.subject) {
        failed++;
        continue;
      }
      
      // Delete the transaction
      await ctx.db.delete(id);
      deleted++;
    }
    
    return { deleted, failed };
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

// List all Plaid liabilities for the current user
export const listPlaidLiabilities = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    return await ctx.db
      .query("plaidLiabilities")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

// Get Plaid-suggested goals based on connected accounts
export const getPlaidSuggestedGoals = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const suggestions: Array<{
      type: "paydown" | "savings" | "sinkingFund";
      name: string;
      icon: string;
      suggestedAmountCents: number;
      source: string;
      description: string;
    }> = [];
    
    // Get liabilities for debt paydown suggestions
    const liabilities = await ctx.db
      .query("plaidLiabilities")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    // Get linked accounts for context
    const plaidAccounts = await ctx.db
      .query("plaidAccounts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    for (const liability of liabilities) {
      const account = plaidAccounts.find(a => a._id === liability.plaidAccountId);
      const accountName = account?.name || account?.officialName || "Account";
      
      if (liability.liabilityType === "credit") {
        // Credit card payoff goal
        const balance = account?.balanceCurrent;
        if (balance && balance > 0) {
          suggestions.push({
            type: "paydown",
            name: `Pay off ${accountName}`,
            icon: "💳",
            suggestedAmountCents: Math.round(balance * 100),
            source: "plaid_liability",
            description: `Current balance: ${balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
          });
        }
      } else if (liability.liabilityType === "student") {
        // Student loan payoff goal
        const balance = account?.balanceCurrent;
        if (balance && balance > 0) {
          suggestions.push({
            type: "paydown",
            name: `Pay off ${liability.loanName || accountName}`,
            icon: "🎓",
            suggestedAmountCents: Math.round(balance * 100),
            source: "plaid_liability",
            description: `Remaining: ${balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
          });
        }
      } else if (liability.liabilityType === "mortgage") {
        // Mortgage payoff (usually long-term, but can suggest)
        const balance = account?.balanceCurrent;
        if (balance && balance > 0 && liability.originationPrincipalAmount) {
          const progress = ((liability.originationPrincipalAmount - balance) / liability.originationPrincipalAmount) * 100;
          suggestions.push({
            type: "paydown",
            name: `Mortgage (${accountName})`,
            icon: "🏠",
            suggestedAmountCents: Math.round(balance * 100),
            source: "plaid_liability",
            description: `${progress.toFixed(0)}% paid off`,
          });
        }
      }
    }
    
    // Check for emergency fund suggestion based on checking/savings balances
    const depositoryAccounts = plaidAccounts.filter(
      a => a.type === "depository" && (a.subtype === "checking" || a.subtype === "savings")
    );
    
    const totalSavings = depositoryAccounts
      .filter(a => a.subtype === "savings")
      .reduce((sum, a) => sum + (a.balanceCurrent || 0), 0);
    
    // Get monthly expenses estimate from recurring streams
    const recurringStreams = await ctx.db
      .query("plaidRecurringStreams")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter(q => q.eq(q.field("streamType"), "outflow"))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
    
    // Calculate monthly expense estimate from recurring
    let monthlyExpenses = 0;
    for (const stream of recurringStreams) {
      const amount = Math.abs(stream.averageAmountCents / 100);
      switch (stream.frequency) {
        case "WEEKLY": monthlyExpenses += amount * 4.33; break;
        case "BIWEEKLY": monthlyExpenses += amount * 2.17; break;
        case "SEMI_MONTHLY": monthlyExpenses += amount * 2; break;
        case "MONTHLY": monthlyExpenses += amount; break;
        case "ANNUALLY": monthlyExpenses += amount / 12; break;
        default: monthlyExpenses += amount; // Assume monthly for unknown
      }
    }
    
    // Suggest 3-6 months emergency fund if savings < 3x monthly expenses
    if (monthlyExpenses > 0 && totalSavings < monthlyExpenses * 3) {
      const targetEmergency = monthlyExpenses * 6; // 6 month emergency fund
      suggestions.push({
        type: "savings",
        name: "Emergency Fund",
        icon: "🆘",
        suggestedAmountCents: Math.round((targetEmergency - totalSavings) * 100),
        source: "plaid_analysis",
        description: `Target: 6 months of expenses (${targetEmergency.toLocaleString("en-US", { style: "currency", currency: "USD" })})`,
      });
    }
    
    return suggestions;
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

/**
 * Get the impact of unlinking a Plaid item.
 * Use this to show a warning dialog before unlinking.
 */
export const getPlaidItemUnlinkImpact = query({
  args: { plaidItemId: v.id("plaidItems") },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const item = await ctx.db.get(plaidItemId);
    if (!item || item.userId !== identity.subject) return null;

    // Get all linked accounts
    const plaidAccounts = await ctx.db
      .query("plaidAccounts")
      .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", plaidItemId))
      .collect();

    // Count transactions
    let transactionsCount = 0;
    for (const plaidAccount of plaidAccounts) {
      const txns = await ctx.db
        .query("plaidTransactions")
        .withIndex("by_plaidAccount", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      transactionsCount += txns.length;
    }

    // Count investment transactions
    let investmentTxnsCount = 0;
    for (const plaidAccount of plaidAccounts) {
      const invTxns = await ctx.db
        .query("plaidInvestmentTransactions")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      investmentTxnsCount += invTxns.length;
    }

    // Count holdings
    let holdingsCount = 0;
    for (const plaidAccount of plaidAccounts) {
      const holdings = await ctx.db
        .query("plaidHoldings")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      holdingsCount += holdings.length;
    }

    // Count liabilities
    let liabilitiesCount = 0;
    for (const plaidAccount of plaidAccounts) {
      const liabilities = await ctx.db
        .query("plaidLiabilities")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      liabilitiesCount += liabilities.length;
    }

    // Count recurring streams
    let streamsCount = 0;
    for (const plaidAccount of plaidAccounts) {
      const streams = await ctx.db
        .query("plaidRecurringStreams")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      streamsCount += streams.length;
    }

    return {
      institutionName: item.institutionName,
      accountsCount: plaidAccounts.length,
      transactionsCount,
      investmentTxnsCount,
      holdingsCount,
      liabilitiesCount,
      recurringStreamsCount: streamsCount,
    };
  },
});

export const unlinkPlaidItem = mutation({
  args: { plaidItemId: v.id("plaidItems") },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    const item = await ctx.db.get(plaidItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }
    
    // Get all linked accounts
    const plaidAccounts = await ctx.db
      .query("plaidAccounts")
      .withIndex("by_plaidItem", (q) => q.eq("plaidItemId", plaidItemId))
      .collect();

    let deletedTransactions = 0;
    let deletedHoldings = 0;
    let deletedLiabilities = 0;
    let deletedStreams = 0;
    let deletedInvestmentTxns = 0;

    for (const plaidAccount of plaidAccounts) {
      // Delete plaid transactions for this account
      const transactions = await ctx.db
        .query("plaidTransactions")
        .withIndex("by_plaidAccount", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      
      for (const txn of transactions) {
        await ctx.db.delete(txn._id);
        deletedTransactions++;
      }

      // Delete plaid investment transactions for this account
      const investmentTxns = await ctx.db
        .query("plaidInvestmentTransactions")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      
      for (const invTxn of investmentTxns) {
        await ctx.db.delete(invTxn._id);
        deletedInvestmentTxns++;
      }

      // Delete plaid holdings for this account
      const holdings = await ctx.db
        .query("plaidHoldings")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      
      for (const holding of holdings) {
        await ctx.db.delete(holding._id);
        deletedHoldings++;
      }

      // Delete plaid liabilities for this account
      const liabilities = await ctx.db
        .query("plaidLiabilities")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      
      for (const liability of liabilities) {
        await ctx.db.delete(liability._id);
        deletedLiabilities++;
      }

      // Delete plaid recurring streams for this account
      // But first, clear the linkedRuleId on any linked recurring rules
      const streams = await ctx.db
        .query("plaidRecurringStreams")
        .withIndex("by_account", (q) => q.eq("plaidAccountId", plaidAccount._id))
        .collect();
      
      for (const stream of streams) {
        // If stream was linked to a recurring rule, we don't delete the rule
        // but we could optionally notify the user
        await ctx.db.delete(stream._id);
        deletedStreams++;
      }

      // Update linked TallyUp account to unlink it
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
    
    return { 
      success: true,
      deletedAccounts: plaidAccounts.length,
      deletedTransactions,
      deletedInvestmentTxns,
      deletedHoldings,
      deletedLiabilities,
      deletedStreams,
      deletedSyncLogs: syncLogs.length,
    };
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
        categoryId: categoryId,
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
            categoryId: categoryId,
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

// ============================================
// RECURRING STREAMS - Internal mutations
// ============================================

export const upsertPlaidRecurringStream = internalMutation({
  args: {
    userId: v.string(),
    plaidAccountId: v.id("plaidAccounts"),
    accountId: v.id("accounts"),
    streamId: v.string(),
    streamType: v.union(v.literal("inflow"), v.literal("outflow")),
    merchantName: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    category: v.optional(v.array(v.string())),
    personalFinanceCategory: v.optional(v.object({
      primary: v.optional(v.string()),
      detailed: v.optional(v.string()),
    })),
    frequency: v.union(
      v.literal("WEEKLY"),
      v.literal("BIWEEKLY"),
      v.literal("SEMI_MONTHLY"),
      v.literal("MONTHLY"),
      v.literal("ANNUALLY"),
      v.literal("UNKNOWN")
    ),
    averageDaysBetween: v.optional(v.number()),
    averageAmountCents: v.number(),
    lastAmountCents: v.number(),
    isAmountVariable: v.optional(v.boolean()),
    firstDate: v.string(),
    lastDate: v.string(),
    predictedNextDate: v.optional(v.string()),
    isActive: v.boolean(),
    status: v.union(
      v.literal("MATURE"),
      v.literal("EARLY_DETECTION"),
      v.literal("TOMBSTONED")
    ),
    transactionIds: v.optional(v.array(v.string())),
    transactionCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if stream already exists
    const existing = await ctx.db
      .query("plaidRecurringStreams")
      .withIndex("by_streamId", (q) => q.eq("streamId", args.streamId))
      .first();
    
    if (existing) {
      // Update existing stream
      await ctx.db.patch(existing._id, {
        streamType: args.streamType,
        merchantName: args.merchantName,
        description: args.description,
        categoryId: args.categoryId,
        category: args.category,
        personalFinanceCategory: args.personalFinanceCategory,
        frequency: args.frequency,
        averageDaysBetween: args.averageDaysBetween,
        averageAmountCents: args.averageAmountCents,
        lastAmountCents: args.lastAmountCents,
        isAmountVariable: args.isAmountVariable,
        firstDate: args.firstDate,
        lastDate: args.lastDate,
        predictedNextDate: args.predictedNextDate,
        isActive: args.isActive,
        status: args.status,
        transactionIds: args.transactionIds,
        transactionCount: args.transactionCount,
        lastSyncedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }
    
    // Create new stream
    return await ctx.db.insert("plaidRecurringStreams", {
      userId: args.userId,
      plaidAccountId: args.plaidAccountId,
      accountId: args.accountId,
      streamId: args.streamId,
      streamType: args.streamType,
      merchantName: args.merchantName,
      description: args.description,
      categoryId: args.categoryId,
      category: args.category,
      personalFinanceCategory: args.personalFinanceCategory,
      frequency: args.frequency,
      averageDaysBetween: args.averageDaysBetween,
      averageAmountCents: args.averageAmountCents,
      lastAmountCents: args.lastAmountCents,
      isAmountVariable: args.isAmountVariable,
      firstDate: args.firstDate,
      lastDate: args.lastDate,
      predictedNextDate: args.predictedNextDate,
      isActive: args.isActive,
      status: args.status,
      transactionIds: args.transactionIds,
      transactionCount: args.transactionCount,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePlaidItemRecurringSyncState = internalMutation({
  args: {
    id: v.id("plaidItems"),
    lastRecurringSyncAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastRecurringSyncAt: args.lastRecurringSyncAt,
      updatedAt: Date.now(),
    });
  },
});

export const linkRecurringStreamToRule = internalMutation({
  args: {
    streamId: v.id("plaidRecurringStreams"),
    recurringRuleId: v.id("recurringRules"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.streamId, {
      recurringRuleId: args.recurringRuleId,
      updatedAt: Date.now(),
    });
  },
});

export const getPlaidRecurringStreamsByUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("plaidRecurringStreams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getUnlinkedPlaidRecurringStreams = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const streams = await ctx.db
      .query("plaidRecurringStreams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Return streams that don't have a recurringRuleId
    return streams.filter(s => !s.recurringRuleId && s.isActive);
  },
});

// Get suggested budget amounts based on Plaid recurring data
export const getPlaidBudgetSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Get all active outflow recurring streams
    const streams = await ctx.db
      .query("plaidRecurringStreams")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    const activeOutflows = streams.filter(
      s => s.streamType === "outflow" && s.isActive
    );
    
    // Group by category and calculate monthly amounts
    const categoryMap = new Map<string, { totalMonthlyCents: number; count: number; examples: string[] }>();
    
    for (const stream of activeOutflows) {
      // Use Plaid's category or personal finance category
      const category = stream.personalFinanceCategory?.primary || 
                       stream.category?.[0] || 
                       "Other";
      
      // Convert to monthly amount based on frequency
      let monthlyCents = Math.abs(stream.averageAmountCents);
      switch (stream.frequency) {
        case "WEEKLY": monthlyCents *= 4.33; break;
        case "BIWEEKLY": monthlyCents *= 2.17; break;
        case "SEMI_MONTHLY": monthlyCents *= 2; break;
        case "ANNUALLY": monthlyCents /= 12; break;
        // MONTHLY stays as-is
      }
      
      const existing = categoryMap.get(category) || { totalMonthlyCents: 0, count: 0, examples: [] };
      existing.totalMonthlyCents += monthlyCents;
      existing.count += 1;
      if (existing.examples.length < 3) {
        existing.examples.push(stream.merchantName || stream.description || "Unknown");
      }
      categoryMap.set(category, existing);
    }
    
    // Map Plaid categories to TallyUp budget categories
    const plaidToBudgetMap: Record<string, string> = {
      "RENT_AND_UTILITIES": "utilities",
      "UTILITIES": "utilities",
      "TRANSPORTATION": "transportation",
      "TRAVEL": "transportation",
      "FOOD_AND_DRINK": "food",
      "GROCERIES": "food",
      "RESTAURANTS": "food",
      "ENTERTAINMENT": "entertainment",
      "RECREATION": "entertainment",
      "PERSONAL_CARE": "personal",
      "GENERAL_MERCHANDISE": "personal",
      "HEALTHCARE": "healthcare",
      "MEDICAL": "healthcare",
      "INSURANCE": "insurance",
      "LOAN_PAYMENTS": "debt",
      "CREDIT_CARD": "debt",
      "BANK_FEES": "debt",
      "TRANSFER_OUT": "savings",
      "INCOME": "income", // Filter out
    };
    
    const suggestions: Array<{
      budgetCategory: string;
      suggestedMonthlyCents: number;
      streamCount: number;
      examples: string[];
      plaidCategory: string;
    }> = [];
    
    for (const [plaidCat, data] of categoryMap) {
      const budgetCat = plaidToBudgetMap[plaidCat] || "personal";
      if (budgetCat === "income") continue; // Skip income streams
      
      suggestions.push({
        budgetCategory: budgetCat,
        suggestedMonthlyCents: Math.round(data.totalMonthlyCents),
        streamCount: data.count,
        examples: data.examples,
        plaidCategory: plaidCat,
      });
    }
    
    // Sort by amount (highest first)
    return suggestions.sort((a, b) => b.suggestedMonthlyCents - a.suggestedMonthlyCents);
  },
});

// Get suggested category rules based on Plaid transaction merchant data
export const getPlaidMerchantRuleSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Get recent Plaid transactions
    const transactions = await ctx.db
      .query("plaidTransactions")
      .withIndex("by_user_importStatus", (q) => 
        q.eq("userId", identity.subject).eq("importStatus", "imported")
      )
      .collect();
    
    // Get existing category rules to avoid duplicates
    const existingRules = await ctx.db
      .query("categoryRules")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    const existingMerchants = new Set(
      existingRules
        .map(r => r.matchMerchantContains?.toLowerCase() || r.matchMerchantExact?.toLowerCase())
        .filter(Boolean)
    );
    
    // Group by merchant name and category
    const merchantCategories = new Map<string, { 
      category: string;
      count: number; 
      totalCents: number;
      plaidCategory: string;
    }>();
    
    for (const tx of transactions) {
      const merchant = tx.merchantName || tx.name;
      if (!merchant) continue;
      
      const normalizedMerchant = merchant.toLowerCase().trim();
      
      // Skip if we already have a rule for this merchant
      if (existingMerchants.has(normalizedMerchant)) continue;
      
      const category = tx.category || "Other";
      const key = `${normalizedMerchant}:${category}`;
      
      const existing = merchantCategories.get(key) || {
        category,
        count: 0,
        totalCents: 0,
        plaidCategory: tx.categoryDetailed || tx.category || "",
      };
      
      existing.count += 1;
      existing.totalCents += Math.abs(Math.round((tx.amount || 0) * 100));
      merchantCategories.set(key, existing);
    }
    
    // Map Plaid categories to TallyUp categories
    const plaidToCategoryMap: Record<string, string> = {
      "FOOD_AND_DRINK": "Food & Dining",
      "GROCERIES": "Groceries",
      "RESTAURANTS": "Restaurants",
      "TRANSPORTATION": "Transportation",
      "TRAVEL": "Travel",
      "ENTERTAINMENT": "Entertainment",
      "PERSONAL_CARE": "Personal Care",
      "HEALTHCARE": "Health",
      "UTILITIES": "Utilities",
      "RENT_AND_UTILITIES": "Housing",
      "GENERAL_MERCHANDISE": "Shopping",
      "SHOPPING": "Shopping",
    };
    
    // Build suggestions from merchants with 2+ transactions
    const suggestions: Array<{
      merchantName: string;
      suggestedCategory: string;
      plaidCategory: string;
      transactionCount: number;
      totalAmountCents: number;
    }> = [];
    
    const seenMerchants = new Set<string>();
    
    for (const [key, data] of merchantCategories) {
      const [merchant] = key.split(":");
      
      // Only suggest if 2+ transactions and not seen
      if (data.count < 2) continue;
      if (seenMerchants.has(merchant)) continue;
      
      seenMerchants.add(merchant);
      
      const suggestedCategory = plaidToCategoryMap[data.plaidCategory.toUpperCase()] || 
                                data.category || 
                                "Other";
      
      suggestions.push({
        merchantName: merchant,
        suggestedCategory,
        plaidCategory: data.plaidCategory,
        transactionCount: data.count,
        totalAmountCents: data.totalCents,
      });
    }
    
    // Sort by transaction count (most frequent first)
    return suggestions
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, 10); // Top 10 suggestions
  },
});
