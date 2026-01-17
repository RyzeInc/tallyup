# Plaid Integration Guide

This document explains how TallyUp integrates with Plaid for financial account aggregation.

## Overview

TallyUp uses Plaid to securely connect to users' bank accounts, credit cards, investment accounts, and other financial institutions. This enables:

- **Automatic transaction import** - Transactions sync automatically every few hours
- **Real-time balances** - Account balances stay current without manual updates
- **Investment tracking** - Holdings, securities, and investment transactions
- **Liability details** - Credit card APRs, mortgage terms, student loan info
- **Reduced data entry** - Focus on categorizing and insights instead of typing
- **Better accuracy** - Direct bank data eliminates manual entry errors

## Products Supported

| Product | Description | Status |
|---------|-------------|--------|
| **Transactions** | Transaction sync, categories, merchant data | ✅ Active |
| **Investments** | Holdings, securities, investment transactions | ✅ Active |
| **Liabilities** | Credit, mortgage, student loan details | ✅ Active |
| **Balance** | Real-time account balances | ✅ Active |
| **Income** | Income verification | 🔜 Planned |
| **Enrich** | Enhanced merchant/transaction enrichment | 🔜 Planned |

## Architecture

### Data Flow

```
┌──────────────┐     ┌─────────────┐     ┌────────────────┐
│   Plaid API  │────▶│   Convex    │────▶│   TallyUp UI   │
│              │     │   Actions   │     │                │
└──────────────┘     └─────────────┘     └────────────────┘
       ▲                    │
       │                    ▼
       │             ┌─────────────┐
       │             │   Convex    │
       └─────────────│   Database  │
                     └─────────────┘
```

### Database Tables

#### Core Plaid Tables
| Table | Purpose |
|-------|---------|
| `plaidItems` | Linked institutions (access tokens, sync state, products) |
| `plaidAccounts` | Accounts within each institution |
| `plaidTransactions` | Raw transactions with full Plaid enrichment |
| `plaidSyncLogs` | Audit trail for sync operations |

#### Investment Tables
| Table | Purpose |
|-------|---------|
| `plaidSecurities` | Security/stock metadata (ticker, ISIN, sector) |
| `plaidHoldings` | Investment positions (quantity, cost basis, vesting) |
| `plaidInvestmentTransactions` | Buy/sell/dividend transactions |

#### Liability Tables
| Table | Purpose |
|-------|---------|
| `plaidLiabilities` | Credit, mortgage, student loan details |

#### TallyUp Tables (linked)
| Table | Purpose |
|-------|---------|
| `accounts` | TallyUp accounts (linked via `plaidAccountId`) |
| `entries` | TallyUp transactions (imported from `plaidTransactions`) |
| `investments` | TallyUp investments (linked via `plaidHoldingId`) |

### Key Files

| Path | Purpose |
|------|---------|
| `convex/schema.ts` | Database schema (Plaid tables) |
| `convex/plaid.ts` | Mutations and queries for Plaid data |
| `convex/plaidActions.ts` | Convex actions that call Plaid API |
| `docs/PLAID_SCHEMA_MAPPING.md` | Complete field mapping documentation |
| `components/plaid/` | React components for Plaid UI |
| `app/(app)/accounts/link/` | Connect accounts page |

## Setup

### 1. Get Plaid Credentials

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Create a new application
3. Get your Client ID and Sandbox Secret

### 2. Set Environment Variables

Add to your `.env.local`:

```bash
# Plaid credentials
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox

# Optional: OAuth redirect (for institutions requiring OAuth)
PLAID_ENABLE_OAUTH=false
PLAID_REDIRECT_URI=https://yourapp.com/oauth/callback
```

For Convex, add these same variables to your Convex dashboard under Settings > Environment Variables.

### 3. Sandbox Testing

Use these credentials in Plaid Link:
- **Username:** `user_good`
- **Password:** `pass_good`

