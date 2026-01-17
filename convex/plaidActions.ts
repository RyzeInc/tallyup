/**
 * Plaid API Actions
 * 
 * These are Convex actions that make HTTP calls to the Plaid API.
 * Actions can make external requests but must use ctx.runQuery/ctx.runMutation
 * to access the database.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

// Type aliases for clarity
type PlaidItem = Doc<"plaidItems">;
type PlaidAccount = Doc<"plaidAccounts">;

// Initialize Plaid client
function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";
  
  if (!clientId || !secret) {
    throw new Error("Missing Plaid credentials. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables.");
  }
  
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  
  return new PlaidApi(configuration);
}

// ============================================
// LINK TOKEN CREATION
// ============================================

export const createLinkToken = action({
  args: {
    // Optional: for update mode (reconnecting an existing item)
    accessToken: v.optional(v.string()),
    // Optional: specific products to request (defaults to transactions + investments + liabilities)
    products: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { accessToken, products: requestedProducts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Default products: Transactions, Investments, Liabilities
    // Note: Income requires additional user consent flow
    // Note: Enrich is a separate API call, not a Link product
    let productsToRequest: Products[] = [
      Products.Transactions,
      Products.Investments,
      Products.Liabilities,
    ];
    
    // Allow caller to override products
    if (requestedProducts && requestedProducts.length > 0) {
      const productMap: Record<string, Products> = {
        "transactions": Products.Transactions,
        "investments": Products.Investments,
        "liabilities": Products.Liabilities,
        "auth": Products.Auth,
        "identity": Products.Identity,
        "assets": Products.Assets,
        "income": Products.Income,
        "income_verification": Products.IncomeVerification,
      };
      productsToRequest = requestedProducts
        .map(p => productMap[p.toLowerCase()])
        .filter((p): p is Products => p !== undefined);
    }
    
    const request: Parameters<typeof plaidClient.linkTokenCreate>[0] = {
      user: {
        client_user_id: identity.subject,
      },
      client_name: "TallyUp",
      products: accessToken ? [] : productsToRequest,
      country_codes: [CountryCode.Us],
      language: "en",
    };
    
    // If we have an access token, this is update mode
    if (accessToken) {
      request.access_token = accessToken;
    }
    
    // Add redirect URI only when OAuth is explicitly enabled and redirect URI is configured
    // This avoids Plaid rejecting requests when the redirect URI hasn't been registered
    // in the Plaid developer dashboard.
    const enableOauth = process.env.PLAID_ENABLE_OAUTH === "true";
    const redirectUri = process.env.PLAID_REDIRECT_URI;
    if (enableOauth && redirectUri) {
      request.redirect_uri = redirectUri;
    }
    
    try {
      // Diagnostic: log which products we're requesting
      console.info("[plaid] createLinkToken: products=", productsToRequest.map(p => String(p)));
      const response = await plaidClient.linkTokenCreate(request);
      
      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error: unknown) {
      console.error("Error creating link token:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create link token: ${message}`);
    }
  },
});

// ============================================
// PUBLIC TOKEN EXCHANGE
// ============================================

export const exchangePublicToken = action({
  args: {
    publicToken: v.string(),
    institutionId: v.optional(v.string()),
    institutionName: v.optional(v.string()),
  },
  handler: async (ctx, { publicToken, institutionId, institutionName }): Promise<{
    success: boolean;
    plaidItemId: string;
    institutionName: string | undefined;
    accountCount: number;
    accounts: Array<{
      plaidAccountId: string;
      tallyUpAccountId: string;
      name: string | null;
      type: string;
      mask: string | null;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    try {
      // Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });
      
      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;
      
      // Get institution details if not provided
      let instName = institutionName;
      let instLogo: string | undefined;
      let instColor: string | undefined;
      
      if (institutionId) {
        try {
          const instResponse = await plaidClient.institutionsGetById({
            institution_id: institutionId,
            country_codes: [CountryCode.Us],
            options: {
              include_optional_metadata: true,
            },
          });
          
          instName = instResponse.data.institution.name;
          instLogo = instResponse.data.institution.logo || undefined;
          instColor = instResponse.data.institution.primary_color || undefined;
        } catch {
          console.warn("Could not fetch institution details");
        }
      }
      
      // Create the Plaid item in the database
      const plaidItemId = await ctx.runMutation(internal.plaid.createPlaidItem, {
        userId: identity.subject,
        itemId,
        accessToken,
        institutionId,
        institutionName: instName,
        institutionLogo: instLogo,
        institutionColor: instColor,
      });
      
      // Get accounts for this item
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });
      
      // Account type mapping
      const accountTypeMap: Record<string, "checking" | "savings" | "credit" | "investment" | "loan" | "other"> = {
        depository: "checking",
        checking: "checking",
        savings: "savings",
        credit: "credit",
        loan: "loan",
        investment: "investment",
        mortgage: "loan",
        brokerage: "investment",
      };
      
      // Create TallyUp accounts and link them
      const linkedAccounts = [];
      
      for (const account of accountsResponse.data.accounts) {
        const accountType = accountTypeMap[account.subtype?.toLowerCase() ?? ""] 
          || accountTypeMap[account.type?.toLowerCase() ?? ""] 
          || "other";
        
        // Create TallyUp account
        const tallyUpAccountId = await ctx.runMutation(internal.plaid.createTallyUpAccount, {
          userId: identity.subject,
          name: account.name,
          type: accountType,
          institutionName: instName,
          last4: account.mask || undefined,
          creditLimit: account.balances.limit ? Math.round(account.balances.limit * 100) : undefined,
          initialBalanceCents: account.balances.current !== null && account.balances.current !== undefined
            ? Math.round(account.balances.current * 100)
            : undefined,
          isLinked: true,
          plaidAccountId: account.account_id,
        });
        
        // Create Plaid account link
        const plaidAccountId = await ctx.runMutation(internal.plaid.createPlaidAccount, {
          userId: identity.subject,
          plaidItemId,
          accountId: tallyUpAccountId,
          plaidAccountId: account.account_id,
          name: account.name,
          officialName: account.official_name || undefined,
          type: account.type,
          subtype: account.subtype || undefined,
          mask: account.mask || undefined,
          balanceCurrent: account.balances.current ?? undefined,
          balanceAvailable: account.balances.available ?? undefined,
          balanceLimit: account.balances.limit ?? undefined,
          currency: account.balances.iso_currency_code || undefined,
        });
        
        linkedAccounts.push({
          plaidAccountId,
          tallyUpAccountId,
          name: account.name,
          type: accountType,
          mask: account.mask,
        });
      }
      
      return {
        success: true,
        plaidItemId,
        institutionName: instName,
        accountCount: linkedAccounts.length,
        accounts: linkedAccounts,
      };
    } catch (error: unknown) {
      console.error("Error exchanging public token:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to exchange token: ${message}`);
    }
  },
});

// ============================================
// TRANSACTION SYNC
// ============================================

// Helper to extract transaction data from Plaid response
function extractTransactionData(txn: {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  datetime?: string | null;
  authorized_date?: string | null;
  authorized_datetime?: string | null;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  pending_transaction_id?: string | null;
  personal_finance_category?: {
    primary?: string;
    detailed?: string;
    confidence_level?: string;
  } | null;
  personal_finance_category_icon_url?: string;
  payment_channel: string;
  transaction_type?: string | null;
  transaction_code?: string | null;
  check_number?: string | null;
  location?: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    postal_code?: string | null;
    address?: string | null;
    lat?: number | null;
    lon?: number | null;
    store_number?: string | null;
  } | null;
  logo_url?: string | null;
  website?: string | null;
  merchant_entity_id?: string | null;
  counterparties?: Array<{
    name?: string | null;
    type?: string | null;
    logo_url?: string | null;
    website?: string | null;
    entity_id?: string | null;
    phone_number?: string | null;
    confidence_level?: string | null;
  }> | null;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
}) {
  return {
    plaidTransactionId: txn.transaction_id,
    pendingTransactionId: txn.pending_transaction_id || undefined,
    amount: txn.amount,
    date: txn.date,
    datetime: txn.datetime || undefined,
    authorizedDate: txn.authorized_date || undefined,
    authorizedDatetime: txn.authorized_datetime || undefined,
    name: txn.name,
    merchantName: txn.merchant_name || undefined,
    pending: txn.pending,
    category: txn.personal_finance_category?.primary,
    categoryDetailed: txn.personal_finance_category?.detailed,
    categoryConfidence: txn.personal_finance_category?.confidence_level ?? undefined,
    categoryIconUrl: txn.personal_finance_category_icon_url || undefined,
    paymentChannel: txn.payment_channel,
    transactionType: txn.transaction_type || undefined,
    transactionCode: txn.transaction_code || undefined,
    checkNumber: txn.check_number || undefined,
    locationCity: txn.location?.city || undefined,
    locationRegion: txn.location?.region || undefined,
    locationCountry: txn.location?.country || undefined,
    locationPostalCode: txn.location?.postal_code || undefined,
    locationAddress: txn.location?.address || undefined,
    locationLat: txn.location?.lat ?? undefined,
    locationLon: txn.location?.lon ?? undefined,
    locationStoreNumber: txn.location?.store_number || undefined,
    logoUrl: txn.logo_url || undefined,
    website: txn.website || undefined,
    merchantEntityId: txn.merchant_entity_id || undefined,
    counterparties: txn.counterparties?.map(cp => ({
      name: cp.name || undefined,
      type: cp.type || undefined,
      logoUrl: cp.logo_url || undefined,
      website: cp.website || undefined,
      entityId: cp.entity_id || undefined,
      phoneNumber: cp.phone_number || undefined,
      confidenceLevel: cp.confidence_level || undefined,
    })),
    isoCurrencyCode: txn.iso_currency_code || undefined,
    unofficialCurrencyCode: txn.unofficial_currency_code || undefined,
  };
}

export const syncTransactions = action({
  args: {
    plaidItemId: v.id("plaidItems"),
    syncType: v.optional(v.union(
      v.literal("initial"),
      v.literal("incremental"),
      v.literal("manual")
    )),
  },
  handler: async (ctx, { plaidItemId, syncType = "incremental" }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    // Get linked accounts
    const plaidAccounts = await ctx.runQuery(internal.plaid.getPlaidAccountsByItem, {
      plaidItemId,
    }) as PlaidAccount[];
    
    // Create account ID map
    const accountIdMap = new Map(
      plaidAccounts.map((a: PlaidAccount) => [a.plaidAccountId, a._id])
    );
    
    // Create sync log
    const syncLogId = await ctx.runMutation(internal.plaid.createSyncLog, {
      userId: identity.subject,
      plaidItemId,
      syncType,
    });
    
    let cursor = item.transactionCursor;
    let added = 0;
    let modified = 0;
    let removed = 0;
    let hasMore = true;
    
    try {
      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor: cursor || undefined,
          count: 500,
        });
        
        const data = response.data;
        
        // Process added transactions
        for (const txn of data.added) {
          const plaidAccountIdInternal = accountIdMap.get(txn.account_id);
          if (!plaidAccountIdInternal) continue;
          
          const txnData = extractTransactionData(txn as Parameters<typeof extractTransactionData>[0]);
          await ctx.runMutation(internal.plaid.upsertPlaidTransaction, {
            userId: identity.subject,
            plaidAccountId: plaidAccountIdInternal,
            ...txnData,
          });
          added++;
        }
        
        // Process modified transactions
        for (const txn of data.modified) {
          const plaidAccountIdInternal = accountIdMap.get(txn.account_id);
          if (!plaidAccountIdInternal) continue;
          
          const txnData = extractTransactionData(txn as Parameters<typeof extractTransactionData>[0]);
          await ctx.runMutation(internal.plaid.upsertPlaidTransaction, {
            userId: identity.subject,
            plaidAccountId: plaidAccountIdInternal,
            ...txnData,
          });
          modified++;
        }
        
        // Process removed transactions
        for (const txn of data.removed) {
          await ctx.runMutation(internal.plaid.removePlaidTransaction, {
            plaidTransactionId: txn.transaction_id || "",
          });
          removed++;
        }
        
        cursor = data.next_cursor;
        hasMore = data.has_more;
      }
      
      // Update cursor on item
      await ctx.runMutation(internal.plaid.updatePlaidItemCursor, {
        id: plaidItemId,
        cursor: cursor || "",
        lastSyncedAt: Date.now(),
      });
      
      // Complete sync log
      await ctx.runMutation(internal.plaid.completeSyncLog, {
        id: syncLogId,
        status: "completed",
        transactionsAdded: added,
        transactionsModified: modified,
        transactionsRemoved: removed,
      });
      
      return {
        success: true,
        added,
        modified,
        removed,
      };
    } catch (error: unknown) {
      console.error("Error syncing transactions:", error);
      
      // Check for specific Plaid errors
      const errorData = error as { response?: { data?: { error_code?: string; error_message?: string } } };
      const errorCode = errorData.response?.data?.error_code;
      const errorMessage = errorData.response?.data?.error_message || 
        (error instanceof Error ? error.message : "Unknown error");
      
      // Update item status if auth error
      if (errorCode === "ITEM_LOGIN_REQUIRED") {
        await ctx.runMutation(internal.plaid.updatePlaidItemStatus, {
          id: plaidItemId,
          status: "needs_reauth",
          errorCode,
          errorMessage,
        });
      }
      
      // Complete sync log with error
      await ctx.runMutation(internal.plaid.completeSyncLog, {
        id: syncLogId,
        status: "failed",
        errorCode,
        errorMessage,
      });
      
      throw new Error(`Failed to sync transactions: ${errorMessage}`);
    }
  },
});

// ============================================
// BALANCE REFRESH
// ============================================

export const refreshBalances = action({
  args: {
    plaidItemId: v.id("plaidItems"),
  },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    // Get linked accounts
    const plaidAccounts = await ctx.runQuery(internal.plaid.getPlaidAccountsByItem, {
      plaidItemId,
    }) as PlaidAccount[];
    
    try {
      const response = await plaidClient.accountsBalanceGet({
        access_token: item.accessToken,
      });
      
      const now = Date.now();
      
      for (const account of response.data.accounts) {
        const plaidAccount = plaidAccounts.find((a: PlaidAccount) => a.plaidAccountId === account.account_id);
        if (!plaidAccount) continue;
        
        await ctx.runMutation(internal.plaid.updatePlaidAccountBalances, {
          id: plaidAccount._id,
          balanceCurrent: account.balances.current ?? undefined,
          balanceAvailable: account.balances.available ?? undefined,
          balanceLimit: account.balances.limit ?? undefined,
          lastSyncedAt: now,
        });

        if (account.balances.current !== null && account.balances.current !== undefined) {
          await ctx.runMutation(internal.accounts.addAccountSnapshotInternal, {
            userId: identity.subject,
            accountId: plaidAccount.accountId,
            balanceCents: Math.round(account.balances.current * 100),
            asOf: now,
          });
        }
      }
      
      return {
        success: true,
        accountsUpdated: response.data.accounts.length,
      };
    } catch (error: unknown) {
      console.error("Error refreshing balances:", error);
      
      // Extract Plaid error details if available
      let errorCode: string | undefined;
      let message = "Unknown error";
      
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: { error_code?: string; error_message?: string } } };
        errorCode = axiosError.response?.data?.error_code;
        message = axiosError.response?.data?.error_message || message;
        
        // If the item needs re-authentication, update the status
        if (errorCode === "ITEM_LOGIN_REQUIRED") {
          await ctx.runMutation(internal.plaid.updatePlaidItemStatus, {
            id: plaidItemId,
            status: "needs_reauth",
            errorCode,
            errorMessage: message,
          });
          throw new Error("Bank connection needs re-authentication. Please reconnect this account.");
        }
        
        // Handle invalid access token (sandbox expired or revoked)
        if (errorCode === "INVALID_ACCESS_TOKEN") {
          await ctx.runMutation(internal.plaid.updatePlaidItemStatus, {
            id: plaidItemId,
            status: "error",
            errorCode,
            errorMessage: message,
          });
          throw new Error("Bank connection is invalid. Please unlink and reconnect this account.");
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      throw new Error(`Failed to refresh balances: ${message}`);
    }
  },
});

// ============================================
// REMOVE ITEM (UNLINK INSTITUTION)
// ============================================

export const removeItem = action({
  args: {
    plaidItemId: v.id("plaidItems"),
  },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    try {
      // Remove the item from Plaid
      await plaidClient.itemRemove({
        access_token: item.accessToken,
      });
    } catch (error) {
      // Log but don't fail - we still want to clean up our database
      console.warn("Error removing item from Plaid:", error);
    }
    
    // Clean up our database (this is a mutation, not an action)
    // Note: We use the mutation exported from plaid.ts
    // But since we're in an action, we need to use runMutation with api
    // However, unlinkPlaidItem is a public mutation, so we can call it via api
    // For now, let's just update the status
    await ctx.runMutation(internal.plaid.updatePlaidItemStatus, {
      id: plaidItemId,
      status: "revoked",
    });
    
    return { success: true };
  },
});

// ============================================
// GET LINK TOKEN FOR UPDATE (REAUTH)
// ============================================

export const createUpdateLinkToken = action({
  args: {
    plaidItemId: v.id("plaidItems"),
  },
  handler: async (ctx, { plaidItemId }): Promise<{ linkToken: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    // Create a link token in update mode (inline to avoid internal action call)
    const plaidClient = getPlaidClient();
    
    const request: Parameters<typeof plaidClient.linkTokenCreate>[0] = {
      user: {
        client_user_id: identity.subject,
      },
      client_name: "TallyUp",
      products: [], // No products needed for update mode
      country_codes: [CountryCode.Us],
      language: "en",
      access_token: item.accessToken,
    };
    
    const redirectUri = process.env.PLAID_REDIRECT_URI;
    if (redirectUri) {
      request.redirect_uri = redirectUri;
    }
    
    try {
      const response = await plaidClient.linkTokenCreate(request);
      return {
        linkToken: response.data.link_token,
      };
    } catch (error: unknown) {
      console.error("Error creating update link token:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create update link token: ${message}`);
    }
  },
});

// ============================================
// INVESTMENTS SYNC
// ============================================

// Security type mapping from Plaid to TallyUp asset types
// Exported for use in investment sync and UI components
export const PLAID_SECURITY_TYPE_MAP: Record<string, string> = {
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

export const syncInvestments = action({
  args: {
    plaidItemId: v.id("plaidItems"),
  },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    // Get linked accounts for mapping
    const plaidAccounts = await ctx.runQuery(internal.plaid.getPlaidAccountsByItem, {
      plaidItemId,
    }) as PlaidAccount[];
    
    const accountIdMap = new Map(
      plaidAccounts.map((a: PlaidAccount) => [a.plaidAccountId, a._id])
    );
    
    try {
      // Fetch investment holdings
      const holdingsResponse = await plaidClient.investmentsHoldingsGet({
        access_token: item.accessToken,
      });
      
      const { holdings, securities, accounts } = holdingsResponse.data;
      
      // First, upsert all securities
      const securityIdMap = new Map<string, string>(); // Plaid security_id -> our _id
      
      for (const security of securities) {
        const plaidSecurityId = await ctx.runMutation(internal.plaid.upsertPlaidSecurity, {
          securityId: security.security_id,
          isin: security.isin || undefined,
          cusip: security.cusip || undefined,
          sedol: security.sedol || undefined,
          institutionSecurityId: security.institution_security_id || undefined,
          institutionId: security.institution_id || undefined,
          tickerSymbol: security.ticker_symbol || undefined,
          name: security.name || "Unknown Security",
          securityType: security.type || "other",
          isCashEquivalent: security.is_cash_equivalent ?? undefined,
          closePrice: security.close_price ?? undefined,
          closePriceAsOf: security.close_price_as_of || undefined,
          isoCurrencyCode: security.iso_currency_code || undefined,
          unofficialCurrencyCode: security.unofficial_currency_code || undefined,
        });
        securityIdMap.set(security.security_id, plaidSecurityId);
      }
      
      // Update account balances
      for (const account of accounts) {
        const plaidAccountIdInternal = accountIdMap.get(account.account_id);
        if (!plaidAccountIdInternal) continue;
        
        await ctx.runMutation(internal.plaid.updatePlaidAccountBalances, {
          id: plaidAccountIdInternal,
          balanceCurrent: account.balances.current ?? undefined,
          balanceAvailable: account.balances.available ?? undefined,
          balanceLimit: account.balances.limit ?? undefined,
          lastSyncedAt: Date.now(),
        });
      }
      
      // Upsert holdings
      let holdingsCount = 0;
      for (const holding of holdings) {
        const plaidAccountIdInternal = accountIdMap.get(holding.account_id);
        if (!plaidAccountIdInternal) continue;
        
        const plaidSecurityIdInternal = securityIdMap.get(holding.security_id);
        if (!plaidSecurityIdInternal) continue;
        
        await ctx.runMutation(internal.plaid.upsertPlaidHolding, {
          userId: identity.subject,
          plaidAccountId: plaidAccountIdInternal,
          plaidSecurityId: plaidSecurityIdInternal as Id<"plaidSecurities">,
          quantity: holding.quantity,
          institutionPrice: holding.institution_price,
          institutionPriceAsOf: holding.institution_price_as_of || undefined,
          institutionPriceDatetime: holding.institution_price_datetime || undefined,
          institutionValue: holding.institution_value ?? undefined,
          costBasis: holding.cost_basis ?? undefined,
          vestedQuantity: holding.vested_quantity ?? undefined,
          vestedValue: holding.vested_value ?? undefined,
          unvestedQuantity: holding.unvested_quantity ?? undefined,
          unvestedValue: holding.unvested_value ?? undefined,
          isoCurrencyCode: holding.iso_currency_code || undefined,
        });
        holdingsCount++;
      }
      
      // Update sync state
      await ctx.runMutation(internal.plaid.updatePlaidItemInvestmentsSyncState, {
        id: plaidItemId,
        lastInvestmentsSyncAt: Date.now(),
      });
      
      return {
        success: true,
        securitiesCount: securities.length,
        holdingsCount,
        accountsCount: accounts.length,
      };
    } catch (error: unknown) {
      console.error("Error syncing investments:", error);
      
      // Extract Plaid error details
      let errorCode: string | undefined;
      let message = "Unknown error";
      
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: { error_code?: string; error_message?: string } } };
        errorCode = axiosError.response?.data?.error_code;
        message = axiosError.response?.data?.error_message || message;
        
        if (errorCode === "ITEM_LOGIN_REQUIRED") {
          await ctx.runMutation(internal.plaid.updatePlaidItemStatus, {
            id: plaidItemId,
            status: "needs_reauth",
            errorCode,
            errorMessage: message,
          });
          throw new Error("Bank connection needs re-authentication. Please reconnect this account.");
        }
        
        // PRODUCTS_NOT_SUPPORTED means investments not available for this item
        if (errorCode === "PRODUCTS_NOT_SUPPORTED") {
          console.info("Investments not supported for this item");
          return {
            success: false,
            error: "Investments product not available for this institution",
          };
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      
      throw new Error(`Failed to sync investments: ${message}`);
    }
  },
});

export const syncInvestmentTransactions = action({
  args: {
    plaidItemId: v.id("plaidItems"),
    startDate: v.optional(v.string()), // YYYY-MM-DD format
    endDate: v.optional(v.string()),   // YYYY-MM-DD format
  },
  handler: async (ctx, { plaidItemId, startDate, endDate }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    // Get linked accounts
    const plaidAccounts = await ctx.runQuery(internal.plaid.getPlaidAccountsByItem, {
      plaidItemId,
    }) as PlaidAccount[];
    
    const accountIdMap = new Map(
      plaidAccounts.map((a: PlaidAccount) => [a.plaidAccountId, a._id])
    );
    
    // Default date range: last 30 days
    const end = endDate || new Date().toISOString().split("T")[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    try {
      const response = await plaidClient.investmentsTransactionsGet({
        access_token: item.accessToken,
        start_date: start,
        end_date: end,
      });
      
      const { investment_transactions, securities } = response.data;
      
      // First, ensure all securities are in the database
      const securityIdMap = new Map<string, string>();
      
      for (const security of securities) {
        const plaidSecurityId = await ctx.runMutation(internal.plaid.upsertPlaidSecurity, {
          securityId: security.security_id,
          isin: security.isin || undefined,
          cusip: security.cusip || undefined,
          sedol: security.sedol || undefined,
          institutionSecurityId: security.institution_security_id || undefined,
          institutionId: security.institution_id || undefined,
          tickerSymbol: security.ticker_symbol || undefined,
          name: security.name || "Unknown Security",
          securityType: security.type || "other",
          isCashEquivalent: security.is_cash_equivalent ?? undefined,
          closePrice: security.close_price ?? undefined,
          closePriceAsOf: security.close_price_as_of || undefined,
          isoCurrencyCode: security.iso_currency_code || undefined,
          unofficialCurrencyCode: security.unofficial_currency_code || undefined,
        });
        securityIdMap.set(security.security_id, plaidSecurityId);
      }
      
      // Upsert investment transactions
      let transactionsCount = 0;
      for (const txn of investment_transactions) {
        const plaidAccountIdInternal = accountIdMap.get(txn.account_id);
        if (!plaidAccountIdInternal) continue;
        
        const plaidSecurityIdInternal = txn.security_id 
          ? securityIdMap.get(txn.security_id) 
          : undefined;
        
        await ctx.runMutation(internal.plaid.upsertPlaidInvestmentTransaction, {
          userId: identity.subject,
          plaidAccountId: plaidAccountIdInternal,
          plaidSecurityId: plaidSecurityIdInternal as Id<"plaidSecurities"> | undefined,
          investmentTransactionId: txn.investment_transaction_id,
          date: txn.date,
          name: txn.name,
          quantity: txn.quantity,
          amount: txn.amount,
          price: txn.price,
          fees: txn.fees ?? undefined,
          transactionType: txn.type,
          subtype: txn.subtype || undefined,
          isoCurrencyCode: txn.iso_currency_code || undefined,
        });
        transactionsCount++;
      }
      
      return {
        success: true,
        transactionsCount,
        securitiesCount: securities.length,
      };
    } catch (error: unknown) {
      console.error("Error syncing investment transactions:", error);
      
      let message = "Unknown error";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: { error_code?: string; error_message?: string } } };
        const errorCode = axiosError.response?.data?.error_code;
        message = axiosError.response?.data?.error_message || message;
        
        if (errorCode === "PRODUCTS_NOT_SUPPORTED") {
          return {
            success: false,
            error: "Investment transactions not available for this institution",
          };
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      
      throw new Error(`Failed to sync investment transactions: ${message}`);
    }
  },
});

// ============================================
// LIABILITIES SYNC
// ============================================

export const syncLiabilities = action({
  args: {
    plaidItemId: v.id("plaidItems"),
  },
  handler: async (ctx, { plaidItemId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    // Get the Plaid item
    const items = await ctx.runQuery(internal.plaid.getUserPlaidItems, {
      userId: identity.subject,
    }) as PlaidItem[];
    
    const item = items.find((i: PlaidItem) => i._id === plaidItemId);
    if (!item) throw new Error("Plaid item not found");
    
    // Get linked accounts
    const plaidAccounts = await ctx.runQuery(internal.plaid.getPlaidAccountsByItem, {
      plaidItemId,
    }) as PlaidAccount[];
    
    const accountMap = new Map(
      plaidAccounts.map((a: PlaidAccount) => [a.plaidAccountId, a])
    );
    
    try {
      const response = await plaidClient.liabilitiesGet({
        access_token: item.accessToken,
      });
      
      const { liabilities, accounts } = response.data;
      
      // Update account balances
      for (const account of accounts) {
        const plaidAccount = accountMap.get(account.account_id);
        if (!plaidAccount) continue;
        
        await ctx.runMutation(internal.plaid.updatePlaidAccountBalances, {
          id: plaidAccount._id,
          balanceCurrent: account.balances.current ?? undefined,
          balanceAvailable: account.balances.available ?? undefined,
          balanceLimit: account.balances.limit ?? undefined,
          lastSyncedAt: Date.now(),
        });
      }
      
      let creditCount = 0;
      let mortgageCount = 0;
      let studentCount = 0;
      
      // Process credit card liabilities
      if (liabilities.credit) {
        for (const credit of liabilities.credit) {
          const plaidAccount = accountMap.get(credit.account_id || "");
          if (!plaidAccount) continue;
          
          await ctx.runMutation(internal.plaid.upsertPlaidLiability, {
            userId: identity.subject,
            plaidAccountId: plaidAccount._id,
            accountId: plaidAccount.accountId,
            liabilityType: "credit",
            isOverdue: credit.is_overdue ?? undefined,
            lastPaymentAmount: credit.last_payment_amount ?? undefined,
            lastPaymentDate: credit.last_payment_date || undefined,
            lastStatementIssueDate: credit.last_statement_issue_date || undefined,
            lastStatementBalance: credit.last_statement_balance ?? undefined,
            minimumPaymentAmount: credit.minimum_payment_amount ?? undefined,
            nextPaymentDueDate: credit.next_payment_due_date || undefined,
            aprs: credit.aprs?.map((apr) => ({
              aprPercentage: apr.apr_percentage,
              aprType: apr.apr_type,
              balanceSubjectToApr: apr.balance_subject_to_apr ?? undefined,
              interestChargeAmount: apr.interest_charge_amount ?? undefined,
            })),
          });
          creditCount++;
        }
      }
      
      // Process mortgage liabilities
      if (liabilities.mortgage) {
        for (const mortgage of liabilities.mortgage) {
          const plaidAccount = accountMap.get(mortgage.account_id);
          if (!plaidAccount) continue;
          
          await ctx.runMutation(internal.plaid.upsertPlaidLiability, {
            userId: identity.subject,
            plaidAccountId: plaidAccount._id,
            accountId: plaidAccount.accountId,
            liabilityType: "mortgage",
            accountNumber: mortgage.account_number || undefined,
            currentLateFee: mortgage.current_late_fee ?? undefined,
            escrowBalance: mortgage.escrow_balance ?? undefined,
            hasPmi: mortgage.has_pmi ?? undefined,
            hasPrepaymentPenalty: mortgage.has_prepayment_penalty ?? undefined,
            interestRate: mortgage.interest_rate ? {
              percentage: mortgage.interest_rate.percentage,
              type: mortgage.interest_rate.type,
            } : undefined,
            lastPaymentAmount: mortgage.last_payment_amount ?? undefined,
            lastPaymentDate: mortgage.last_payment_date || undefined,
            loanTerm: mortgage.loan_term || undefined,
            loanTypeDescription: mortgage.loan_type_description || undefined,
            maturityDate: mortgage.maturity_date || undefined,
            nextMonthlyPayment: mortgage.next_monthly_payment ?? undefined,
            nextPaymentDueDate: mortgage.next_payment_due_date || undefined,
            originationDate: mortgage.origination_date || undefined,
            originationPrincipalAmount: mortgage.origination_principal_amount ?? undefined,
            pastDueAmount: mortgage.past_due_amount ?? undefined,
            propertyAddress: mortgage.property_address ? {
              city: mortgage.property_address.city || undefined,
              region: mortgage.property_address.region || undefined,
              street: mortgage.property_address.street || undefined,
              postalCode: mortgage.property_address.postal_code || undefined,
              country: mortgage.property_address.country || undefined,
            } : undefined,
            ytdInterestPaid: mortgage.ytd_interest_paid ?? undefined,
            ytdPrincipalPaid: mortgage.ytd_principal_paid ?? undefined,
          });
          mortgageCount++;
        }
      }
      
      // Process student loan liabilities
      if (liabilities.student) {
        for (const student of liabilities.student) {
          const plaidAccount = accountMap.get(student.account_id || "");
          if (!plaidAccount) continue;
          
          await ctx.runMutation(internal.plaid.upsertPlaidLiability, {
            userId: identity.subject,
            plaidAccountId: plaidAccount._id,
            accountId: plaidAccount.accountId,
            liabilityType: "student",
            accountNumber: student.account_number || undefined,
            disbursementDates: student.disbursement_dates || undefined,
            expectedPayoffDate: student.expected_payoff_date || undefined,
            guarantor: student.guarantor || undefined,
            interestRatePercentage: student.interest_rate_percentage ?? undefined,
            isOverdue: student.is_overdue ?? undefined,
            lastPaymentAmount: student.last_payment_amount ?? undefined,
            lastPaymentDate: student.last_payment_date || undefined,
            lastStatementIssueDate: student.last_statement_issue_date || undefined,
            loanName: student.loan_name || undefined,
            loanStatus: student.loan_status ? {
              type: student.loan_status.type || "unknown",
              endDate: student.loan_status.end_date || undefined,
            } : undefined,
            minimumPaymentAmount: student.minimum_payment_amount ?? undefined,
            nextPaymentDueDate: student.next_payment_due_date || undefined,
            originationDate: student.origination_date || undefined,
            originationPrincipalAmount: student.origination_principal_amount ?? undefined,
            outstandingInterestAmount: student.outstanding_interest_amount ?? undefined,
            paymentReferenceNumber: student.payment_reference_number || undefined,
            pslfStatus: student.pslf_status ? {
              estimatedEligibilityDate: student.pslf_status.estimated_eligibility_date || undefined,
              paymentsMade: student.pslf_status.payments_made ?? undefined,
              paymentsRemaining: student.pslf_status.payments_remaining ?? undefined,
            } : undefined,
            repaymentPlan: student.repayment_plan ? {
              type: student.repayment_plan.type || "unknown",
              description: student.repayment_plan.description || undefined,
            } : undefined,
            sequenceNumber: student.sequence_number || undefined,
            servicerAddress: student.servicer_address ? {
              city: student.servicer_address.city || undefined,
              region: student.servicer_address.region || undefined,
              street: student.servicer_address.street || undefined,
              postalCode: student.servicer_address.postal_code || undefined,
              country: student.servicer_address.country || undefined,
            } : undefined,
          });
          studentCount++;
        }
      }
      
      // Update sync state
      await ctx.runMutation(internal.plaid.updatePlaidItemLiabilitiesSyncState, {
        id: plaidItemId,
        lastLiabilitiesSyncAt: Date.now(),
      });
      
      return {
        success: true,
        creditCount,
        mortgageCount,
        studentCount,
        totalCount: creditCount + mortgageCount + studentCount,
      };
    } catch (error: unknown) {
      console.error("Error syncing liabilities:", error);
      
      let message = "Unknown error";
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: { error_code?: string; error_message?: string } } };
        const errorCode = axiosError.response?.data?.error_code;
        message = axiosError.response?.data?.error_message || message;
        
        if (errorCode === "PRODUCTS_NOT_SUPPORTED") {
          return {
            success: false,
            error: "Liabilities product not available for this institution",
          };
        }
        
        if (errorCode === "ITEM_LOGIN_REQUIRED") {
          await ctx.runMutation(internal.plaid.updatePlaidItemStatus, {
            id: plaidItemId,
            status: "needs_reauth",
            errorCode,
            errorMessage: message,
          });
          throw new Error("Bank connection needs re-authentication. Please reconnect this account.");
        }
      } else if (error instanceof Error) {
        message = error.message;
      }
      
      throw new Error(`Failed to sync liabilities: ${message}`);
    }
  },
});
