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

    amountCents: v.number(),
    date: v.number(), // local midnight timestamp

    needsReview: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .index("by_user_needsReview_date", ["userId", "needsReview", "date"]),
});
