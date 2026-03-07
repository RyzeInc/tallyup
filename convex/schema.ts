import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  entries: defineTable({
    userId: v.string(), // Clerk subject

    // Type can be expense, income, or transfer (for internal account movements)
    type: v.union(v.literal("expense"), v.literal("income"), v.literal("transfer")),
    // Normalized transaction type for UI semantics
    transactionType: v.optional(
      v.union(v.literal("SPENT"), v.literal("RECEIVED"), v.literal("TRANSFER"))
    ),

    // Primary field: Category (expense) or Source (income) in UI
    category: v.optional(v.string()),
    // Canonical category reference (resolves to categories table)
    categoryId: v.optional(v.id("categories")),
    // Subcategory - more specific classification within category
    subcategoryId: v.optional(v.id("categories")),
    // Legacy field: will be migrated to category
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),

    note: v.optional(v.string()),
    // Optional explicit merchant/payee for cleaner analytics
    merchant: v.optional(v.string()),
    // User-provided title/description for the transaction
    title: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),

    // Money is stored as *integer cents* (validated in mutations).
    amountCents: v.number(),
    // Transaction status and classification
    status: v.optional(v.union(v.literal("pending"), v.literal("posted"))),
    entryType: v.optional(v.union(
      v.literal("purchase"),
      v.literal("refund"),
      v.literal("transfer"),
      v.literal("payment"),
      v.literal("income"),
      v.literal("fee")
    )),
    // Stable identity for pending -> posted dedupe
    stableId: v.optional(v.string()),
    // Link refunds/chargebacks to original entry
    originalEntryId: v.optional(v.id("entries")),
    // Optional split parts for multi-category entries
    splitParts: v.optional(v.array(v.object({
      budgetCategoryId: v.optional(v.id("budgetCategories")),
      amountCents: v.number(),
    }))),
    // Currency (default USD if unset)
    currency: v.optional(v.string()),

    // Local-midnight timestamp of when the money event occurred (used for indexes/filtering).
    // Kept as "date" for backwards compatibility with existing UI.
    date: v.number(),

    // Optional richer timestamps for future-proofing.
    // occurredAt: exact event time (can equal `date` in Phase 1)
    // enteredAt: when the user logged it
    occurredAt: v.optional(v.number()),
    enteredAt: v.optional(v.number()),

    // Safety valve so totals don't get wrecked by transfers/reimbursed noise.
    excludeFromTotals: v.optional(v.boolean()),
    // Exclude from budget calculations
    excludeFromBudgets: v.optional(v.boolean()),
    // Exclude from cash flow reports (internal transfers)
    excludeFromCashFlow: v.optional(v.boolean()),
    // Alias flags for newer semantics
    ignoredForBudgets: v.optional(v.boolean()),
    ignoredForInsights: v.optional(v.boolean()),

    // optional: a link to a detected or user-created recurring series/rule (typed id)
    recurringRuleId: v.optional(v.id("recurringRules")),
    // Recurring match metadata
    recurringMatch: v.optional(v.object({
      ruleId: v.optional(v.id("recurringRules")),
      expectedChargeId: v.optional(v.id("expectedCharges")),
      matchType: v.union(v.literal("auto"), v.literal("user")),
      score: v.optional(v.number()),
      explain: v.optional(v.any()),
    })),
    excludeFromRecurring: v.optional(v.boolean()),

    // Goal tracking - link entry to a goal for contribution tracking
    goalId: v.optional(v.id("goals")),

    // Gig worker fields - for hourly rate calculations
    hoursWorked: v.optional(v.number()), // decimal hours (e.g., 3.5)
    platformType: v.optional(v.string()), // e.g., "rideshare", "delivery", "freelance"
    gigGroup: v.optional(v.string()), // grouping for similar gigs (Uber+Lyft → "rideshare")

    // Optional link to budget category for tracking
    budgetCategoryId: v.optional(v.id("budgetCategories")),

    // Account tracking - which account this entry is from
    accountId: v.optional(v.id("accounts")),

    // Transfer tracking - links entry to a transfer record
    transferId: v.optional(v.id("transfers")),
    // Whether this is the source (outflow) side of a transfer
    isTransferSource: v.optional(v.boolean()),

    // Context tags (composable, multi-select): Personal, Business, Shared, etc.
    contextTags: v.optional(v.array(v.string())),
    // Intent tags (multi-select): Essential, Discretionary, Planned, Unexpected, etc.
    intentTags: v.optional(v.array(v.string())),

    // Merchant info - raw and normalized
    merchantRaw: v.optional(v.string()), // original merchant string
    merchantNormalized: v.optional(v.string()), // cleaned/mapped merchant name

    // Plaid enrichment data
    logoUrl: v.optional(v.string()),        // Merchant/transaction logo
    paymentChannel: v.optional(v.string()), // online, in store, other
    authorizedDate: v.optional(v.number()), // When the transaction was authorized
    plaidCategoryConfidence: v.optional(v.string()), // VERY_HIGH, HIGH, MEDIUM, LOW, UNKNOWN

    // Review reason - why this entry is in the inbox
    reviewReason: v.optional(v.string()), // "NEEDS_CATEGORY", "NEEDS_CONTEXT", "NEEDS_ACCOUNT"

    needsReview: v.boolean(),

    // Soft-delete fields for entries
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_needsReview_date", ["userId", "needsReview", "date"])
    .index("by_user_stableId", ["userId", "stableId"])
    .index("by_user_recurring", ["userId", "recurringRuleId"])
    .index("by_user_goal", ["userId", "goalId"])
    .index("by_user_budget", ["userId", "budgetCategoryId"])
    .index("by_user_budget_date", ["userId", "budgetCategoryId", "date"])
    .index("by_user_account", ["userId", "accountId"])
    .index("by_transfer", ["transferId"]),

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
    tags: v.optional(v.array(v.string())),

    // amount matching guidance
    amountCents: v.optional(v.number()), // expected amount (optional)
    minAmountCents: v.optional(v.number()),
    maxAmountCents: v.optional(v.number()),
    amountTolerancePercent: v.optional(v.number()), // e.g. 10 means ±10%
    amountMode: v.optional(v.union(v.literal("fixed"), v.literal("range"), v.literal("unknown"))),

    // Interval / cadence guidance
    intervalType: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("custom"))),
    intervalDays: v.optional(v.number()), // used when intervalType === 'custom'
    cadenceType: v.optional(v.union(v.literal("weekly"), v.literal("biweekly"), v.literal("semiMonthly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"), v.literal("custom"))),
    cadenceAnchor: v.optional(v.string()), // e.g., day-of-month or 'last-day'
    timingFlexDays: v.optional(v.number()),

    status: v.optional(v.union(
      v.literal("suggested"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("archived")
    )),
    merchantKeys: v.optional(v.array(v.string())),
    accountScope: v.optional(v.object({
      kind: v.union(v.literal("any"), v.literal("only")),
      accountIds: v.optional(v.array(v.id("accounts"))),
    })),
    amountPolicy: v.optional(v.object({
      kind: v.union(v.literal("fixed"), v.literal("range"), v.literal("variable")),
      amountCents: v.optional(v.number()),
      minCents: v.optional(v.number()),
      maxCents: v.optional(v.number()),
      toleranceBps: v.optional(v.number()),
    })),
    cadence: v.optional(v.object({
      kind: v.union(
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly"),
        v.literal("custom_days")
      ),
      intervalDays: v.optional(v.number()),
      anchorDate: v.optional(v.number()),
    })),
    budgetBehavior: v.optional(v.object({
      committed: v.boolean(),
      rollupKey: v.optional(v.string()),
    })),

    autolinkEnabled: v.optional(v.boolean()),
    lastMatchedAt: v.optional(v.number()),
    active: v.boolean(),

    // Confidence estimate (0-100)
    confidence: v.number(),
    note: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_active", ["userId", "active"])
    .index("by_user_confidence", ["userId", "confidence"])
    .index("by_user_status", ["userId", "status"]),

  expectedCharges: defineTable({
    userId: v.string(),
    ruleId: v.id("recurringRules"),
    expectedDate: v.number(),
    expectedAmountCents: v.optional(v.number()),
    state: v.union(
      v.literal("upcoming"),
      v.literal("due"),
      v.literal("matched"),
      v.literal("missed"),
      v.literal("skipped")
    ),
    matchedEntryId: v.optional(v.id("entries")),
    resolvedAt: v.optional(v.number()),
    resolutionNote: v.optional(v.string()),
    generatedAt: v.number(),
    generatedWindow: v.optional(v.string()),
  })
    .index("by_user_date", ["userId", "expectedDate"])
    .index("by_user_rule", ["userId", "ruleId"])
    .index("by_user_state", ["userId", "state"]),

  recurringInbox: defineTable({
    userId: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed")),
    type: v.union(
      v.literal("confirm_match"),
      v.literal("price_changed"),
      v.literal("missed_payment"),
      v.literal("cadence_drift"),
      v.literal("needs_details")
    ),
    ruleId: v.optional(v.id("recurringRules")),
    expectedChargeId: v.optional(v.id("expectedCharges")),
    entryId: v.optional(v.id("entries")),
    payload: v.optional(v.any()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_type", ["userId", "type"])
    .index("by_user_created", ["userId", "createdAt"]),

  analyticsEvents: defineTable({
    userId: v.string(),
    event: v.string(),
    data: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user_event", ["userId", "event"])
    .index("by_user_date", ["userId", "createdAt"]),

  // ============================================
  // CHAT CONVERSATIONS - Persistent chat threads (Chat SDK style)
  // ============================================
  chatConversations: defineTable({
    userId: v.string(),
    // Auto-generated title from first message or user-set
    title: v.string(),
    // Visibility: private (default), public (shareable)
    visibility: v.union(v.literal("private"), v.literal("public")),
    // Temporary chat mode (TTL-based): hidden from sidebar, auto-deleted
    isTemporary: v.boolean(),
    // When temporary chat expires (null for permanent chats)
    expiresAt: v.optional(v.number()),
    // Last activity for sorting
    lastMessageAt: v.number(),
    // Message count for display
    messageCount: v.number(),
    // Soft delete
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_lastMessage", ["userId", "lastMessageAt"])
    .index("by_user_temporary", ["userId", "isTemporary"])
    .index("by_user_archived", ["userId", "isArchived"])
    .index("by_expiresAt", ["expiresAt"]),

  chatMessages: defineTable({
    userId: v.string(),
    conversationId: v.id("chatConversations"),
    // Message role: user or assistant
    role: v.union(v.literal("user"), v.literal("assistant")),
    // Message content (markdown supported)
    content: v.string(),
    // Optional metadata from coach response
    metadata: v.optional(v.object({
      actions: v.optional(v.array(v.string())),
      followUps: v.optional(v.array(v.string())),
      contextHash: v.optional(v.string()),
      profileUpdates: v.optional(v.any()),
      foundationUpdates: v.optional(v.any()),
    })),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  // ============================================
  // COACHING - Alpha-safe financial coaching memory
  // ============================================
  coachState: defineTable({
    userId: v.string(),
    preferences: v.optional(v.any()),
    currentFocus: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
  coachSessionState: defineTable({
    userId: v.string(),
    summary: v.optional(v.string()),
    openLoops: v.optional(v.array(v.string())),
    // Slot ledger tracks what questions have been asked/answered to prevent loops
    slotLedger: v.optional(v.any()),
    // Track when user expressed frustration to trigger value-mode
    frustrationDetectedAt: v.optional(v.number()),
    // Rolling context of what facts have been established this session
    establishedFacts: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
  coachDraft: defineTable({
    userId: v.string(),
    profileDraft: v.optional(v.any()),
    foundationDraft: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  coachEvents: defineTable({
    userId: v.string(),
    createdAt: v.number(),
    userMessage: v.optional(v.string()),
    assistantMessage: v.optional(v.string()),
    summaryBullets: v.array(v.string()),
    actions: v.array(v.string()),
    openQuestions: v.array(v.string()),
    metricsUsed: v.optional(v.array(v.string())),
    contextHash: v.string(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"]),

  coachContextCache: defineTable({
    userId: v.string(),
    hash: v.string(),
    computedAt: v.number(),
    expiresAt: v.number(),
    packet: v.any(),
  })
    .index("by_user_computedAt", ["userId", "computedAt"]),

  coachFoundation: defineTable({
    userId: v.string(),
    snapshot: v.any(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
  coachMemory: defineTable({
    userId: v.string(),
    type: v.string(),
    content: v.string(),
    confidence: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    embedding: v.array(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_type", ["userId", "type"]),

  coachKnowledge: defineTable({
    docId: v.string(),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.number()),
    tokenCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_doc_chunk", ["docId", "chunkIndex"]),

  coachKnowledgeCache: defineTable({
    userId: v.string(),
    messageHash: v.string(),
    computedAt: v.number(),
    expiresAt: v.number(),
    snippets: v.array(v.object({
      docId: v.string(),
      chunkIndex: v.number(),
      content: v.string(),
      score: v.number(),
    })),
  })
    .index("by_user_message", ["userId", "messageHash"]),

  llmUsageDaily: defineTable({
    userId: v.string(),
    yyyymmdd: v.string(),
    calls: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_day", ["userId", "yyyymmdd"]),

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
    
    // Budget amount in cents
    budgetAmountCents: v.number(),
    
    // Rollover settings
    rolloverEnabled: v.optional(v.boolean()),
    rolloverCapCents: v.optional(v.number()), // max rollover amount
    
    // Categories/merchants that match this budget
    matchCategories: v.optional(v.array(v.string())),
    matchMerchants: v.optional(v.array(v.string())),
    matchTags: v.optional(v.array(v.string())),
    
    // Soft/hard limit
    isHardLimit: v.optional(v.boolean()),
    
    // Archive instead of delete
    archived: v.optional(v.boolean()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archived"]),

  // ============================================
  // BUDGET ENGINE - Canonical plans + policies
  // ============================================
  budgetGroups: defineTable({
    userId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archived"]),

  budgetGroupMembers: defineTable({
    userId: v.string(),
    budgetGroupId: v.id("budgetGroups"),
    budgetCategoryId: v.id("budgetCategories"),
    createdAt: v.number(),
  })
    .index("by_group", ["budgetGroupId"])
    .index("by_category", ["budgetCategoryId"])
    .index("by_user", ["userId"]),

  rolloverPolicies: defineTable({
    userId: v.string(),
    allowNegative: v.boolean(),
    resetAtBoundary: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly"),
      v.literal("never")
    ),
    capPositiveCents: v.optional(v.number()),
    capNegativeCents: v.optional(v.number()),
    reimbursementsRestoreAvailability: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  budgetPlans: defineTable({
    userId: v.string(),
    name: v.string(),
    planType: v.union(v.literal("category"), v.literal("group")),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    budgetGroupId: v.optional(v.id("budgetGroups")),
    frequency: v.union(
      v.literal("monthly"),
      v.literal("weekly"),
      v.literal("annual"),
      v.literal("custom")
    ),
    periodDays: v.optional(v.number()),
    amountCents: v.number(),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    rolloverPolicyId: v.optional(v.id("rolloverPolicies")),
    capPolicyId: v.optional(v.string()),
    overridesByMonth: v.optional(v.array(v.object({
      month: v.string(), // YYYY-MM
      amountCents: v.number(),
    }))),
    version: v.number(),
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "archived"])
    .index("by_user_category", ["userId", "budgetCategoryId"])
    .index("by_user_group", ["userId", "budgetGroupId"]),

  budgetPlanVersions: defineTable({
    userId: v.string(),
    planId: v.id("budgetPlans"),
    version: v.number(),
    frequency: v.union(
      v.literal("monthly"),
      v.literal("weekly"),
      v.literal("annual"),
      v.literal("custom")
    ),
    periodDays: v.optional(v.number()),
    amountCents: v.number(),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    rolloverPolicyId: v.optional(v.id("rolloverPolicies")),
    capPolicyId: v.optional(v.string()),
    overridesByMonth: v.optional(v.array(v.object({
      month: v.string(),
      amountCents: v.number(),
    }))),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_plan_version", ["planId", "version"])
    .index("by_plan_effective", ["planId", "effectiveFrom"]),

  budgetPeriods: defineTable({
    userId: v.string(),
    planId: v.id("budgetPlans"),
    planVersion: v.number(),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    budgetGroupId: v.optional(v.id("budgetGroups")),
    periodStart: v.number(),
    periodEnd: v.number(),
    budgetedCents: v.number(),
    spentCents: v.number(),
    carryInCents: v.number(),
    carryOutCents: v.number(),
    availableCents: v.number(),
    materializedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_period", ["userId", "periodStart", "periodEnd"])
    .index("by_user_plan_period", ["userId", "planId", "periodStart"]),

  budgetEntryImpacts: defineTable({
    userId: v.string(),
    entryId: v.id("entries"),
    periodId: v.id("budgetPeriods"),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    budgetGroupId: v.optional(v.id("budgetGroups")),
    amountCents: v.number(),
    appliedAt: v.number(),
  })
    .index("by_entry", ["entryId"])
    .index("by_period", ["periodId"])
    .index("by_user", ["userId"]),

  budgetDirtyQueue: defineTable({
    userId: v.string(),
    planId: v.optional(v.id("budgetPlans")),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    dirtyDate: v.number(),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("done")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_period", ["userId", "periodStart", "periodEnd"])
    .index("by_user_date", ["userId", "dirtyDate"])
    .index("by_status_created", ["status", "createdAt"]),

  budgetInsights: defineTable({
    userId: v.string(),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    budgetGroupId: v.optional(v.id("budgetGroups")),
    insightType: v.string(),
    lastPromptedAt: v.optional(v.number()),
    suppressed: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "insightType"]),

  userBudgetPrefs: defineTable({
    userId: v.string(),
    timezone: v.optional(v.string()),
    promptCadence: v.optional(v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    )),
    suppressedBudgetCategoryIds: v.optional(v.array(v.id("budgetCategories"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  incomeSchedules: defineTable({
    userId: v.string(),
    name: v.string(),
    amountCents: v.number(),
    cadenceType: v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("semiMonthly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly"),
      v.literal("custom")
    ),
    cadenceAnchor: v.optional(v.string()),
    intervalDays: v.optional(v.number()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "active"]),

  plannedOneOffs: defineTable({
    userId: v.string(),
    name: v.string(),
    amountCents: v.number(),
    date: v.number(),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    budgetGroupId: v.optional(v.id("budgetGroups")),
    type: v.union(v.literal("expense"), v.literal("income")),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

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
    
    // Timeline
    startDate: v.number(),
    targetDate: v.optional(v.number()),
    
    // For sinking funds - expected expense date/recurrence
    expectedExpenseDate: v.optional(v.number()),
    
    // Suggested monthly contribution (computed or user-set)
    suggestedMonthlyCents: v.optional(v.number()),
    
    // Funding source - link to account or method (legacy - kept for compatibility)
    fundingSource: v.optional(v.string()),
    
    // ========== NEW: Proper account and income linking for auto-funding ==========
    // Link to a specific account to fund this goal from
    fundingAccountId: v.optional(v.id("accounts")),
    
    // Income categories that auto-contribute to this goal (e.g., "Side Gig" income → "Emergency Fund")
    // When income with these categories comes in, optionally auto-allocate a percentage
    fundingIncomeCategories: v.optional(v.array(v.string())),
    
    // Auto-allocation percentage from linked income (0-100)
    // e.g., 20 means 20% of income from fundingIncomeCategories goes to this goal
    autoAllocatePercent: v.optional(v.number()),
    
    // Whether auto-allocation is enabled
    autoAllocateEnabled: v.optional(v.boolean()),
    
    // Priority for ordering
    priority: v.optional(v.number()),
    
    // Status
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    completedAt: v.optional(v.number()),
    
    // Archive instead of delete
    archived: v.optional(v.boolean()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
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
    .index("by_entry", ["entryId"])
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
    
    // UI preferences
    defaultTab: v.optional(v.string()),
    compactMode: v.optional(v.boolean()),
    
    // Onboarding state
    onboardingCompleted: v.optional(v.boolean()),
    onboardingState: v.optional(v.object({
      currentScreen: v.union(
        v.literal("income-sources"),
        v.literal("first-income"),
        v.literal("first-budget"),
        v.literal("dashboard")
      ),
      numIncomeSources: v.optional(v.number()),
      firstIncomeData: v.optional(v.object({
        type: v.string(),
        amountCents: v.number(),
        category: v.optional(v.string()),
        date: v.number(),
      })),
    })),
    
    // Category customization - hide default categories
    hiddenExpenseCategories: v.optional(v.array(v.string())),
    hiddenIncomeCategories: v.optional(v.array(v.string())),
    hiddenContextTags: v.optional(v.array(v.string())),
    
    // Category ordering - stored as arrays of category names
    expenseCategoryOrder: v.optional(v.array(v.string())),
    incomeCategoryOrder: v.optional(v.array(v.string())),
    contextTagOrder: v.optional(v.array(v.string())),
    
    // Pinned categories (legacy support)
    pinnedExpenseCategories: v.optional(v.array(v.string())),
    pinnedIncomeCategories: v.optional(v.array(v.string())),
    pinnedContextTags: v.optional(v.array(v.string())),
    
    // Dashboard layout - customizable widget arrangement
    // Stores array of widget placements with order, size, and visibility
    dashboardLayout: v.optional(v.object({
      version: v.number(),
      widgets: v.array(v.object({
        widgetId: v.string(),
        order: v.number(),
        size: v.union(
          v.literal("small"),
          v.literal("medium"),
          v.literal("large"),
          v.literal("full")
        ),
        visible: v.boolean(),
        settings: v.optional(v.any()),
      })),
      updatedAt: v.number(),
    })),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ============================================
  // ACCOUNTS - Manual-first account metadata
  // ============================================
  accounts: defineTable({
    userId: v.string(),

    // Nickname (required)
    name: v.string(),

    // Account type
    type: v.union(
      v.literal("credit"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("investment"),
      v.literal("loan"),
      v.literal("business"),
      v.literal("other")
    ),

    // Account subtype (from Plaid - more granular than type)
    subtype: v.optional(v.string()), // checking, savings, 401k, mortgage, credit card, etc.

    // Institution details
    institutionName: v.optional(v.string()),
    logoKey: v.optional(v.string()),
    last4: v.optional(v.string()),

    // Currency
    currency: v.optional(v.string()), // ISO currency code

    // Credit/debt fields
    creditLimit: v.optional(v.number()),
    apr: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    minPayment: v.optional(v.number()),

    // Liability fields (from Plaid Liabilities)
    isOverdue: v.optional(v.boolean()),
    minimumPaymentCents: v.optional(v.number()),
    nextPaymentDueDate: v.optional(v.number()),
    lastPaymentDate: v.optional(v.number()),
    lastPaymentAmountCents: v.optional(v.number()),

    // Mortgage-specific fields
    loanTerm: v.optional(v.string()),         // "30 year", "15 year"
    maturityDate: v.optional(v.number()),
    originationDate: v.optional(v.number()),
    originationPrincipalCents: v.optional(v.number()),
    escrowBalanceCents: v.optional(v.number()),
    hasPmi: v.optional(v.boolean()),

    // Student loan-specific fields
    loanStatus: v.optional(v.string()),       // repayment, in school, etc.
    repaymentPlan: v.optional(v.string()),    // standard, income-based, etc.
    expectedPayoffDate: v.optional(v.number()),

    // Investment display mode
    valuationMode: v.optional(v.union(v.literal("totalOnly"))),

    // Transaction selector toggle
    showInTransactionSelector: v.optional(v.boolean()),

    // Plaid link status
    isLinked: v.optional(v.boolean()), // true if connected via Plaid
    plaidAccountId: v.optional(v.string()), // Plaid's account ID for linking
    persistentPlaidAccountId: v.optional(v.string()), // Stable across re-links
    lastPlaidSync: v.optional(v.number()), // Last time balances were synced

    // Soft-delete
    isArchived: v.optional(v.boolean()),
    // Timestamp when the account was archived (ms since epoch)
    archivedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_archived", ["userId", "isArchived"])
    .index("by_plaidAccountId", ["plaidAccountId"]),

  // ============================================
  // ACCOUNT SNAPSHOTS - Balance history
  // ============================================
  accountSnapshots: defineTable({
    userId: v.string(),
    accountId: v.id("accounts"),
    asOf: v.number(),
    balance: v.number(),
    createdAt: v.number(),
  })
    .index("by_account_asOf", ["accountId", "asOf"])
    .index("by_user_asOf", ["userId", "asOf"]),

  // ============================================
  // CATEGORIES - Hierarchical category system
  // ============================================
  categories: defineTable({
    userId: v.string(),
    
    // Category name
    name: v.string(),

    // Stable slug for system categories
    slug: v.optional(v.string()),
    
    // Type: expense, income, or transfer
    categoryType: v.union(
      v.literal("expense"),
      v.literal("income"),
      v.literal("transfer")
    ),
    
    // Parent for hierarchy
    parentId: v.optional(v.id("categories")),
    
    // Display
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    displayOrder: v.optional(v.number()),
    
    // System category flag (cannot be deleted)
    isSystem: v.optional(v.boolean()),
    
    // Exclusion flags
    excludeFromBudgets: v.optional(v.boolean()),
    excludeFromReports: v.optional(v.boolean()),
    excludeFromCashFlow: v.optional(v.boolean()),
    
    // Archive instead of delete
    archived: v.optional(v.boolean()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "categoryType"])
    .index("by_user_slug", ["userId", "slug"]),

  // ============================================
  // CATEGORY RULES - Auto-categorization
  // ============================================
  categoryRules: defineTable({
    userId: v.string(),
    
    // Rule name for display
    name: v.optional(v.string()),
    
    // Match conditions
    matchMerchantContains: v.optional(v.string()),
    matchMerchantExact: v.optional(v.string()),
    matchNoteContains: v.optional(v.string()),
    matchAmountMinCents: v.optional(v.number()),
    matchAmountMaxCents: v.optional(v.number()),
    matchAccountId: v.optional(v.id("accounts")),
    
    // Actions
    assignCategoryId: v.optional(v.id("categories")),
    assignCategory: v.optional(v.string()),
    assignTags: v.optional(v.array(v.string())),
    renameMerchantTo: v.optional(v.string()),
    setExcludeFromTotals: v.optional(v.boolean()),
    setNeedsReview: v.optional(v.boolean()),
    
    // Priority (higher = runs first)
    priority: v.optional(v.number()),
    
    // Enable/disable
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
  // MERCHANT RULES - Merchant normalization
  // ============================================
  merchantRules: defineTable({
    userId: v.string(),
    
    // Pattern to match
    matchPattern: v.string(),
    
    // Match type
    matchType: v.union(
      v.literal("contains"),
      v.literal("exact"),
      v.literal("regex")
    ),
    
    // Normalized name
    normalizedName: v.string(),
    
    // Default category to assign
    defaultCategoryId: v.optional(v.id("categories")),
    defaultCategory: v.optional(v.string()),
    
    // Stats
    timesApplied: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ============================================
  // TRANSFERS - Internal account transfers
  // ============================================
  transfers: defineTable({
    userId: v.string(),
    
    // Amount in cents
    amountCents: v.number(),
    
    // Date
    date: v.number(),
    
    // Source and destination accounts
    fromAccountId: v.optional(v.id("accounts")),
    toAccountId: v.optional(v.id("accounts")),
    
    // Transfer type
    transferType: v.union(
      v.literal("internal"),
      v.literal("external"),
      v.literal("payment"),
      v.literal("investment")
    ),
    
    // Linked entries
    fromEntryId: v.optional(v.id("entries")),
    toEntryId: v.optional(v.id("entries")),
    
    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    
    note: v.optional(v.string()),
    
    // Reconciliation
    reconciled: v.optional(v.boolean()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"]),

  // ============================================
  // INVESTMENTS - Portfolio tracking
  // ============================================
  investments: defineTable({
    userId: v.string(),
    
    // Account holding this investment
    accountId: v.optional(v.id("accounts")),
    
    // Plaid links (for synced investments)
    plaidSecurityId: v.optional(v.id("plaidSecurities")),
    plaidHoldingId: v.optional(v.id("plaidHoldings")),
    
    // Ticker symbol
    symbol: v.optional(v.string()),
    
    // Display name
    name: v.string(),
    
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
    
    // Security identifiers
    isin: v.optional(v.string()),
    cusip: v.optional(v.string()),
    
    // Classification
    sector: v.optional(v.string()),
    industry: v.optional(v.string()),
    
    // Holdings
    quantity: v.number(),
    costBasisCents: v.number(),
    
    // Vesting (RSUs, options)
    vestedQuantity: v.optional(v.number()),
    unvestedQuantity: v.optional(v.number()),
    
    // Current valuation
    currentPriceCents: v.optional(v.number()),
    currentValueCents: v.optional(v.number()),
    priceAsOf: v.optional(v.number()),
    valuationAsOf: v.optional(v.number()),
    
    // Currency
    isoCurrencyCode: v.optional(v.string()),
    
    // Unrealized gain/loss
    unrealizedGainCents: v.optional(v.number()),
    
    // Realized gain/loss (from sold portions)
    realizedGainCents: v.optional(v.number()),
    
    // Purchase info
    purchaseDate: v.optional(v.number()),
    purchasePriceCents: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"])
    .index("by_plaidSecurity", ["plaidSecurityId"])
    .index("by_plaidHolding", ["plaidHoldingId"]),

  // ============================================
  // PLAID INTEGRATION - Financial Aggregation
  // ============================================
  
  // Plaid Items (linked institutions)
  plaidItems: defineTable({
    userId: v.string(),
    
    // Plaid identifiers
    itemId: v.string(),
    accessToken: v.string(), // Should be encrypted in production
    
    // Institution details
    institutionId: v.optional(v.string()),
    institutionName: v.optional(v.string()),
    institutionLogo: v.optional(v.string()),
    institutionColor: v.optional(v.string()),
    
    // Products enabled on this item
    products: v.optional(v.array(v.string())),           // Products user linked with
    availableProducts: v.optional(v.array(v.string())), // Products available but not enabled
    billedProducts: v.optional(v.array(v.string())),    // Products being billed
    consentedProducts: v.optional(v.array(v.string())), // Products user consented to
    
    // Consent expiration (for European institutions)
    consentExpirationTime: v.optional(v.number()),
    
    // Status
    status: v.union(
      v.literal("active"),
      v.literal("needs_reauth"),
      v.literal("revoked"),
      v.literal("error")
    ),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    
    // Update mode
    updateType: v.optional(v.string()), // background, user_present_required
    
    // Sync state
    lastSyncedAt: v.optional(v.number()),
    transactionCursor: v.optional(v.string()),
    investmentsCursor: v.optional(v.string()),   // For investments sync
    lastInvestmentsSyncAt: v.optional(v.number()),
    lastLiabilitiesSyncAt: v.optional(v.number()),
    lastRecurringSyncAt: v.optional(v.number()), // For recurring streams sync
    
    // Webhook
    webhookUrl: v.optional(v.string()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_itemId", ["itemId"]),

  // Plaid Accounts (linked from Plaid to TallyUp accounts)
  plaidAccounts: defineTable({
    userId: v.string(),
    
    // Links
    plaidItemId: v.id("plaidItems"),
    accountId: v.id("accounts"), // TallyUp account
    
    // Plaid identifiers
    plaidAccountId: v.string(),
    
    // Account details from Plaid
    name: v.string(),
    officialName: v.optional(v.string()),
    type: v.string(),
    subtype: v.optional(v.string()),
    mask: v.optional(v.string()),
    
    // Balances (in dollars, as returned by Plaid)
    balanceCurrent: v.optional(v.number()),
    balanceAvailable: v.optional(v.number()),
    balanceLimit: v.optional(v.number()),
    currency: v.optional(v.string()),
    
    // UI state
    isHidden: v.boolean(),
    
    // Sync state
    lastSyncedAt: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_plaidItem", ["plaidItemId"])
    .index("by_account", ["accountId"])
    .index("by_plaidAccountId", ["plaidAccountId"]),

  // Plaid Transactions (raw transactions from Plaid before import)
  plaidTransactions: defineTable({
    userId: v.string(),
    
    // Links
    plaidAccountId: v.id("plaidAccounts"),
    entryId: v.optional(v.id("entries")), // Link to TallyUp entry
    
    // Plaid identifiers
    plaidTransactionId: v.string(),
    pendingTransactionId: v.optional(v.string()),
    
    // Transaction details
    amount: v.number(), // In dollars (Plaid convention: positive = outflow)
    date: v.string(), // YYYY-MM-DD
    datetime: v.optional(v.string()),
    authorizedDate: v.optional(v.string()),      // When authorized
    authorizedDatetime: v.optional(v.string()),  // Authorization timestamp
    name: v.string(),
    merchantName: v.optional(v.string()),
    pending: v.boolean(),
    
    // Categories
    category: v.optional(v.string()),
    categoryDetailed: v.optional(v.string()),
    categoryConfidence: v.optional(v.string()), // VERY_HIGH, HIGH, MEDIUM, LOW, UNKNOWN
    categoryIconUrl: v.optional(v.string()),
    
    // Payment details
    paymentChannel: v.string(), // "online", "in store", "other"
    transactionType: v.optional(v.string()),
    transactionCode: v.optional(v.string()),
    checkNumber: v.optional(v.string()),
    
    // Location (expanded)
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
    
    // Counterparties (for marketplace/payment platforms)
    counterparties: v.optional(v.array(v.object({
      name: v.optional(v.string()),
      type: v.optional(v.string()), // merchant, marketplace, payment_terminal
      logoUrl: v.optional(v.string()),
      website: v.optional(v.string()),
      entityId: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
      confidenceLevel: v.optional(v.string()),
    }))),
    
    // Currency
    isoCurrencyCode: v.optional(v.string()),
    unofficialCurrencyCode: v.optional(v.string()),
    
    // Import status
    importStatus: v.union(
      v.literal("pending"),
      v.literal("imported"),
      v.literal("skipped"),
      v.literal("duplicate")
    ),
    importedAt: v.optional(v.number()),
    skipReason: v.optional(v.string()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_plaidAccount", ["plaidAccountId"])
    .index("by_entry", ["entryId"])
    .index("by_plaidTransactionId", ["plaidTransactionId"])
    .index("by_user_importStatus", ["userId", "importStatus"])
    .index("by_user_date", ["userId", "date"]),

    // Plaid Sync Log (audit trail for syncs)
  plaidSyncLogs: defineTable({
    userId: v.string(),
    plaidItemId: v.id("plaidItems"),
    
    // Sync details
    syncType: v.union(
      v.literal("initial"),
      v.literal("incremental"),
      v.literal("manual"),
      v.literal("webhook")
    ),
    
    // Results
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed")
    ),
    transactionsAdded: v.optional(v.number()),
    transactionsModified: v.optional(v.number()),
    transactionsRemoved: v.optional(v.number()),
    
    // Error info
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    
    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_plaidItem", ["plaidItemId"])
    .index("by_user_status", ["userId", "status"]),

  // ============================================
  // PLAID SECURITIES - Stock/fund metadata from Plaid
  // ============================================
  plaidSecurities: defineTable({
    // Plaid identifiers
    securityId: v.string(),                         // Primary Plaid security ID
    isin: v.optional(v.string()),                   // ISIN code
    cusip: v.optional(v.string()),                  // CUSIP code
    sedol: v.optional(v.string()),                  // SEDOL code
    institutionSecurityId: v.optional(v.string()),  // Institution's internal ID
    institutionId: v.optional(v.string()),          // Institution
    tickerSymbol: v.optional(v.string()),           // Ticker (AAPL, etc.)
    
    // Security info
    name: v.string(),
    securityType: v.string(),                       // cash, cryptocurrency, derivative, equity, etf, fixed income, loan, mutual fund, other
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
    
    // Option contract details (if applicable)
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
    .index("by_ticker", ["tickerSymbol"])
    .index("by_isin", ["isin"])
    .index("by_cusip", ["cusip"]),

  // ============================================
  // PLAID HOLDINGS - Investment positions from Plaid
  // ============================================
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
    .index("by_security", ["plaidSecurityId"])
    .index("by_investment", ["investmentId"]),

  // ============================================
  // PLAID INVESTMENT TRANSACTIONS - Trades, dividends, etc.
  // ============================================
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
    transactionType: v.string(),  // buy, sell, cancel, cash, fee, transfer
    subtype: v.optional(v.string()), // dividend, contribution, deposit, withdrawal, etc.
    
    // Currency
    isoCurrencyCode: v.optional(v.string()),
    
    // TallyUp link (optionally create entry for dividends, contributions, etc.)
    entryId: v.optional(v.id("entries")),
    
    // Import status
    importStatus: v.union(
      v.literal("pending"),
      v.literal("imported"),
      v.literal("skipped")
    ),
    importedAt: v.optional(v.number()),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["plaidAccountId"])
    .index("by_security", ["plaidSecurityId"])
    .index("by_transactionId", ["investmentTransactionId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_importStatus", ["userId", "importStatus"]),

  // ============================================
  // PLAID LIABILITIES - Credit, mortgage, student loan details
  // ============================================
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
    
    // Common fields across all liability types
    accountNumber: v.optional(v.string()),
    isOverdue: v.optional(v.boolean()),
    lastPaymentAmount: v.optional(v.number()),
    lastPaymentDate: v.optional(v.string()),
    lastStatementIssueDate: v.optional(v.string()),
    minimumPaymentAmount: v.optional(v.number()),
    nextPaymentDueDate: v.optional(v.string()),
    
    // ---- Credit Card specific fields ----
    aprs: v.optional(v.array(v.object({
      aprPercentage: v.number(),
      aprType: v.string(), // balance_transfer_apr, cash_apr, purchase_apr, special
      balanceSubjectToApr: v.optional(v.number()),
      interestChargeAmount: v.optional(v.number()),
    }))),
    lastStatementBalance: v.optional(v.number()),
    
    // ---- Mortgage specific fields ----
    currentLateFee: v.optional(v.number()),
    escrowBalance: v.optional(v.number()),
    hasPmi: v.optional(v.boolean()),
    hasPrepaymentPenalty: v.optional(v.boolean()),
    interestRate: v.optional(v.object({
      percentage: v.number(),
      type: v.string(), // fixed, variable
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
    
    // ---- Student Loan specific fields ----
    disbursementDates: v.optional(v.array(v.string())),
    expectedPayoffDate: v.optional(v.string()),
    guarantor: v.optional(v.string()),
    interestRatePercentage: v.optional(v.number()),
    loanName: v.optional(v.string()),
    loanStatus: v.optional(v.object({
      type: v.string(), // cancelled, in grace, in military, in school, etc.
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
      type: v.string(), // standard, graduated, income-based, etc.
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
    .index("by_tallyup_account", ["accountId"])
    .index("by_type", ["liabilityType"]),

  // ============================================
  // PLAID RECURRING STREAMS - Detected recurring transactions from Plaid
  // ============================================
  plaidRecurringStreams: defineTable({
    userId: v.string(),
    plaidAccountId: v.id("plaidAccounts"),
    accountId: v.id("accounts"),
    
    // Plaid stream identifiers
    streamId: v.string(),                           // Plaid's stream_id
    
    // Stream direction: inflow (income) or outflow (expense)
    streamType: v.union(v.literal("inflow"), v.literal("outflow")),
    
    // Stream details from Plaid
    merchantName: v.optional(v.string()),
    description: v.optional(v.string()),
    
    // Plaid category
    categoryId: v.optional(v.string()),             // Plaid category ID
    category: v.optional(v.array(v.string())),      // Category hierarchy
    personalFinanceCategory: v.optional(v.object({
      primary: v.optional(v.string()),
      detailed: v.optional(v.string()),
    })),
    
    // Frequency and timing
    frequency: v.union(
      v.literal("WEEKLY"),
      v.literal("BIWEEKLY"),
      v.literal("SEMI_MONTHLY"),
      v.literal("MONTHLY"),
      v.literal("ANNUALLY"),
      v.literal("UNKNOWN")
    ),
    averageDaysBetween: v.optional(v.number()),
    
    // Amount info
    averageAmountCents: v.number(),                 // Average amount in cents (absolute)
    lastAmountCents: v.number(),                    // Most recent amount in cents (absolute)
    isAmountVariable: v.optional(v.boolean()),
    
    // Dates
    firstDate: v.string(),                          // YYYY-MM-DD
    lastDate: v.string(),                           // YYYY-MM-DD
    predictedNextDate: v.optional(v.string()),      // YYYY-MM-DD
    
    // Stream status
    isActive: v.boolean(),
    status: v.union(
      v.literal("MATURE"),                          // Well-established pattern
      v.literal("EARLY_DETECTION"),                 // Recently detected
      v.literal("TOMBSTONED")                       // No longer active
    ),
    
    // Transaction IDs in this stream
    transactionIds: v.optional(v.array(v.string())), // Plaid transaction_ids
    transactionCount: v.optional(v.number()),
    
    // Link to TallyUp recurring rule (if matched/created)
    recurringRuleId: v.optional(v.id("recurringRules")),
    
    // Sync metadata
    lastSyncedAt: v.number(),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_streamId", ["streamId"])
    .index("by_account", ["plaidAccountId"])
    .index("by_recurringRule", ["recurringRuleId"])
    .index("by_user_type", ["userId", "streamType"])
    .index("by_user_status", ["userId", "status"]),
});
