# Plaid ↔ TallyUp Schema Mapping Design

This document defines the comprehensive field mapping between Plaid API responses and TallyUp's Convex schema. The goal is to ensure TallyUp captures all relevant Plaid data while maintaining the app's event-first philosophy.

---

## 1. Accounts & Balances

### Plaid Account Response Fields
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `account_id` | string | Unique account identifier |
| `balances.available` | number | Available balance (null for credit) |
| `balances.current` | number | Current balance |
| `balances.limit` | number | Credit limit (null for depository) |
| `balances.iso_currency_code` | string | ISO-4217 currency code |
| `balances.unofficial_currency_code` | string | Unofficial currency code |
| `mask` | string | Last 4 digits of account number |
| `name` | string | Account name from institution |
| `official_name` | string | Official account name |
| `type` | enum | Account type: investment, credit, depository, loan, brokerage, other |
| `subtype` | enum | Account subtype (401k, checking, credit card, mortgage, etc.) |
| `persistent_account_id` | string | Stable ID across Item re-links |

### TallyUp Mapping: `accounts` + `plaidAccounts`

**accounts table** (user-facing):
| TallyUp Field | Plaid Source | Notes |
|---------------|--------------|-------|
| `name` | `name` + `mask` | Combined: "Chase Checking (...1234)" |
| `type` | `type`/`subtype` | Mapped via `accountTypeMap` |
| `institutionName` | `institution.name` | From Plaid Item |
| `last4` | `mask` | Direct map |
| `creditLimit` | `balances.limit * 100` | Convert to cents |
| `isLinked` | hardcoded `true` | For Plaid accounts |
| `plaidAccountId` | `account_id` | Cross-reference |

**plaidAccounts table** (Plaid metadata):
| TallyUp Field | Plaid Source | Notes |
|---------------|--------------|-------|
| `plaidAccountId` | `account_id` | Primary Plaid ID |
| `name` | `name` | Raw Plaid name |
| `officialName` | `official_name` | Official name |
| `type` | `type` | Raw Plaid type |
| `subtype` | `subtype` | Raw Plaid subtype |
| `mask` | `mask` | Last 4 digits |
| `balanceCurrent` | `balances.current` | In dollars |
| `balanceAvailable` | `balances.available` | In dollars |
| `balanceLimit` | `balances.limit` | In dollars |
| `currency` | `iso_currency_code` | Currency code |

### Account Type Mapping
```typescript
const PLAID_ACCOUNT_TYPE_MAP: Record<string, TallyUpAccountType> = {
  // Depository subtypes
  "checking": "checking",
  "savings": "savings",
  "hsa": "savings",
  "cd": "savings",
  "money market": "savings",
  "paypal": "checking",
  "prepaid": "checking",
  "cash management": "checking",
  "ebt": "other",
  
  // Credit subtypes
  "credit card": "credit",
  "paypal": "credit", // Can be either
  
  // Loan subtypes
  "auto": "loan",
  "business": "loan",
  "commercial": "loan",
  "construction": "loan",
  "consumer": "loan",
  "home equity": "loan",
  "loan": "loan",
  "mortgage": "loan",
  "overdraft": "loan",
  "line of credit": "loan",
  "student": "loan",
  
  // Investment subtypes
  "401a": "investment",
  "401k": "investment",
  "403B": "investment",
  "457b": "investment",
  "529": "investment",
  "brokerage": "investment",
  "cash isa": "investment",
  "crypto exchange": "investment",
  "education savings account": "investment",
  "fixed annuity": "investment",
  "gic": "investment",
  "health reimbursement arrangement": "investment",
  "ira": "investment",
  "isa": "investment",
  "keogh": "investment",
  "lif": "investment",
  "life insurance": "investment",
  "lira": "investment",
  "lrif": "investment",
  "lrsp": "investment",
  "mutual fund": "investment",
  "non-custodial wallet": "investment",
  "non-taxable brokerage account": "investment",
  "other": "investment",
  "other annuity": "investment",
  "other insurance": "investment",
  "pension": "investment",
  "prif": "investment",
  "profit sharing plan": "investment",
  "qshr": "investment",
  "rdsp": "investment",
  "resp": "investment",
  "retirement": "investment",
  "rlif": "investment",
  "roth": "investment",
  "roth 401k": "investment",
  "rrif": "investment",
  "rrsp": "investment",
  "sarsep": "investment",
  "sep ira": "investment",
  "simple ira": "investment",
  "sipp": "investment",
  "stock plan": "investment",
  "tfsa": "investment",
  "trust": "investment",
  "ugma": "investment",
  "utma": "investment",
  "variable annuity": "investment",
};
```

