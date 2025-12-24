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

    needsReview: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_needsReview_date", ["userId", "needsReview", "date"]),
});
