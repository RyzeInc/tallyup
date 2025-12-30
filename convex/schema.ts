import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // ACCOUNTS - Financial accounts (bank, credit, investment, etc.)
  // ============================================
  accounts: defineTable({
    userId: v.string(),

    // Account type
    accountType: v.union(
      v.literal("checking"),
      v.literal("savings"),
      v.literal("credit_card"),
      v.literal("investment"),
      v.literal("loan"),
      v.literal("cash"),
      v.literal("manual")
    ),

    // Display name (e.g., "Chase Checking", "Amex Gold")
    name: v.string(),

    // Institution / bank name
    institution: v.optional(v.string()),

    // Balance tracking (in cents)
    balanceCurrentCents: v.optional(v.number()),
    balanceAvailableCents: v.optional(v.number()),
    balanceAsOf: v.optional(v.number()), // timestamp of last balance update

    // Currency (ISO 4217, default USD)
    currency: v.optional(v.string()),

    // Ownership
    ownership: v.optional(v.union(v.literal("personal"), v.literal("shared"), v.literal("business"))),

    // Account status
    status: v.union(
      v.literal("active"),
      v.literal("hidden"),
      v.literal("closed")
    ),

    // For credit cards / loans: credit limit or original principal
    creditLimitCents: v.optional(v.number()),
    interestRatePercent: v.optional(v.number()),

    // Display order
    displayOrder: v.optional(v.number()),

    // Icon / color for UI
    icon: v.optional(v.string()),
    color: v.optional(v.string()),

    // External connection info (for future Plaid/aggregator integration)
    externalId: v.optional(v.string()),
    externalSource: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),

    // Exclusion flags
    excludeFromNetWorth: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_type", ["userId", "accountType"]),

  // ============================================
  // CATEGORIES - Hierarchical category structure
  // ============================================
  categories: defineTable({
    userId: v.string(),

    // Display name
    name: v.string(),

    // Parent category for hierarchy (null = top-level)
    parentId: v.optional(v.id("categories")),

    // Category type
    categoryType: v.union(
      v.literal("expense"),
      v.literal("income"),
      v.literal("transfer")
    ),

    // Icon / color for UI
    icon: v.optional(v.string()),
    color: v.optional(v.string()),

    // Default behaviors
    excludeFromBudgets: v.optional(v.boolean()),
    excludeFromReports: v.optional(v.boolean()),
    excludeFromCashFlow: v.optional(v.boolean()),

    // System category (cannot be deleted)
    isSystem: v.optional(v.boolean()),

    // Display order within parent
    displayOrder: v.optional(v.number()),

    // Archive instead of delete
    archived: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentId"])
    .index("by_user_type", ["userId", "categoryType"]),

  // ============================================
  // CATEGORY RULES - Auto-categorization logic
  // ============================================
  categoryRules: defineTable({
    userId: v.string(),

    // Rule name for display
    name: v.optional(v.string()),

    // Matching criteria (any match triggers the rule)
    matchMerchantContains: v.optional(v.string()),
    matchMerchantExact: v.optional(v.string()),
    matchNoteContains: v.optional(v.string()),
    matchAmountMinCents: v.optional(v.number()),
    matchAmountMaxCents: v.optional(v.number()),
    matchAccountId: v.optional(v.id("accounts")),

    // Action: assign category
    assignCategoryId: v.optional(v.id("categories")),
    assignCategory: v.optional(v.string()), // legacy string-based

    // Action: assign tags
    assignTags: v.optional(v.array(v.string())),

    // Action: rename merchant
    renameMerchantTo: v.optional(v.string()),

    // Action: set flags
    setExcludeFromTotals: v.optional(v.boolean()),
    setNeedsReview: v.optional(v.boolean()),

    // Rule priority (higher = applied first)
    priority: v.optional(v.number()),

    // Rule enabled/disabled
    enabled: v.optional(v.boolean()),

    // Stats
    timesApplied: v.optional(v.number()),
    lastAppliedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_enabled", ["userId", "enabled"]),

  // ============================================
  // TRANSFERS - First-class transfer tracking
  // ============================================
  transfers: defineTable({
    userId: v.string(),

    // Amount in cents
    amountCents: v.number(),

    // Date of transfer
    date: v.number(),

    // Source and destination accounts
    fromAccountId: v.optional(v.id("accounts")),
    toAccountId: v.optional(v.id("accounts")),

    // Linked entry IDs (for double-entry tracking)
    fromEntryId: v.optional(v.id("entries")),
    toEntryId: v.optional(v.id("entries")),

    // Transfer type
    transferType: v.union(
      v.literal("internal"),  // Between own accounts
      v.literal("external"),  // To/from external party
      v.literal("payment"),   // Credit card / loan payment
      v.literal("investment") // To/from investment account
    ),

    // Note / description
    note: v.optional(v.string()),

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),

    // Reconciliation
    reconciled: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_from", ["userId", "fromAccountId"])
    .index("by_user_to", ["userId", "toAccountId"]),

  // ============================================
  // INVESTMENTS - Asset tracking
  // ============================================
  investments: defineTable({
    userId: v.string(),

    // Linked account
    accountId: v.optional(v.id("accounts")),

    // Asset identification
    symbol: v.optional(v.string()), // e.g., "AAPL", "BTC"
    name: v.string(), // e.g., "Apple Inc.", "Bitcoin"

    // Asset type
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

    // Holdings
    quantity: v.number(), // shares/units (can be fractional)
    costBasisCents: v.number(), // total cost basis in cents

    // Current valuation
    currentPriceCents: v.optional(v.number()), // per-unit price
    currentValueCents: v.optional(v.number()), // total current value
    valuationAsOf: v.optional(v.number()), // timestamp of last price update

    // Gains tracking
    unrealizedGainCents: v.optional(v.number()),
    realizedGainCents: v.optional(v.number()),

    // Purchase info
    purchaseDate: v.optional(v.number()),
    purchasePriceCents: v.optional(v.number()), // per-unit at purchase

    // Tax lot tracking (for future)
    taxLotMethod: v.optional(v.union(
      v.literal("fifo"),
      v.literal("lifo"),
      v.literal("specific")
    )),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_account", ["userId", "accountId"])
    .index("by_user_type", ["userId", "assetType"]),

  // ============================================
  // MERCHANT RULES - Merchant renaming/mapping
  // ============================================
  merchantRules: defineTable({
    userId: v.string(),

    // Original merchant string(s) to match
    matchPattern: v.string(), // can be exact or contains pattern
    matchType: v.union(v.literal("exact"), v.literal("contains"), v.literal("regex")),

    // Normalized merchant name
    normalizedName: v.string(),

    // Optional: default category for this merchant
    defaultCategoryId: v.optional(v.id("categories")),
    defaultCategory: v.optional(v.string()),

    // Stats
    timesApplied: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ============================================
  // ENTRIES - Transaction events (enhanced)
  // ============================================
  entries: defineTable({
    userId: v.string(), // Clerk subject

    type: v.union(v.literal("expense"), v.literal("income"), v.literal("transfer")),

    // Primary field: Category (expense) or Source (income) in UI
    category: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    // Legacy field: will be migrated to category
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),

    note: v.optional(v.string()),
    // Optional explicit merchant/payee for cleaner analytics
    merchant: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),

    // Account linkage
    accountId: v.optional(v.id("accounts")),

    // Money is stored as *integer cents* (validated in mutations).
    amountCents: v.number(),

    // Local-midnight timestamp of when the money event occurred (used for indexes/filtering).
    // Kept as "date" for backwards compatibility with existing UI.
    date: v.number(),

    // Posted vs pending dates
    postedDate: v.optional(v.number()),
    pendingDate: v.optional(v.number()),

    // Optional richer timestamps for future-proofing.
    // occurredAt: exact event time (can equal `date` in Phase 1)
    // enteredAt: when the user logged it
    occurredAt: v.optional(v.number()),
    enteredAt: v.optional(v.number()),

    // Cleared vs pending state
    clearedState: v.optional(v.union(
      v.literal("pending"),
      v.literal("cleared"),
      v.literal("reconciled")
    )),

    // Transfer linkage
    transferId: v.optional(v.id("transfers")),
    isTransferSource: v.optional(v.boolean()), // true = outflow side of transfer

    // Split transaction support
    splitParentId: v.optional(v.id("entries")), // if this is a split child
    isSplitParent: v.optional(v.boolean()), // if this entry has splits

    // Exclusion flags (granular control)
    excludeFromTotals: v.optional(v.boolean()),
    excludeFromBudgets: v.optional(v.boolean()),
    excludeFromReports: v.optional(v.boolean()),
    excludeFromCashFlow: v.optional(v.boolean()),

    // optional: a link to a detected or user-created recurring series/rule (typed id)
    recurringRuleId: v.optional(v.id("recurringRules")),

    // Goal tracking - link entry to a goal for contribution tracking
    goalId: v.optional(v.id("goals")),

    // Gig worker fields - for hourly rate calculations
    hoursWorked: v.optional(v.number()), // decimal hours (e.g., 3.5)
    platformType: v.optional(v.string()), // e.g., "rideshare", "delivery", "freelance"
    gigGroup: v.optional(v.string()), // grouping for similar gigs (Uber+Lyft → "rideshare")

    // Optional link to budget category for tracking
    budgetCategoryId: v.optional(v.id("budgetCategories")),

    // Context tags (composable, multi-select): Personal, Business, Shared, etc.
    contextTags: v.optional(v.array(v.string())),
    // Intent tag (single-select): Essential, Discretionary, Planned, Unexpected, etc.
    intentTag: v.optional(v.string()),

    // Merchant info - raw and normalized
    merchantRaw: v.optional(v.string()), // original merchant string
    merchantNormalized: v.optional(v.string()), // cleaned/mapped merchant name

    // Review reason - why this entry is in the inbox
    reviewReason: v.optional(v.string()), // "missing_category", "mixed_context", "unknown_merchant", etc.

    // Confidence & detection scores (0-100)
    categoryConfidence: v.optional(v.number()),
    merchantConfidence: v.optional(v.number()),
    recurringConfidence: v.optional(v.number()),

    // User overrides & locks
    locked: v.optional(v.boolean()), // prevent auto-updates
    userOverrideCategory: v.optional(v.boolean()), // user manually set category
    userOverrideMerchant: v.optional(v.boolean()), // user manually set merchant

    // External import tracking
    externalId: v.optional(v.string()),
    externalSource: v.optional(v.string()),
    importBatchId: v.optional(v.string()),

    needsReview: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_needsReview_date", ["userId", "needsReview", "date"])
    .index("by_user_recurring", ["userId", "recurringRuleId"])
    .index("by_user_goal", ["userId", "goalId"])
    .index("by_user_budget", ["userId", "budgetCategoryId"])
    .index("by_user_account", ["userId", "accountId"])
    .index("by_user_transfer", ["userId", "transferId"])
    .index("by_user_category", ["userId", "categoryId"])
    .index("by_split_parent", ["splitParentId"]),

  recurringRules: defineTable({
    userId: v.string(),

    // 'expense' | 'income'
    type: v.union(v.literal("expense"), v.literal("income")),

    // User-facing display name (series name)
    displayName: v.optional(v.string()),

    // Optional matching fields (free-text). Matching uses normalized forms (lowercase trimmed).
    name: v.optional(v.string()),
    bucket: v.optional(v.string()),
    category: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    tags: v.optional(v.array(v.string())),

    // Merchant matching
    merchant: v.optional(v.string()),
    merchantPattern: v.optional(v.string()), // regex or contains pattern

    // Associated account
    accountId: v.optional(v.id("accounts")),

    // amount matching guidance
    amountCents: v.optional(v.number()), // expected amount (optional)
    minAmountCents: v.optional(v.number()),
    maxAmountCents: v.optional(v.number()),
    amountTolerancePercent: v.optional(v.number()), // e.g. 10 means ±10%
    amountMode: v.optional(v.union(v.literal("fixed"), v.literal("variable"), v.literal("range"), v.literal("unknown"))),

    // Is the amount fixed or variable?
    isVariableAmount: v.optional(v.boolean()),

    // Interval / cadence guidance
    intervalType: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("custom"))),
    intervalDays: v.optional(v.number()), // used when intervalType === 'custom'
    cadenceType: v.optional(v.union(v.literal("weekly"), v.literal("biweekly"), v.literal("semiMonthly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"), v.literal("custom"))),
    cadenceAnchor: v.optional(v.string()), // e.g., day-of-month or 'last-day'
    timingFlexDays: v.optional(v.number()),

    // Next expected due date
    nextDueDate: v.optional(v.number()),
    lastOccurrenceDate: v.optional(v.number()),

    // Source: how was this rule created?
    source: v.optional(v.union(
      v.literal("auto_detected"),
      v.literal("user_defined"),
      v.literal("imported")
    )),

    autolinkEnabled: v.optional(v.boolean()),
    lastMatchedAt: v.optional(v.number()),
    active: v.boolean(),

    // Confidence estimate (0-100)
    confidence: v.number(),
    note: v.optional(v.string()),

    // User override / lock
    locked: v.optional(v.boolean()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_active", ["userId", "active"])
    .index("by_user_confidence", ["userId", "confidence"]),

  // ============================================
  // BUDGETS - Planning separated from logging
  // ============================================
  budgetCategories: defineTable({
    userId: v.string(),
    
    // Display name (e.g., "Groceries", "Entertainment")
    name: v.string(),
    // Optional icon identifier for custom icons
    icon: v.optional(v.string()),
    // Color for visualization
    color: v.optional(v.string()),

    // Parent budget for hierarchy (e.g., "Food" → "Groceries", "Dining Out")
    parentId: v.optional(v.id("budgetCategories")),
    
    // Budget period type
    periodType: v.union(
      v.literal("monthly"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("quarterly"),
      v.literal("yearly"),
      v.literal("custom")
    ),
    // For custom periods, specify days
    periodDays: v.optional(v.number()),
    // Period start anchor (e.g., day of month for monthly budgets)
    periodStartDay: v.optional(v.number()),
    
    // Budget amount in cents
    budgetAmountCents: v.number(),

    // Current period tracking (for rollover calculations)
    currentPeriodSpentCents: v.optional(v.number()),
    currentPeriodStartDate: v.optional(v.number()),
    rolloverAmountCents: v.optional(v.number()), // carried over from previous period
    
    // Rollover settings
    rolloverEnabled: v.optional(v.boolean()),
    rolloverCapCents: v.optional(v.number()), // max rollover amount
    
    // Categories/merchants that match this budget
    matchCategories: v.optional(v.array(v.string())),
    matchCategoryIds: v.optional(v.array(v.id("categories"))),
    matchMerchants: v.optional(v.array(v.string())),
    matchTags: v.optional(v.array(v.string())),

    // Health status (computed but cached for quick display)
    healthStatus: v.optional(v.union(
      v.literal("on_track"),
      v.literal("warning"),      // e.g., > 80% spent
      v.literal("overspent"),
      v.literal("under_budget")
    )),
    healthUpdatedAt: v.optional(v.number()),
    
    // Soft/hard limit
    isHardLimit: v.optional(v.boolean()),

    // Display order
    displayOrder: v.optional(v.number()),

    // User lock
    locked: v.optional(v.boolean()),
    
    // Archive instead of delete
    archived: v.optional(v.boolean()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archived"])
    .index("by_user_parent", ["userId", "parentId"]),

  // ============================================
  // GOALS - Intentional, time-bounded savings
  // ============================================
  goals: defineTable({
    userId: v.string(),
    
    // Display name (e.g., "Emergency Fund", "New Car")
    name: v.string(),
    // Optional description
    description: v.optional(v.string()),
    // Icon identifier
    icon: v.optional(v.string()),
    // Color for visualization
    color: v.optional(v.string()),
    
    // Goal type
    goalType: v.union(
      v.literal("savings"),     // Save toward a target
      v.literal("paydown"),     // Pay down debt
      v.literal("sinkingFund")  // Recurring expense preparation
    ),
    
    // Target amount in cents
    targetAmountCents: v.number(),
    // Current saved/paid amount in cents (updated via transactions)
    currentAmountCents: v.number(),

    // Progress percentage (cached for quick display, 0-100)
    progressPercent: v.optional(v.number()),
    
    // Timeline
    startDate: v.number(),
    targetDate: v.optional(v.number()),
    
    // For sinking funds - expected expense date/recurrence
    expectedExpenseDate: v.optional(v.number()),
    // Link to recurring rule for sinking fund auto-detection
    linkedRecurringRuleId: v.optional(v.id("recurringRules")),
    
    // Suggested monthly contribution (computed or user-set)
    suggestedMonthlyCents: v.optional(v.number()),
    
    // Funding source(s) - link to accounts
    fundingSource: v.optional(v.string()), // legacy string
    fundingAccountId: v.optional(v.id("accounts")),
    fundingAccountIds: v.optional(v.array(v.id("accounts"))), // multiple sources
    
    // Priority for ordering
    priority: v.optional(v.number()),

    // Display order
    displayOrder: v.optional(v.number()),

    // User lock
    locked: v.optional(v.boolean()),
    
    // Status
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("abandoned")
    ),

    // Archive flag
    archived: v.optional(v.boolean()),

    completedAt: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_archived", ["userId", "archived"])
    .index("by_user_type", ["userId", "goalType"]),

  // Goal contributions - track actual money moved toward goals
  goalContributions: defineTable({
    userId: v.string(),
    goalId: v.id("goals"),
    
    // Amount contributed in cents
    amountCents: v.number(),
    
    // Date of contribution
    date: v.number(),
    
    // Optional link to entry (for auto-tracking)
    entryId: v.optional(v.id("entries")),
    
    // Note
    note: v.optional(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_goal", ["goalId"])
    .index("by_user_date", ["userId", "date"]),

  // ============================================
  // GIG PROFILES - Context-aware intelligence
  // ============================================
  gigProfiles: defineTable({
    userId: v.string(),
    
    // Profile type
    profileType: v.union(
      v.literal("rideshare"),
      v.literal("delivery"),
      v.literal("freelance"),
      v.literal("rental"),
      v.literal("custom")
    ),
    
    // Display name (e.g., "Uber Driving", "Freelance Design")
    name: v.string(),
    
    // Platforms in this profile (e.g., ["Uber", "Lyft"])
    platforms: v.array(v.string()),
    
    // Expense categories to surface (e.g., ["Fuel", "Maintenance"])
    relevantExpenseCategories: v.optional(v.array(v.string())),
    
    // Default hourly rate for estimation
    defaultHourlyRateCents: v.optional(v.number()),
    
    // Mileage rate for deduction calculations (cents per mile)
    mileageRateCents: v.optional(v.number()),
    
    // Active toggle
    active: v.boolean(),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "active"]),

  // ============================================
  // USER PREFERENCES - Settings and notifications
  // ============================================
  userPreferences: defineTable({
    userId: v.string(),
    
    // Timezone & locale
    timezone: v.optional(v.string()), // e.g., "America/New_York"
    currency: v.optional(v.string()), // ISO 4217, e.g., "USD"
    locale: v.optional(v.string()), // e.g., "en-US"

    // Budget period alignment
    budgetMonthStartDay: v.optional(v.number()), // 1-28, default 1
    budgetWeekStartDay: v.optional(v.string()), // "sunday", "monday", etc.

    // Review reminder settings
    reviewReminderEnabled: v.optional(v.boolean()),
    reviewReminderDay: v.optional(v.string()), // e.g., "sunday", "monday"
    reviewReminderTime: v.optional(v.string()), // e.g., "09:00"
    reviewReminderFrequency: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    )),

    // Notification preferences
    notifyOnLargeTx: v.optional(v.boolean()),
    largeTxThresholdCents: v.optional(v.number()),
    notifyOnBudgetWarning: v.optional(v.boolean()),
    notifyOnGoalProgress: v.optional(v.boolean()),
    notifyOnRecurringDue: v.optional(v.boolean()),
    
    // UI preferences
    defaultTab: v.optional(v.string()),
    compactMode: v.optional(v.boolean()),
    showCents: v.optional(v.boolean()), // display cents or round to dollars
    darkMode: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),

    // Default account for new entries
    defaultAccountId: v.optional(v.id("accounts")),

    // Cash flow settings
    cashFlowLookbackDays: v.optional(v.number()), // e.g., 30, 60, 90
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ============================================
  // CASH FLOW SNAPSHOTS - Derived/cached data
  // ============================================
  cashFlowSnapshots: defineTable({
    userId: v.string(),

    // Period this snapshot covers
    periodType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    periodStart: v.number(),
    periodEnd: v.number(),

    // Aggregated values (in cents)
    totalIncomeCents: v.number(),
    totalExpenseCents: v.number(),
    netFlowCents: v.number(),

    // Breakdown by category (top N)
    topExpenseCategories: v.optional(v.array(v.object({
      category: v.string(),
      amountCents: v.number(),
    }))),
    topIncomeCategories: v.optional(v.array(v.object({
      category: v.string(),
      amountCents: v.number(),
    }))),

    // Surplus vs deficit
    isSurplus: v.optional(v.boolean()),

    // Computed at
    computedAt: v.number(),
  })
    .index("by_user_period", ["userId", "periodType", "periodStart"]),

  // ============================================
  // IMPORT BATCHES - Track data imports
  // ============================================
  importBatches: defineTable({
    userId: v.string(),

    // Source of import
    source: v.string(), // e.g., "csv", "plaid", "manual"
    fileName: v.optional(v.string()),

    // Stats
    totalRows: v.optional(v.number()),
    importedCount: v.optional(v.number()),
    skippedCount: v.optional(v.number()),
    errorCount: v.optional(v.number()),

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),

    // Errors
    errors: v.optional(v.array(v.string())),

    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),
});