For different scenarios (errors, specific account types), see [Plaid Sandbox Docs](https://plaid.com/docs/sandbox/).

## User Flow

### Connecting an Account

1. User navigates to **Accounts → Connect Your Bank**
2. Clicks "Connect Bank Account" to open Plaid Link
3. Selects their bank and logs in with credentials
4. Selects which accounts to link
5. Plaid returns a public token
6. TallyUp exchanges it for an access token
7. Accounts are created in TallyUp, linked to Plaid
8. Initial sync runs for transactions, investments, and liabilities

### Transaction Sync

1. **Initial Sync** - After linking, we fetch up to 2 years of transactions
2. **Incremental Sync** - Subsequent syncs only fetch new/modified transactions
3. **Pending Queue** - Transactions land in a review queue before import
4. **Import** - User reviews and imports transactions (with categories)
5. **Auto-Import** (optional) - Can be enabled for automatic import

### Investment Sync

1. Holdings and securities are fetched via `syncInvestments`
2. Investment transactions (buys, sells, dividends) via `syncInvestmentTransactions`
3. Data is stored in `plaidSecurities`, `plaidHoldings`, `plaidInvestmentTransactions`
4. Can be linked to TallyUp `investments` table for unified view

### Liability Sync

1. Credit, mortgage, and student loan details via `syncLiabilities`
2. Captures APRs, payment due dates, interest rates, loan terms
3. Stored in `plaidLiabilities` and linked to TallyUp `accounts`

### Reconnection (Reauth)

If credentials change or expire:
1. Item status changes to `needs_reauth`
2. UI shows a "Reconnect" button
3. User goes through Plaid Link in update mode
4. Item status returns to `active`

## API Reference

### Actions (External API calls)

```typescript
// Create a link token for Plaid Link
api.plaidActions.createLinkToken({
  accessToken?: string,    // For update mode
  products?: string[],     // Override default products
})
// Default products: transactions, investments, liabilities

// Exchange public token after successful Link
api.plaidActions.exchangePublicToken({
  publicToken: string,
  institutionId?: string,
  institutionName?: string,
})

// Sync transactions from Plaid
api.plaidActions.syncTransactions({
  plaidItemId: Id<"plaidItems">,
  syncType?: "initial" | "incremental" | "manual",
})

// Sync investment holdings and securities
api.plaidActions.syncInvestments({
  plaidItemId: Id<"plaidItems">,
})

// Sync investment transactions (buys, sells, dividends)
api.plaidActions.syncInvestmentTransactions({
  plaidItemId: Id<"plaidItems">,
  startDate?: string,  // YYYY-MM-DD, default: 30 days ago
  endDate?: string,    // YYYY-MM-DD, default: today
})

// Sync liability details (credit, mortgage, student)
api.plaidActions.syncLiabilities({
  plaidItemId: Id<"plaidItems">,
})

// Refresh account balances
api.plaidActions.refreshBalances({
  plaidItemId: Id<"plaidItems">,
})

// Remove item from Plaid
api.plaidActions.removeItem({
  plaidItemId: Id<"plaidItems">,
})

// Create link token for reauth
api.plaidActions.createUpdateLinkToken({
  plaidItemId: Id<"plaidItems">,
})
```

### Queries

```typescript
// List all linked institutions
api.plaid.listPlaidItems()

// List linked accounts (optionally by institution)
api.plaid.listPlaidAccounts({ plaidItemId?: Id<"plaidItems"> })

// List pending transactions
api.plaid.listPendingTransactions({ limit?: number })

// Get sync status overview
api.plaid.getPlaidSyncStatus()
```

### Mutations

```typescript
// Import a single transaction
api.plaid.importPlaidTransaction({
  plaidTransactionId: Id<"plaidTransactions">,
  category?: string,
  tags?: string[],
  note?: string,
  skipImport?: boolean,
})

// Bulk import transactions
api.plaid.bulkImportPlaidTransactions({
  transactionIds: Id<"plaidTransactions">[],
})

// Hide/show a Plaid account
api.plaid.hideUnhidePlaidAccount({
  plaidAccountId: Id<"plaidAccounts">,
  isHidden: boolean,
})

// Unlink an institution
api.plaid.unlinkPlaidItem({
  plaidItemId: Id<"plaidItems">,
})
```

## Transaction Data Captured

The enhanced transaction sync captures:

| Field | Description |
|-------|-------------|
| `amount` | Transaction amount (positive = outflow) |
| `date`, `datetime` | Posted and exact timestamps |
| `authorizedDate` | When transaction was authorized |
| `merchantName` | Clean merchant name |
| `category`, `categoryDetailed` | Plaid category with confidence |
| `paymentChannel` | online, in store, other |
| `location.*` | City, region, country, postal code, lat/lon |
| `logoUrl`, `website` | Merchant branding |
| `counterparties` | Marketplace/payment platform breakdown |
| `checkNumber` | For check transactions |

## Security Considerations

### Access Token Storage

- Access tokens are stored in the Convex database
- In production, consider additional encryption at rest
- Never expose access tokens to the client

### Credential Handling

- TallyUp never sees or stores bank credentials
- Plaid handles all credential verification
- Users authenticate directly with their bank via Plaid Link

### Data Minimization

- Only fetch data products you need
- Respect user preferences for account visibility
- Provide clear unlink functionality

## Webhook Integration (Future)

For real-time updates, configure Plaid webhooks:

1. Set `PLAID_WEBHOOK_URL` environment variable
2. Create a webhook endpoint in your API
3. Handle these webhook types:
   - `TRANSACTIONS` - New transactions available
   - `ITEM` - Item status changes (errors, revocation)
   - `HOLDINGS` - Investment holdings updated
   - `LIABILITIES` - Credit card/loan updates

## Troubleshooting

### Common Issues

**"Failed to create link token"**
- Check PLAID_CLIENT_ID and PLAID_SECRET are set
- Verify credentials in Plaid dashboard

**"Institution not found"**
- Institution may not be available in sandbox
- Try a different test institution

**"Item login required"**
- Credentials have changed or expired
- Use the Reconnect flow

**"Products not supported"**
- Not all institutions support all products
- Investments/Liabilities may not be available
- Check sync response for specific errors

**Transactions not syncing**
- Check item status (should be "active")
- Try manual sync from UI
- Check sync logs for errors

### Debug Tips

1. Check Convex dashboard for function logs
2. Look at `plaidSyncLogs` table for sync history
3. Enable verbose logging in development
4. Use Plaid dashboard's Link event viewer

## Related Documentation

- [PLAID_SCHEMA_MAPPING.md](./PLAID_SCHEMA_MAPPING.md) - Complete field mapping between Plaid API and TallyUp schema
- [Plaid API Docs](https://plaid.com/docs/) - Official Plaid documentation
