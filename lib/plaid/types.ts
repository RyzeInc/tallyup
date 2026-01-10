/**
 * Plaid Type Definitions
 * 
 * Type definitions for Plaid integration with TallyUp.
 */

import type { Id } from "convex/_generated/dataModel";

// Institution information from Plaid
export interface PlaidInstitution {
  institutionId: string;
  name: string;
  logo?: string;
  primaryColor?: string;
  url?: string;
}

// Account information from Plaid
export interface PlaidAccount {
  accountId: string;
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string; // Last 4 digits
  balances: {
    available?: number;
    current?: number;
    limit?: number;
    isoCurrencyCode?: string;
  };
}

// Transaction from Plaid
export interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number; // Positive = outflow, Negative = inflow (Plaid convention)
  isoCurrencyCode?: string;
  date: string; // YYYY-MM-DD
  datetime?: string; // ISO 8601
  name: string;
  merchantName?: string;
  pending: boolean;
  pendingTransactionId?: string;
  category?: string[];
  personalFinanceCategory?: {
    primary: string;
    detailed: string;
    confidenceLevel?: string;
  };
  paymentChannel: "online" | "in store" | "other";
  transactionType?: string;
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
    storeNumber?: string;
  };
}

// Link token response
export interface LinkTokenResponse {
  linkToken: string;
  expiration: string;
}

// Link success callback data
export interface PlaidLinkSuccess {
  publicToken: string;
  metadata: {
    institution?: PlaidInstitution;
    accounts: PlaidAccount[];
    linkSessionId: string;
  };
}

// Stored item (linked institution) in our database
export interface PlaidItem {
  _id: Id<"plaidItems">;
  userId: string;
  itemId: string;
  accessToken: string; // Encrypted in production
  institutionId?: string;
  institutionName?: string;
  institutionLogo?: string;
  institutionColor?: string;
  consentExpirationTime?: number;
  status: "active" | "needs_reauth" | "revoked" | "error";
  errorCode?: string;
  errorMessage?: string;
  lastSyncedAt?: number;
  transactionCursor?: string;
  createdAt: number;
  updatedAt: number;
}

// Linked account (maps Plaid account to TallyUp account)
export interface PlaidLinkedAccount {
  _id: Id<"plaidAccounts">;
  userId: string;
  plaidItemId: Id<"plaidItems">;
  accountId: Id<"accounts">; // TallyUp account
  plaidAccountId: string; // Plaid's account ID
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string;
  balanceCurrent?: number;
  balanceAvailable?: number;
  balanceLimit?: number;
  currency?: string;
  isHidden: boolean;
  lastSyncedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Stored transaction from Plaid
export interface PlaidStoredTransaction {
  _id: Id<"plaidTransactions">;
  userId: string;
  plaidAccountId: Id<"plaidAccounts">;
  entryId?: Id<"entries">; // Link to TallyUp entry once imported
  plaidTransactionId: string;
  pendingTransactionId?: string;
  amount: number;
  date: string;
  datetime?: string;
  name: string;
  merchantName?: string;
  pending: boolean;
  category?: string;
  categoryDetailed?: string;
  paymentChannel: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
  importStatus: "pending" | "imported" | "skipped" | "duplicate";
  importedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Sync status for UI
export interface SyncStatus {
  itemId: string;
  institutionName: string;
  lastSyncedAt?: number;
  syncInProgress: boolean;
  errorMessage?: string;
  accountCount: number;
  transactionCount: number;
}

// Transaction sync result
export interface TransactionSyncResult {
  added: number;
  modified: number;
  removed: number;
  hasMore: boolean;
  cursor?: string;
}

// Import options for transactions
export interface TransactionImportOptions {
  startDate?: string;
  endDate?: string;
  accounts?: string[];
  autoCategorizex?: boolean;
  markAsReviewed?: boolean;
}

// Webhook payload types
export interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
  consent_expiration_time?: string;
}
