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
import { Doc } from "./_generated/dataModel";
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
  },
  handler: async (ctx, { accessToken }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const plaidClient = getPlaidClient();
    
    const request: Parameters<typeof plaidClient.linkTokenCreate>[0] = {
      user: {
        client_user_id: identity.subject,
      },
      client_name: "TallyUp",
      products: accessToken ? [] : [Products.Transactions],
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
      // Diagnostic: log whether we intend to include redirect_uri (no secrets)
      console.info("[plaid] createLinkToken: enableOauth=", enableOauth, "redirectUriSet=", !!redirectUri);
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
          
          await ctx.runMutation(internal.plaid.upsertPlaidTransaction, {
            userId: identity.subject,
            plaidAccountId: plaidAccountIdInternal,
            plaidTransactionId: txn.transaction_id,
            pendingTransactionId: txn.pending_transaction_id || undefined,
            amount: txn.amount,
            date: txn.date,
            datetime: txn.datetime || undefined,
            name: txn.name,
            merchantName: txn.merchant_name || undefined,
            pending: txn.pending,
            category: txn.personal_finance_category?.primary,
            categoryDetailed: txn.personal_finance_category?.detailed,
            categoryConfidence: txn.personal_finance_category?.confidence_level ?? undefined,
            paymentChannel: txn.payment_channel,
            transactionType: txn.transaction_type || undefined,
            locationCity: txn.location?.city || undefined,
            locationRegion: txn.location?.region || undefined,
            locationCountry: txn.location?.country || undefined,
          });
          added++;
        }
        
        // Process modified transactions
        for (const txn of data.modified) {
          const plaidAccountIdInternal = accountIdMap.get(txn.account_id);
          if (!plaidAccountIdInternal) continue;
          
          await ctx.runMutation(internal.plaid.upsertPlaidTransaction, {
            userId: identity.subject,
            plaidAccountId: plaidAccountIdInternal,
            plaidTransactionId: txn.transaction_id,
            pendingTransactionId: txn.pending_transaction_id || undefined,
            amount: txn.amount,
            date: txn.date,
            datetime: txn.datetime || undefined,
            name: txn.name,
            merchantName: txn.merchant_name || undefined,
            pending: txn.pending,
            category: txn.personal_finance_category?.primary,
            categoryDetailed: txn.personal_finance_category?.detailed,
            categoryConfidence: txn.personal_finance_category?.confidence_level ?? undefined,
            paymentChannel: txn.payment_channel,
            transactionType: txn.transaction_type || undefined,
            locationCity: txn.location?.city || undefined,
            locationRegion: txn.location?.region || undefined,
            locationCountry: txn.location?.country || undefined,
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