### Schema Changes Needed for Accounts
```typescript
// Add to accounts table:
persistentPlaidAccountId: v.optional(v.string()), // Stable across re-links
accountSubtype: v.optional(v.string()),          // Raw Plaid subtype
currency: v.optional(v.string()),                // ISO currency code
```

---

## 2. Transactions

### Plaid Transaction Response Fields
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `transaction_id` | string | Unique transaction ID |
| `account_id` | string | Associated account |
| `amount` | number | Amount (positive = outflow in Plaid) |
| `iso_currency_code` | string | Currency code |
| `date` | string | Posted date (YYYY-MM-DD) |
| `authorized_date` | string | Authorization date |
| `datetime` | string | Full timestamp if available |
| `authorized_datetime` | string | Authorization timestamp |
| `name` | string | Raw transaction description |
| `merchant_name` | string | Clean merchant name |
| `payment_channel` | enum | online, in store, other |
| `pending` | boolean | Is pending transaction |
| `pending_transaction_id` | string | Links pending to posted |
| `personal_finance_category.primary` | string | Primary category |
| `personal_finance_category.detailed` | string | Detailed category |
| `personal_finance_category.confidence_level` | enum | VERY_HIGH, HIGH, MEDIUM, LOW, UNKNOWN |
| `location.city` | string | Transaction city |
| `location.region` | string | State/region |
| `location.country` | string | Country code |
| `location.postal_code` | string | ZIP/postal code |
| `location.address` | string | Street address |
| `location.lat` | number | Latitude |
| `location.lon` | number | Longitude |
| `location.store_number` | string | Store number |
| `counterparties[].name` | string | Entity names |
| `counterparties[].type` | enum | merchant, marketplace, payment_terminal |
| `counterparties[].logo_url` | string | Entity logo |
| `counterparties[].website` | string | Entity website |
| `counterparties[].entity_id` | string | Plaid entity ID |
| `logo_url` | string | Transaction/merchant logo |
| `website` | string | Merchant website |
| `transaction_code` | string | Transaction type code |
| `check_number` | string | Check number if applicable |
| `personal_finance_category_icon_url` | string | Category icon |

### TallyUp Mapping: `entries` + `plaidTransactions`

**entries table** (user-facing events):
| TallyUp Field | Plaid Source | Transform |
|---------------|--------------|-----------|
| `type` | `amount` + `category` | See `deriveEntryType()` |
| `transactionType` | derived | SPENT, RECEIVED, TRANSFER |
| `amountCents` | `abs(amount) * 100` | Always positive cents |
| `date` | `date` | Parse to midnight timestamp |
| `occurredAt` | `datetime` or `date` | Full timestamp if available |
| `status` | `pending` | "pending" or "posted" |
| `stableId` | `transaction_id` | For dedupe |
| `merchant` | `merchant_name` or `name` | Prefer merchant_name |
| `merchantRaw` | `name` | Original description |
| `merchantNormalized` | normalized | Via `normalizeMerchant()` |
| `category` | `personal_finance_category` | Via mapping |
| `categoryId` | resolved | Via `resolveCategoryId()` |
| `note` | — | Empty, user can add |
| `accountId` | resolved | Via plaidAccounts lookup |
| `entryType` | derived | purchase, income, transfer, fee |
| `currency` | `iso_currency_code` | Direct |
| `needsReview` | derived | True if category unclear |

**plaidTransactions table** (raw Plaid data):
| TallyUp Field | Plaid Source | Notes |
|---------------|--------------|-------|
| `plaidTransactionId` | `transaction_id` | Primary ID |
| `pendingTransactionId` | `pending_transaction_id` | For pending→posted |
| `amount` | `amount` | Raw (positive = outflow) |
| `date` | `date` | YYYY-MM-DD string |
| `datetime` | `datetime` | Full ISO timestamp |
| `name` | `name` | Raw description |
| `merchantName` | `merchant_name` | Clean name |
| `pending` | `pending` | Boolean |
| `category` | `personal_finance_category.primary` | Primary |
| `categoryDetailed` | `personal_finance_category.detailed` | Detailed |
| `categoryConfidence` | `confidence_level` | Confidence |
| `paymentChannel` | `payment_channel` | online/in store/other |
| `transactionType` | `transaction_code` | Type code |
| `locationCity` | `location.city` | City |
| `locationRegion` | `location.region` | State |
| `locationCountry` | `location.country` | Country |

