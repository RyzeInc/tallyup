"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";

interface ChatSidebarProps {
  activeConversationId: Id<"chatConversations"> | null;
  onSelectConversation: (id: Id<"chatConversations">) => void;
  onNewChat: (isTemporary?: boolean) => void;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * ChatSidebar - Chat SDK-style sidebar with conversation history
 * 
 * Features:
 * - Collapsible on both mobile and desktop
 * - Conversations only appear after first message
 * - Delete conversation
 */
export default function ChatSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  isOpen,
  onToggle,
}: ChatSidebarProps) {
  const conversations = useQuery(api.chatConversations.listConversations, { limit: 50 });
  const deleteConversation = useMutation(api.chatConversations.deleteConversation);
  const [deletingId, setDeletingId] = useState<Id<"chatConversations"> | null>(null);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: Id<"chatConversations">) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteConversation({ conversationId: id });
      // If we deleted the active conversation, trigger new chat
      if (id === activeConversationId) {
        onNewChat();
      }
    } finally {
      setDeletingId(null);
    }
  }, [deleteConversation, activeConversationId, onNewChat]);

  // Group conversations by date
  const groupedConversations = groupByDate(conversations ?? []);

  // If collapsed, don't render the sidebar content
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile overlay - only on small screens */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onToggle}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className="absolute md:relative inset-y-0 left-0 z-50 md:z-auto flex-shrink-0 h-full"
        style={{
          width: "280px",
          backgroundColor: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header - matches main chat header height */}
          <div
            className="flex items-center px-4 shrink-0"
            style={{ borderBottom: "1px solid var(--border)", height: "48px" }}
          >
            <span
              className="text-base font-semibold"
              style={{ color: "var(--text)" }}
            >
              Conversations
            </span>
          </div>

          {/* New Chat Button */}
          <div className="px-3 py-2">
            <button
              onClick={() => onNewChat(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium"
              style={{
                backgroundColor: "var(--primary)",
                color: "#FFFFFF",
              }}
            >
              <Lucide.Plus size={18} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2">
            {!conversations ? (
              // Loading state
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg animate-pulse"
                    style={{ backgroundColor: "var(--surface-2)" }}
                  />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              // Empty state
              <div
                className="text-center py-8 px-4"
                style={{ color: "var(--text-secondary)" }}
              >
                <Lucide.MessageSquare
                  size={32}
                  className="mx-auto mb-2 opacity-50"
                />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">
                  Start chatting to see your history here
                </p>
              </div>
            ) : (
              // Grouped conversation list
              <div className="space-y-4">
                {Object.entries(groupedConversations).map(([label, convos]) => (
                  <div key={label}>
                    <div
                      className="px-2 py-1 text-xs font-medium uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {label}
                    </div>
                    <div className="space-y-1">
                      {convos.map((conversation) => (
                        <ConversationItem
                          key={conversation._id}
                          conversation={conversation}
                          isActive={conversation._id === activeConversationId}
                          isDeleting={conversation._id === deletingId}
                          onSelect={() => onSelectConversation(conversation._id)}
                          onDelete={(e) => handleDelete(e, conversation._id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

interface ConversationItemProps {
  conversation: {
    _id: Id<"chatConversations">;
    title: string;
    lastMessageAt: number;
    messageCount: number;
  };
  isActive: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ConversationItem({
  conversation,
  isActive,
  isDeleting,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className="w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer relative"
      style={{
        backgroundColor: isActive ? "var(--surface-2)" : "transparent",
        opacity: isDeleting ? 0.5 : 1,
      }}
    >
      <div className="flex items-start gap-2 pr-8">
        <div className="flex-1 min-w-0">
          <div
            className="font-medium truncate text-sm"
            style={{ color: "var(--text)" }}
          >
            {conversation.title}
          </div>
          <div
            className="text-xs truncate mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {conversation.messageCount} message{conversation.messageCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Delete button - positioned absolutely to avoid nesting issues */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(e);
        }}
        className={`
          absolute right-2 top-1/2 -translate-y-1/2
          p-1.5 rounded-md transition-opacity
          hover:bg-red-100 dark:hover:bg-red-900/30
          ${showDelete || isActive ? "opacity-100" : "opacity-0"}
        `}
        aria-label="Delete conversation"
        title="Delete conversation"
      >
        <Lucide.Trash2
          size={14}
          style={{ color: "var(--danger, #EF4444)" }}
        />
      </button>
    </div>
  );
}

// Helper to group conversations by date
function groupByDate(conversations: Array<{ _id: Id<"chatConversations">; title: string; lastMessageAt: number; messageCount: number }>) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const lastWeek = today - 7 * 24 * 60 * 60 * 1000;
  const lastMonth = today - 30 * 24 * 60 * 60 * 1000;

  const groups: Record<string, typeof conversations> = {
    Today: [],
    Yesterday: [],
    "Last 7 days": [],
    "Last 30 days": [],
    Older: [],
  };

  for (const conv of conversations) {
    const date = conv.lastMessageAt;
    if (date >= today) {
      groups.Today.push(conv);
    } else if (date >= yesterday) {
      groups.Yesterday.push(conv);
    } else if (date >= lastWeek) {
      groups["Last 7 days"].push(conv);
    } else if (date >= lastMonth) {
      groups["Last 30 days"].push(conv);
    } else {
      groups.Older.push(conv);
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([, convos]) => convos.length > 0)
  );
}

/**
 * SidebarToggle - Button to open/close sidebar
 */
export function SidebarToggle({ 
  onClick, 
  isOpen 
}: { 
  onClick: () => void; 
  isOpen: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isOpen ? (
        <Lucide.PanelLeftClose size={20} style={{ color: "var(--text)" }} />
      ) : (
        <Lucide.PanelLeft size={20} style={{ color: "var(--text)" }} />
      )}
    </button>
  );
}
