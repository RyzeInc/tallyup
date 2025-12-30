import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  entries: defineTable({
    userId: v.string(), // Clerk subject

    type: v.union(v.literal("expense"), v.literal("income")),

    // Primary field: Category (expense) or Source (income) in UI
    category: v.optional(v.string()),
    // Legacy field: will be migrated to category
    bucket: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),

    note: v.optional(v.string()),
    // Optional explicit merchant/payee for cleaner analytics
    merchant: v.optional(v.string()),
    methodOrAccount: v.optional(v.string()),

    // Money is stored as *integer cents* (validated in mutations).
    amountCents: v.number(),

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

    needsReview: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_needsReview_date", ["userId", "needsReview", "date"])
    .index("by_user_recurring", ["userId", "recurringRuleId"])
    .index("by_user_goal", ["userId", "goalId"])
    .index("by_user_budget", ["userId", "budgetCategoryId"]),

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
    
    // Funding source - link to account or method
    fundingSource: v.optional(v.string()),
    
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
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
});