### Schema Changes Needed for Transactions
```typescript
// Add to plaidTransactions table:
authorizedDate: v.optional(v.string()),           // Authorization date
authorizedDatetime: v.optional(v.string()),       // Authorization timestamp
locationPostalCode: v.optional(v.string()),       // ZIP code
locationAddress: v.optional(v.string()),          // Street address
locationLat: v.optional(v.number()),              // Latitude
locationLon: v.optional(v.number()),              // Longitude
locationStoreNumber: v.optional(v.string()),      // Store number
checkNumber: v.optional(v.string()),              // Check number
logoUrl: v.optional(v.string()),                  // Merchant logo
website: v.optional(v.string()),                  // Merchant website
counterparties: v.optional(v.array(v.object({     // Counterparty info
  name: v.optional(v.string()),
  type: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  website: v.optional(v.string()),
  entityId: v.optional(v.string()),
}))),
isoCurrencyCode: v.optional(v.string()),          // Currency code

// Add to entries table:
authorizedDate: v.optional(v.number()),           // When authorized
logoUrl: v.optional(v.string()),                  // For display
paymentChannel: v.optional(v.string()),           // online/in store/other
```

---

## 3. Investments

### Plaid Investment Holdings Response
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `holding.account_id` | string | Account |
| `holding.security_id` | string | Security reference |
| `holding.quantity` | number | Number of shares/units |
| `holding.institution_price` | number | Price per share (institution reported) |
| `holding.institution_price_as_of` | string | Price date |
| `holding.institution_price_datetime` | string | Price timestamp |
| `holding.institution_value` | number | Total value |
| `holding.cost_basis` | number | Total cost basis |
| `holding.iso_currency_code` | string | Currency |
| `holding.vested_quantity` | number | Vested shares (RSUs) |
| `holding.vested_value` | number | Vested value |
| `holding.unvested_quantity` | number | Unvested shares |
| `holding.unvested_value` | number | Unvested value |
| `security.security_id` | string | Security ID |
| `security.isin` | string | ISIN code |
| `security.cusip` | string | CUSIP code |
| `security.sedol` | string | SEDOL code |
| `security.institution_security_id` | string | Institution's ID |
| `security.institution_id` | string | Institution |
| `security.ticker_symbol` | string | Ticker (AAPL, etc.) |
| `security.name` | string | Security name |
| `security.type` | enum | cash, cryptocurrency, derivative, equity, etf, fixed income, loan, mutual fund, other |
| `security.close_price` | number | Market close price |
| `security.close_price_as_of` | string | Close price date |
| `security.is_cash_equivalent` | boolean | Cash-like |
| `security.unofficial_currency_code` | string | Currency |
| `security.market_identifier_code` | string | MIC |
| `security.sector` | string | Sector (if available) |
| `security.industry` | string | Industry (if available) |
| `security.option_contract` | object | Option details |

### Plaid Investment Transactions Response
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `investment_transaction_id` | string | Transaction ID |
| `account_id` | string | Account |
| `security_id` | string | Security |
| `date` | string | Transaction date |
| `name` | string | Description |
| `quantity` | number | Shares traded |
| `amount` | number | Dollar amount |
| `price` | number | Price per share |
| `fees` | number | Transaction fees |
| `type` | enum | buy, sell, cancel, cash, fee, transfer |
| `subtype` | enum | account fee, adjustment, assignment, buy, buy to cover, contribution, deposit, distribution, dividend, dividend reinvestment, exercise, expire, fund fee, interest, interest receivable, interest reinvestment, legal fee, loan payment, long-term capital gain, long-term capital gain reinvestment, management fee, margin expense, merger, miscellaneous fee, non-qualified dividend, non-resident tax, pending credit, pending debit, qualified dividend, rebalance, return of principal, request, sell, sell short, send, short-term capital gain, short-term capital gain reinvestment, spin off, split, stock distribution, tax, tax withheld, trade, transfer, transfer fee, trust fee, unqualified gain, withdrawal |
| `iso_currency_code` | string | Currency |

