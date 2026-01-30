import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };

async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get all non-temporary, non-archived conversations for the current user
 * Sorted by last message timestamp (most recent first)
 */
export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = args.limit ?? 50;

    const conversations = await ctx.db
      .query("chatConversations")
      .withIndex("by_user_lastMessage", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) =>
        q.and(
          q.eq(q.field("isTemporary"), false),
          q.or(
            q.eq(q.field("isArchived"), false),
            q.eq(q.field("isArchived"), undefined)
          )
        )
      )
      .take(limit);

    return conversations;
  },
});

/**
 * Get a single conversation by ID (with auth check)
 */
export const getConversation = query({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    return conversation;
  },
});

/**
 * Get all messages for a conversation
 */
export const getMessages = query({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    // Verify user owns this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      return [];
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return messages;
  },
});

/**
 * Check if user has any saved conversations (for empty state logic)
 */
export const hasConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const first = await ctx.db
      .query("chatConversations")
      .withIndex("by_user_lastMessage", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isTemporary"), false),
          q.or(
            q.eq(q.field("isArchived"), false),
            q.eq(q.field("isArchived"), undefined)
          )
        )
      )
      .first();

    return first !== null;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new conversation
 * Called when user sends first message in a new chat
 */
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    isTemporary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const isTemporary = args.isTemporary ?? false;
    // Temporary chats expire in 24 hours
    const expiresAt = isTemporary ? now + 24 * 60 * 60 * 1000 : undefined;

    const conversationId = await ctx.db.insert("chatConversations", {
      userId,
      title: args.title ?? "New conversation",
      visibility: "private",
      isTemporary,
      expiresAt,
      lastMessageAt: now,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

/**
 * Add a message to a conversation
 */
export const addMessage = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    metadata: v.optional(v.object({
      actions: v.optional(v.array(v.string())),
      followUps: v.optional(v.array(v.string())),
      contextHash: v.optional(v.string()),
      profileUpdates: v.optional(v.any()),
      foundationUpdates: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    // Verify user owns this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Add the message
    const messageId = await ctx.db.insert("chatMessages", {
      userId,
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: now,
    });

    // Update conversation metadata
    const updates: {
      lastMessageAt: number;
      messageCount: number;
      updatedAt: number;
      title?: string;
    } = {
      lastMessageAt: now,
      messageCount: conversation.messageCount + 1,
      updatedAt: now,
    };

    // Auto-title from first user message if still "New conversation"
    if (
      conversation.title === "New conversation" &&
      args.role === "user" &&
      conversation.messageCount === 0
    ) {
      // Truncate to first 50 chars for title
      updates.title = args.content.slice(0, 50) + (args.content.length > 50 ? "..." : "");
    }

    await ctx.db.patch(args.conversationId, updates);

    return messageId;
  },
});

/**
 * Update conversation title
 */
export const updateTitle = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete (archive) a conversation
 */
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Soft delete
    await ctx.db.patch(args.conversationId, {
      isArchived: true,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Convert a temporary conversation to permanent
 */
export const saveTemporaryConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    if (!conversation.isTemporary) {
      return; // Already saved
    }

    await ctx.db.patch(args.conversationId, {
      isTemporary: false,
      expiresAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clean up expired temporary conversations
 * Called by cron job
 */
export const cleanupExpiredConversations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired temporary conversations
    const expired = await ctx.db
      .query("chatConversations")
      .withIndex("by_expiresAt")
      .filter((q) =>
        q.and(
          q.eq(q.field("isTemporary"), true),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .take(100);

    // Delete messages and conversations
    for (const conversation of expired) {
      // Delete all messages
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete conversation
      await ctx.db.delete(conversation._id);
    }

    return { deleted: expired.length };
  },
});
