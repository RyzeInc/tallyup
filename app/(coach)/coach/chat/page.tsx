"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useAction, useMutation, useConvex } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter } from "next/navigation";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";

// UI Components
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";

// Coach Components
import ChatSidebar, { SidebarToggle } from "@/components/coach/ChatSidebar";
import CoachAvatar from "@/components/coach/CoachAvatar";
import CoachMessageBubble from "@/components/coach/CoachMessageBubble";
import FollowUpSuggestions from "@/components/coach/FollowUpSuggestions";

// Utils
import { formatProfileUpdate } from "@/lib/coach/formatProfile";
import { formatFoundationUpdate } from "@/lib/coach/formatFoundation";
import type { CoachProfileUpdate } from "@/lib/coach/profile";
import type { CoachFoundationUpdate } from "@/lib/coach/foundation";

/**
 * ChatPage - Chat SDK-style chat interface with sidebar
 * 
 * Features:
 * - Collapsible sidebar with conversation history
 * - Persistent conversations
 * - Temporary chat mode
 * - Streaming-style message display (uses existing coach action)
 */

type ChatMessage = { 
  id?: string;
  role: "user" | "assistant"; 
  content: string; 
  timestamp: number;
  actions?: string[];
  followUps?: string[];
  metadata?: {
    actions?: string[];
    followUps?: string[];
    contextHash?: string;
    profileUpdates?: CoachProfileUpdate;
    foundationUpdates?: CoachFoundationUpdate;
  };
};

const SNAPSHOT_TTL_MS = 90 * 1000;

type CoachSnapshot = {
  contextHash: string;
  snapshot: {
    monthLabel: string;
    cashflow: {
      incomeCents: number;
      expenseCents: number;
      netCents: number;
    };
    topCategories: Array<{ category: string; amountCents: number }>;
    upcomingBills: Array<{ name: string; expectedDate: number; expectedAmountCents?: number }>;
    anomalies: Array<{ category: string; deltaCents: number; reason: string }>;
    currentFocus: string | null;
    recentSummaries: string[];
    updatedAt: number;
    foundation?: { updatedAt: number; hasFoundation: boolean };
  };
};

// Default suggestions for empty state
const STARTER_SUGGESTIONS = [
  "How much can I afford to spend this week?",
  "What's my biggest expense this month?",
  "Help me create a savings plan",
  "Should I pay off debt or save?",
];