### TallyUp Mapping: New Tables Needed

**plaidSecurities table** (new):
```typescript
plaidSecurities: defineTable({
  // Plaid identifiers
  securityId: v.string(),                         // Primary Plaid ID
  isin: v.optional(v.string()),                   // ISIN
  cusip: v.optional(v.string()),                  // CUSIP
  sedol: v.optional(v.string()),                  // SEDOL
  institutionSecurityId: v.optional(v.string()),  // Institution's ID
  tickerSymbol: v.optional(v.string()),           // Ticker
  
  // Security info
  name: v.string(),
  securityType: v.string(),                       // cash, equity, etf, etc.
  isCashEquivalent: v.optional(v.boolean()),
  
  // Pricing
  closePrice: v.optional(v.number()),
  closePriceAsOf: v.optional(v.string()),
  
  // Classification
  sector: v.optional(v.string()),
  industry: v.optional(v.string()),
  
  // Currency
  isoCurrencyCode: v.optional(v.string()),
  unofficialCurrencyCode: v.optional(v.string()),
  marketIdentifierCode: v.optional(v.string()),
  
  // Option contract details
  optionContract: v.optional(v.object({
    contractType: v.optional(v.string()),
    expirationDate: v.optional(v.string()),
    strikePrice: v.optional(v.number()),
    underlyingSecurityId: v.optional(v.string()),
    underlyingSecurityTicker: v.optional(v.string()),
  })),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_securityId", ["securityId"])
  .index("by_ticker", ["tickerSymbol"]),
```

**plaidHoldings table** (new):
```typescript
plaidHoldings: defineTable({
  userId: v.string(),
  plaidAccountId: v.id("plaidAccounts"),
  plaidSecurityId: v.id("plaidSecurities"),
  
  // TallyUp link
  investmentId: v.optional(v.id("investments")),
  
  // Holding details
  quantity: v.number(),
  institutionPrice: v.number(),
  institutionPriceAsOf: v.optional(v.string()),
  institutionPriceDatetime: v.optional(v.string()),
  institutionValue: v.optional(v.number()),
  costBasis: v.optional(v.number()),
  
  // Vesting (RSUs, options)
  vestedQuantity: v.optional(v.number()),
  vestedValue: v.optional(v.number()),
  unvestedQuantity: v.optional(v.number()),
  unvestedValue: v.optional(v.number()),
  
  // Currency
  isoCurrencyCode: v.optional(v.string()),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_account", ["plaidAccountId"])
  .index("by_security", ["plaidSecurityId"]),
```

**plaidInvestmentTransactions table** (new):
```typescript
plaidInvestmentTransactions: defineTable({
  userId: v.string(),
  plaidAccountId: v.id("plaidAccounts"),
  plaidSecurityId: v.optional(v.id("plaidSecurities")),
  
  // Plaid identifiers
  investmentTransactionId: v.string(),
  
  // Transaction details
  date: v.string(),
  name: v.string(),
  quantity: v.number(),
  amount: v.number(),
  price: v.number(),
  fees: v.optional(v.number()),
  
  // Type classification
  transactionType: v.string(),  // buy, sell, cash, fee, transfer
  subtype: v.optional(v.string()), // dividend, contribution, etc.
  
  // Currency
  isoCurrencyCode: v.optional(v.string()),
  
  // TallyUp link (optionally create entry for dividends, etc.)
  entryId: v.optional(v.id("entries")),
  
  // Import status
  importStatus: v.union(
    v.literal("pending"),
    v.literal("imported"),
    v.literal("skipped")
  ),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_account", ["plaidAccountId"])
  .index("by_transactionId", ["investmentTransactionId"])
  .index("by_user_date", ["userId", "date"]),
```

**investments table** (enhanced):
```typescript
// Add to existing investments table:
plaidSecurityId: v.optional(v.id("plaidSecurities")),
plaidHoldingId: v.optional(v.id("plaidHoldings")),
isin: v.optional(v.string()),
cusip: v.optional(v.string()),
sector: v.optional(v.string()),
industry: v.optional(v.string()),
vestedQuantity: v.optional(v.number()),
unvestedQuantity: v.optional(v.number()),
isoCurrencyCode: v.optional(v.string()),
```

