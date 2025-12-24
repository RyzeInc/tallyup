import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  entries: defineTable({
    userId: v.string(), // Clerk subject

    type: v.union(v.literal("expense"), v.literal("income")),

    bucket: v.string(),                 // "Personal", "Work", etc.
    category: v.optional(v.string()),   // free text
    tags: v.optional(v.array(v.string())),

    note: v.optional(v.string()),
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

    needsReview: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_needsReview_date", ["userId", "needsReview", "date"])
    .index("by_user_recurring", ["userId", "recurringRuleId"]),

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
});