export default function ChatPage() {
  const router = useRouter();
  const convex = useConvex();

  // Sidebar state - default open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Conversation state
  const [activeConversationId, setActiveConversationId] = useState<Id<"chatConversations"> | null>(null);
  const [isTemporaryMode, setIsTemporaryMode] = useState(false);

  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "thinking">("idle");

  // Context state
  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null);
  const [contextHash, setContextHash] = useState<string | null>(null);
  const snapshotCache = useRef<{ data: CoachSnapshot; fetchedAt: number } | null>(null);

  // Profile/Foundation updates
  const [profileUpdate, setProfileUpdate] = useState<CoachProfileUpdate | null>(null);
  const [foundationUpdate, setFoundationUpdate] = useState<CoachFoundationUpdate | null>(null);
  const [applyingProfile, setApplyingProfile] = useState(false);
  const [applyingFoundation, setApplyingFoundation] = useState(false);

  // Save error state
  const [saveError, setSaveError] = useState<{ messageIndex: number; content: string } | null>(null);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Convex operations
  const sendMessage = useAction(api.coach.chat);
  const updateCoachState = useMutation(api.coach.updateCoachState);
  const updateCoachFoundation = useMutation(api.coach.updateCoachFoundation);
  const resetSession = useMutation(api.coach.resetSession);
  const createConversation = useMutation(api.chatConversations.createConversation);
  const addMessage = useMutation(api.chatConversations.addMessage);
  const saveTemporaryConversation = useMutation(api.chatConversations.saveTemporaryConversation);
  
  // Load messages for active conversation
  const conversationMessages = useQuery(
    api.chatConversations.getMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip"
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Load snapshot on mount
  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      const now = Date.now();
      if (snapshotCache.current && now - snapshotCache.current.fetchedAt < SNAPSHOT_TTL_MS) {
        setSnapshot(snapshotCache.current.data);
        setContextHash(snapshotCache.current.data.contextHash);
        return;
      }

      try {
        const data = await convex.query(api.coach.getSnapshot, {});
        if (!cancelled && data) {
          snapshotCache.current = { data, fetchedAt: Date.now() };
          setSnapshot(data);
          setContextHash(data.contextHash);
        }
      } catch {
        // Ignore errors
      }
    };

    loadSnapshot();
    return () => { cancelled = true; };
  }, [convex]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationMessages) {
      const loadedMessages: ChatMessage[] = conversationMessages.map((msg) => ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        actions: msg.metadata?.actions,
        followUps: msg.metadata?.followUps,
        metadata: msg.metadata,
      }));
      setMessages(loadedMessages);
    }
  }, [conversationMessages]);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((id: Id<"chatConversations">) => {
    // If in temporary mode with unsaved messages, auto-discard (per spec)
    setActiveConversationId(id);
    setIsTemporaryMode(false);
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Handle new chat
  const handleNewChat = useCallback(async (isTemporary = false) => {
    setActiveConversationId(null);
    setMessages([]);
    setIsTemporaryMode(isTemporary);
    setProfileUpdate(null);
    setFoundationUpdate(null);
    setSaveError(null);
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    // Reset coach session for fresh context
    try {
      await resetSession({});
      snapshotCache.current = null;
      const data = await convex.query(api.coach.getSnapshot, {});
      if (data) {
        snapshotCache.current = { data, fetchedAt: Date.now() };
        setSnapshot(data);
        setContextHash(data.contextHash);
      }
    } catch {
      // Ignore
    }
  }, [resetSession, convex]);

  // Toggle temporary mode
  const handleToggleTemporary = useCallback(() => {
    setIsTemporaryMode((prev) => !prev);
  }, []);

  // Handle sending message
  const handleSend = useCallback(async (messageOverride?: string) => {
    const trimmed = (messageOverride || input).trim();
    if (!trimmed || sending) return;

    setInput("");
    setAvatarState("thinking");
    setSaveError(null);

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    const messageIndex = messages.length;
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    let conversationId = activeConversationId;

    try {
      // Create conversation on first message (if not temporary-strict mode)
      if (!conversationId) {
        conversationId = await createConversation({
          title: trimmed.slice(0, 50) + (trimmed.length > 50 ? "..." : ""),
          isTemporary: isTemporaryMode,
        });
        setActiveConversationId(conversationId);
      }

      // Persist user message
      try {
        await addMessage({
          conversationId,
          role: "user",
          content: trimmed,
        });
      } catch (err) {
        console.error("Failed to save user message:", err);
        setSaveError({ messageIndex, content: trimmed });
      }

      // Get AI response
      const result = await sendMessage({
        message: trimmed,
        clientContextHash: contextHash ?? undefined,
      });

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: result.assistantMessage,
        timestamp: Date.now(),
        actions: result.actions,
        followUps: result.followUps,
        metadata: {
          actions: result.actions,
          followUps: result.followUps,
          contextHash: result.contextHash,
          profileUpdates: result.profileUpdates,
          foundationUpdates: result.foundationUpdates,
        },
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Persist assistant message
      try {
        await addMessage({
          conversationId,
          role: "assistant",
          content: result.assistantMessage,
          metadata: {
            actions: result.actions,
            followUps: result.followUps,
            contextHash: result.contextHash,
            profileUpdates: result.profileUpdates,
            foundationUpdates: result.foundationUpdates,
          },
        });
      } catch (err) {
        console.error("Failed to save assistant message:", err);
        setSaveError({ messageIndex: messageIndex + 1, content: result.assistantMessage });
      }

      setProfileUpdate(result.profileUpdates ?? null);
      setFoundationUpdate(result.foundationUpdates ?? null);
      if (result.contextHash) setContextHash(result.contextHash);
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I ran into a problem. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
      setAvatarState("idle");
    }
  }, [input, sending, contextHash, messages.length, activeConversationId, isTemporaryMode, sendMessage, createConversation, addMessage]);

  // Handle retry save
  const handleRetrySave = useCallback(async () => {
    if (!saveError || !activeConversationId) return;
    
    try {
      const msg = messages[saveError.messageIndex];
      if (msg) {
        await addMessage({
          conversationId: activeConversationId,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
        });
        setSaveError(null);
      }
    } catch (err) {
      console.error("Retry save failed:", err);
    }
  }, [saveError, activeConversationId, messages, addMessage]);

  // Handle save temporary conversation
  const handleSaveTemporary = useCallback(async () => {
    if (!activeConversationId || !isTemporaryMode) return;
    
    try {
      await saveTemporaryConversation({ conversationId: activeConversationId });
      setIsTemporaryMode(false);
    } catch (err) {
      console.error("Failed to save temporary conversation:", err);
    }
  }, [activeConversationId, isTemporaryMode, saveTemporaryConversation]);

  // Handle profile update
  const handleApplyProfile = async () => {
    if (!profileUpdate || applyingProfile) return;
    setApplyingProfile(true);
    try {
      await updateCoachState({ update: profileUpdate });
      setProfileUpdate(null);
    } finally {
      setApplyingProfile(false);
    }
  };

  // Handle foundation update
  const handleApplyFoundation = async () => {
    if (!foundationUpdate || applyingFoundation) return;
    setApplyingFoundation(true);
    try {
      await updateCoachFoundation({ update: foundationUpdate });
      setFoundationUpdate(null);
    } finally {
      setApplyingFoundation(false);
    }
  };

  // Handle follow-up selection
  const handleFollowUpSelect = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get last message follow-ups
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const followUps = lastAssistantMessage?.followUps || [];

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {/* Sidebar */}
      <ChatSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header - Fixed height of 56px (h-14) to match sidebar header */}
        <div
          className="flex items-center gap-3 h-14 px-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {/* Sidebar toggle */}
          <SidebarToggle 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            isOpen={sidebarOpen}
          />
          
          {/* Coach avatar and title */}
          <div className="flex items-center gap-2">
            <CoachAvatar state={avatarState} size="sm" />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text)" }}
            >
              Financial Coach
            </h2>
          </div>

          <div className="flex-1" />

          {/* Temporary chat indicator / Save button */}
          {isTemporaryMode && activeConversationId && messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveTemporary}
              className="flex items-center gap-1.5"
            >
              <Lucide.Save size={14} />
              <span>Save Chat</span>
            </Button>
          )}

          {/* Temporary Chat button */}
          <button
            onClick={handleToggleTemporary}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${isTemporaryMode 
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" 
                : "hover:bg-black/5 dark:hover:bg-white/5"
              }
            `}
            style={{
              color: isTemporaryMode ? undefined : "var(--text-secondary)",
            }}
            title={isTemporaryMode ? "Temporary chat mode is on" : "Start a temporary chat"}
          >
            <Lucide.EyeOff size={16} />
            <span className="hidden sm:inline">
              {isTemporaryMode ? "Temporary" : "Temporary"}
            </span>
          </button>

          {/* New chat button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNewChat(isTemporaryMode)}
            className="flex items-center gap-1.5"
          >
            <Lucide.Plus size={16} />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>

        {/* Messages Area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ minHeight: 0 }}
        >
          {messages.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full">
              <CoachAvatar state="idle" size="lg" />
              <h3
                className="mt-4 text-lg font-semibold"
                style={{ color: "var(--text)" }}
              >
                How can I help you today?
              </h3>
              <p
                className="mt-2 text-sm text-center max-w-md"
                style={{ color: "var(--text-secondary)" }}
              >
                Ask me about your budget, spending patterns, savings goals, or any financial question.
              </p>
              
              {/* Temporary mode indicator in empty state */}
              {isTemporaryMode && (
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Lucide.EyeOff size={14} className="text-amber-700 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Temporary chat mode - conversation won&apos;t be saved
                  </span>
                </div>
              )}
              
              {/* Starter suggestions */}
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Message list
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message, index) => (
                <CoachMessageBubble
                  key={`${message.role}-${index}`}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  enableChunking={false}
                />
              ))}

              {/* Thinking indicator */}
              {sending && (
                <CoachMessageBubble
                  role="assistant"
                  content=""
                  isLoading={true}
                />
              )}
            </div>
          )}
        </div>

        {/* Save Error Banner */}
        {saveError && (
          <div
            className="mx-4 mb-2 px-4 py-2 rounded-lg flex items-center justify-between"
            style={{
              backgroundColor: "var(--warning-bg, rgba(234, 179, 8, 0.1))",
              border: "1px solid var(--warning, #CA8A04)",
            }}
          >
            <span className="text-sm" style={{ color: "var(--warning, #CA8A04)" }}>
              Message not saved. Your message is still visible.
            </span>
            <Button variant="ghost" size="sm" onClick={handleRetrySave}>
              Retry
            </Button>
          </div>
        )}

        {/* Follow-up suggestions */}
        {followUps.length > 0 && !sending && (
          <div className="px-4 pb-2">
            <FollowUpSuggestions
              suggestions={followUps}
              onSelect={handleFollowUpSelect}
            />
          </div>
        )}

        {/* Profile/Foundation Update Cards */}
        {profileUpdate && (
          <div
            className="mx-4 mb-2 rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Suggested Profile Updates
            </div>
            <ul className="mt-2 space-y-1 text-sm list-disc pl-4">
              {formatProfileUpdate(profileUpdate).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end">
              <Button onClick={handleApplyProfile} disabled={applyingProfile} size="sm">
                {applyingProfile ? "Saving..." : "Apply Updates"}
              </Button>
            </div>
          </div>
        )}

        {foundationUpdate && (
          <div
            className="mx-4 mb-2 rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Suggested Foundation Updates
            </div>
            <ul className="mt-2 space-y-1 text-sm list-disc pl-4">
              {formatFoundationUpdate(foundationUpdate).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end">
              <Button onClick={handleApplyFoundation} disabled={applyingFoundation} size="sm">
                {applyingFoundation ? "Saving..." : "Apply Foundation Updates"}
              </Button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                placeholder="Ask your financial coach..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex-1 resize-none"
                style={{
                  minHeight: "44px",
                  maxHeight: "120px",
                }}
              />
              <Button
                onClick={() => handleSend()}
                disabled={sending || input.trim().length === 0}
                size="icon"
              >
                {sending ? (
                  <Lucide.Loader2 className="animate-spin" size={20} />
                ) : (
                  <Lucide.Send size={20} />
                )}
              </Button>
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