### Security Type Mapping
```typescript
const PLAID_SECURITY_TYPE_MAP: Record<string, TallyUpAssetType> = {
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
```

---

## 4. Liabilities

### Plaid Credit Liability Response
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `account_id` | string | Account |
| `aprs[].apr_percentage` | number | APR value |
| `aprs[].apr_type` | enum | balance_transfer_apr, cash_apr, purchase_apr, special |
| `aprs[].balance_subject_to_apr` | number | Balance at this APR |
| `aprs[].interest_charge_amount` | number | Interest charged |
| `is_overdue` | boolean | Past due |
| `last_payment_amount` | number | Last payment |
| `last_payment_date` | string | Last payment date |
| `last_statement_balance` | number | Statement balance |
| `last_statement_issue_date` | string | Statement date |
| `minimum_payment_amount` | number | Minimum due |
| `next_payment_due_date` | string | Due date |

### Plaid Mortgage Liability Response
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `account_id` | string | Account |
| `account_number` | string | Full account number |
| `current_late_fee` | number | Late fee amount |
| `escrow_balance` | number | Escrow balance |
| `has_pmi` | boolean | Has PMI |
| `has_prepayment_penalty` | boolean | Has prepayment penalty |
| `interest_rate.percentage` | number | Interest rate |
| `interest_rate.type` | enum | fixed, variable |
| `last_payment_amount` | number | Last payment |
| `last_payment_date` | string | Last payment date |
| `loan_term` | string | Term (e.g., "30 year") |
| `loan_type_description` | string | Loan type |
| `maturity_date` | string | Payoff date |
| `next_monthly_payment` | number | Next payment |
| `next_payment_due_date` | string | Due date |
| `origination_date` | string | Loan start date |
| `origination_principal_amount` | number | Original principal |
| `past_due_amount` | number | Past due amount |
| `property_address.city` | string | Property city |
| `property_address.region` | string | State |
| `property_address.street` | string | Street |
| `property_address.postal_code` | string | ZIP |
| `property_address.country` | string | Country |
| `ytd_interest_paid` | number | YTD interest |
| `ytd_principal_paid` | number | YTD principal |

### Plaid Student Loan Liability Response
| Plaid Field | Type | Description |
|-------------|------|-------------|
| `account_id` | string | Account |
| `account_number` | string | Account number |
| `disbursement_dates` | string[] | Disbursement dates |
| `expected_payoff_date` | string | Expected payoff |
| `guarantor` | string | Loan guarantor |
| `interest_rate_percentage` | number | Interest rate |
| `is_overdue` | boolean | Past due |
| `last_payment_amount` | number | Last payment |
| `last_payment_date` | string | Last payment date |
| `last_statement_issue_date` | string | Statement date |
| `loan_name` | string | Loan name |
| `loan_status.type` | enum | cancelled, in grace, in military, in school, not fully disbursed, repayment, other, etc. |
| `loan_status.end_date` | string | Status end date |
| `minimum_payment_amount` | number | Minimum due |
| `next_payment_due_date` | string | Due date |
| `origination_date` | string | Loan start |
| `origination_principal_amount` | number | Original principal |
| `outstanding_interest_amount` | number | Outstanding interest |
| `payment_reference_number` | string | Payment ref |
| `pslf_status.estimated_eligibility_date` | string | PSLF eligibility |
| `pslf_status.payments_made` | number | PSLF payments made |
| `pslf_status.payments_remaining` | number | PSLF payments remaining |
| `repayment_plan.type` | enum | standard, graduated, income-based, etc. |
| `repayment_plan.description` | string | Plan description |
| `sequence_number` | string | Loan sequence |
| `servicer_address.city` | string | Servicer city |
| `servicer_address.region` | string | State |
| `servicer_address.street` | string | Street |
| `servicer_address.postal_code` | string | ZIP |
| `servicer_address.country` | string | Country |
| `ytd_interest_paid` | number | YTD interest |
| `ytd_principal_paid` | number | YTD principal |

### TallyUp Mapping: New Tables Needed

**plaidLiabilities table** (new):
```typescript
plaidLiabilities: defineTable({
  userId: v.string(),
  plaidAccountId: v.id("plaidAccounts"),
  accountId: v.id("accounts"),
  
  // Liability type
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
  
  // Credit-specific
  aprs: v.optional(v.array(v.object({
    aprPercentage: v.number(),
    aprType: v.string(),
    balanceSubjectToApr: v.optional(v.number()),
    interestChargeAmount: v.optional(v.number()),
  }))),
  lastStatementBalance: v.optional(v.number()),
  
  // Mortgage-specific
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
  
  // Student loan-specific
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
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_account", ["plaidAccountId"])
  .index("by_type", ["liabilityType"]),
```

**accounts table** (enhanced for liabilities):
```typescript
// Add to existing accounts table:
// Liability fields
isOverdue: v.optional(v.boolean()),
minimumPaymentCents: v.optional(v.number()),
nextPaymentDueDate: v.optional(v.number()),
lastPaymentDate: v.optional(v.number()),
lastPaymentAmountCents: v.optional(v.number()),

// Mortgage-specific
loanTerm: v.optional(v.string()),
maturityDate: v.optional(v.number()),
originationDate: v.optional(v.number()),
originationPrincipalCents: v.optional(v.number()),
escrowBalanceCents: v.optional(v.number()),
hasPmi: v.optional(v.boolean()),

// Student loan-specific
loanStatus: v.optional(v.string()),
repaymentPlan: v.optional(v.string()),
expectedPayoffDate: v.optional(v.number()),
```

---

## 5. Plaid Items Enhancement

### Current State
The `plaidItems` table is fairly complete but needs:

```typescript
// Add to plaidItems:
products: v.optional(v.array(v.string())),        // Products enabled on this Item
availableProducts: v.optional(v.array(v.string())), // Products available but not enabled
billedProducts: v.optional(v.array(v.string())),    // Products being billed
consentedProducts: v.optional(v.array(v.string())), // Products user consented to
webhookUrl: v.optional(v.string()),                // Webhook URL
updateType: v.optional(v.string()),               // background, user_present_required
```

---

## 6. Link Token Enhancement

Currently requesting only `Transactions`. Update to request all needed products:

```typescript
// In createLinkToken action:
const productsToRequest = [
  Products.Transactions,
  Products.Liabilities,
  Products.Investments,
];

// Optional products (require additional permissions):
// Products.Income - requires user income data consent
// Note: Enrich is a separate API call, not a Link product
```

---

## 7. Summary of Schema Changes

### New Tables (4)
1. `plaidSecurities` - Security/stock metadata
2. `plaidHoldings` - Investment positions
3. `plaidInvestmentTransactions` - Investment trades
4. `plaidLiabilities` - Credit/mortgage/student loan details

### Enhanced Tables (5)
1. `accounts` - Add liability fields, currency, subtype
2. `entries` - Add authorizedDate, logoUrl, paymentChannel
3. `plaidTransactions` - Add location details, counterparties, logo
4. `investments` - Add Plaid links, sector/industry
5. `plaidItems` - Add products arrays

### New Actions Needed
1. `syncInvestments` - Pull holdings and securities
2. `syncInvestmentTransactions` - Pull investment activity
3. `syncLiabilities` - Pull liability details
4. Enhance `createLinkToken` - Request additional products

---

## 8. Implementation Order

1. **Phase 1: Schema Updates**
   - Add new tables to schema.ts
   - Add new fields to existing tables
   - Run `npx convex dev` to regenerate

2. **Phase 2: Investments Integration**
   - Create `plaid.investments.ts` for mutations
   - Add `syncInvestments` action to plaidActions.ts
   - Map holdings → investments table

3. **Phase 3: Liabilities Integration**
   - Create `plaid.liabilities.ts` for mutations
   - Add `syncLiabilities` action to plaidActions.ts
   - Map liabilities → accounts with details

4. **Phase 4: Enhanced Transactions**
   - Update `upsertPlaidTransaction` for new fields
   - Add counterparty extraction
   - Improve category confidence handling

5. **Phase 5: Link Token Update**
   - Update `createLinkToken` for multi-product
   - Handle product availability checks
   - Add product-specific sync triggers

---

## 9. Category Mapping Enhancement

The current `PLAID_CATEGORY_TO_SLUG` mapping is good but should be updated to include all current Plaid categories. See the full mapping in `convex/plaid.ts`.

Consider adding confidence-based handling:
- `VERY_HIGH` / `HIGH`: Auto-assign category
- `MEDIUM`: Assign but flag for review
- `LOW` / `UNKNOWN`: Don't assign, add to inbox
