"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";

// UI Components
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Skeleton from "@/components/ui/Skeleton";

// Coach Components
import CoachAvatar from "@/components/coach/CoachAvatar";
import CoachMessageBubble from "@/components/coach/CoachMessageBubble";
import FollowUpSuggestions from "@/components/coach/FollowUpSuggestions";
import ActionOptions from "@/components/coach/ActionOptions";
import ChatSidebar, { SidebarToggle } from "@/components/coach/ChatSidebar";

// Utils
import { formatProfileUpdate } from "@/lib/coach/formatProfile";
import { formatFoundationUpdate } from "@/lib/coach/formatFoundation";
import type { CoachProfileUpdate } from "@/lib/coach/profile";
import type { CoachFoundationUpdate } from "@/lib/coach/foundation";

/**
 * CoachAskPage - Full AI chat interface
 * 
 * Features:
 * - Full conversation history
 * - Context-aware suggestions
 * - Interactive analysis cards
 * - Action buttons
 * - Voice input (placeholder)
 */

type ChatMessage = { 
  id?: string;
  role: "user" | "assistant"; 
  content: string; 
  timestamp: number;
  actions?: string[];
  followUps?: string[];
  blocks?: unknown; // structured blocks from coach (if available)
  metadata?: {
    actions?: string[];
    followUps?: string[];
    contextHash?: string;
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

// Context-aware suggestions based on user input
const TYPING_SUGGESTIONS: Record<string, string[]> = {
  "pay": [
    "Which debt should I pay first?",
    "Avalanche vs snowball method",
    "How much extra should I pay?",
    "Balance transfer options",
  ],
  "save": [
    "How much should I save?",
    "Best savings account options",
    "Emergency fund target",
    "Automate my savings",
  ],
  "spend": [
    "Where am I spending the most?",
    "How can I reduce spending?",
    "Set a spending limit",
    "Track my subscriptions",
  ],
  "afford": [
    "Can I afford this purchase?",
    "What's my safe to spend?",
    "Budget for a big expense",
    "Create a savings goal",
  ],
  "budget": [
    "Help me create a budget",
    "50/30/20 rule explained",
    "Review my budget",
    "Adjust my budget categories",
  ],
};

function CoachAskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const convex = useConvex();
  
  // Initial question from URL param
  const initialQuestion = searchParams.get("q");

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Conversation state for persistence
  const [activeConversationId, setActiveConversationId] = useState<Id<"chatConversations"> | null>(null);
  const [isTemporaryMode, setIsTemporaryMode] = useState(false);

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "thinking">("idle");
  
  // Snapshot state
  const [_snapshot, setSnapshot] = useState<CoachSnapshot | null>(null);
  const [contextHash, setContextHash] = useState<string | null>(null);
  const snapshotCache = useRef<{ data: CoachSnapshot; fetchedAt: number } | null>(null);

  // Profile/Foundation updates
  const [profileUpdate, setProfileUpdate] = useState<CoachProfileUpdate | null>(null);
  const [foundationUpdate, setFoundationUpdate] = useState<CoachFoundationUpdate | null>(null);
  const [applyingProfile, setApplyingProfile] = useState(false);
  const [applyingFoundation, setApplyingFoundation] = useState(false);

  // Actions
  const sendMessage = useAction(api.coach.chat);
  const updateCoachState = useMutation(api.coach.updateCoachState);
  const updateCoachFoundation = useMutation(api.coach.updateCoachFoundation);
  const resetSession = useMutation(api.coach.resetSession);
  
  // Conversation persistence
  const createConversation = useMutation(api.chatConversations.createConversation);
  const addMessage = useMutation(api.chatConversations.addMessage);
  // saveTemporaryConversation available for future "save this chat" feature
  // const saveTemporaryConversation = useMutation(api.chatConversations.saveTemporaryConversation);
  
  // Load messages for active conversation
  const conversationMessages = useQuery(
    api.chatConversations.getMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip"
  );

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Load snapshot
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

  // Handle initial question from URL
  useEffect(() => {
    if (initialQuestion && messages.length === 0 && contextHash) {
      handleSend(initialQuestion);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, contextHash]);

  // Send message
  const handleSend = useCallback(async (messageOverride?: string) => {
    const trimmed = (messageOverride || input).trim();
    if (!trimmed || sending) return;

    setInput("");
    setAvatarState("thinking");
    
    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    // Create conversation if needed (first message and not temporary mode)
    let conversationId = activeConversationId;
    if (!isTemporaryMode && !conversationId) {
      try {
        conversationId = await createConversation({ 
          title: trimmed.slice(0, 100) // Use first message as title
        });
        setActiveConversationId(conversationId);
      } catch {
        // Failed to create conversation, continue without persistence
        console.warn("Failed to create conversation");
      }
    }

    // Save user message if we have a conversation
    if (conversationId) {
      try {
        await addMessage({
          conversationId,
          role: "user",
          content: trimmed,
        });
      } catch {
        console.warn("Failed to save user message");
      }
    }

    try {
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
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message if we have a conversation
      if (conversationId) {
        try {
          await addMessage({
            conversationId,
            role: "assistant",
            content: result.assistantMessage,
            metadata: {
              actions: result.actions,
              followUps: result.followUps,
              contextHash: result.contextHash,
            },
          });
        } catch {
          console.warn("Failed to save assistant message");
        }
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
  }, [input, sending, contextHash, sendMessage, activeConversationId, isTemporaryMode, createConversation, addMessage]);

  // Handle profile update application
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

  // Handle foundation update application
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

  // Handle new chat
  const handleNewChat = useCallback(async () => {
    try {
      await resetSession({});
      setMessages([]);
      setProfileUpdate(null);
      setFoundationUpdate(null);
      setActiveConversationId(null);
      snapshotCache.current = null;
      
      const data = await convex.query(api.coach.getSnapshot, {});
      if (data) {
        snapshotCache.current = { data, fetchedAt: Date.now() };
        setSnapshot(data);
        setContextHash(data.contextHash);
      }
    } catch {
      // Ignore errors
    }
  }, [resetSession, convex]);

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

  // Get typing suggestions
  const typingSuggestions = input.trim().length >= 3
    ? Object.entries(TYPING_SUGGESTIONS)
        .filter(([key]) => input.toLowerCase().includes(key))
        .flatMap(([, suggestions]) => suggestions)
        .slice(0, 4)
    : [];

  // Get last message follow-ups
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
  const followUps = lastAssistantMessage?.followUps || [];

  // Handle conversation selection from sidebar
  const handleSelectConversation = useCallback(async (conversationId: Id<"chatConversations">) => {
    setActiveConversationId(conversationId);
    setIsTemporaryMode(false);
    // Messages will be loaded via the useQuery hook
  }, []);

  // Handle sidebar new chat
  const handleSidebarNewChat = useCallback(async () => {
    setActiveConversationId(null);
    setIsTemporaryMode(false);
    await handleNewChat();
  }, [handleNewChat]);

  // Toggle temporary mode
  const toggleTemporaryMode = useCallback(() => {
    setIsTemporaryMode((prev) => !prev);
    if (!isTemporaryMode) {
      // Entering temporary mode - clear any active conversation
      setActiveConversationId(null);
    }
  }, [isTemporaryMode]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationMessages && activeConversationId) {
      const loadedMessages: ChatMessage[] = conversationMessages.map((msg) => ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        metadata: msg.metadata,
      }));
      setMessages(loadedMessages);
    }
  }, [conversationMessages, activeConversationId]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <ChatSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleSidebarNewChat}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            {/* Sidebar toggle */}
            <SidebarToggle isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
            
            <button
              onClick={() => router.push("/coach")}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Back to coach home"
            >
              <Lucide.ChevronLeft style={{ width: 20, height: 20 }} />
            </button>
            <CoachAvatar state={avatarState} size="sm" />
            <div>
              <h1
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Financial Coach
              </h1>
              <p
                style={{
                  fontSize: "var(--text-micro)",
                  color: "var(--text-secondary)",
                }}
              >
                {sending ? "Thinking..." : isTemporaryMode ? "Temporary chat (won't be saved)" : "Ask anything about your finances"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Temporary chat toggle */}
            <button
              onClick={toggleTemporaryMode}
              className={`p-2 rounded-lg transition-colors ${
                isTemporaryMode 
                  ? "bg-[var(--accent)] text-white" 
                  : "hover:bg-[var(--surface-2)]"
              }`}
              style={{ 
                color: isTemporaryMode ? "white" : "var(--text-secondary)",
              }}
              title={isTemporaryMode ? "Temporary mode on" : "Enable temporary mode"}
              aria-label={isTemporaryMode ? "Disable temporary chat mode" : "Enable temporary chat mode"}
            >
              <Lucide.Clock style={{ width: 18, height: 18 }} />
            </button>

            {/* New chat button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
            >
              <Lucide.Plus style={{ width: 16, height: 16 }} />
              <span className="ml-1">New Chat</span>
            </Button>
          </div>
      </div>

      {/* Chat messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto py-4 space-y-4"
        style={{ minHeight: 0 }}
      >
        {/* Welcome message */}
        {messages.length === 0 && !sending && (
          <div className="text-center py-8 px-4">
            <CoachAvatar state="idle" size="lg" className="mx-auto mb-4" />
            <h2
              style={{
                fontSize: "var(--text-h2)",
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              Hi! I&apos;m your financial coach
            </h2>
            <p
              style={{
                fontSize: "var(--text-meta)",
                color: "var(--text-secondary)",
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              I can help with budgeting, debt, saving, investing, or any money questions you have.
            </p>

            {/* Quick start suggestions */}
            <div className="mt-6 space-y-2">
              <p
                style={{
                  fontSize: "var(--text-micro)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Try asking
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "How am I doing this month?",
                  "What can I afford?",
                  "Help me save more",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="px-3 py-2 rounded-xl transition-colors"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      fontSize: "var(--text-meta)",
                      color: "var(--text)",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => (
          <div key={index} className="px-4">
            <CoachMessageBubble
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
            
            {/* Actions for assistant messages */}
            {message.role === "assistant" && message.actions && message.actions.length > 0 && (
              <div className="mt-3 ml-14 space-y-2">
                <div
                  className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="text-xs uppercase tracking-wide mb-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Suggested Actions
                  </div>
                  <ul className="space-y-1 text-sm list-disc pl-4">
                    {message.actions.map((action, idx) => (
                      <li key={idx} style={{ color: "var(--text)" }}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {sending && (
          <div className="px-4">
            <CoachMessageBubble
              role="assistant"
              content=""
              isLoading
            />
          </div>
        )}

        {/* Profile update prompt */}
        {profileUpdate && (
          <div className="px-4">
            <div
              className="ml-14 rounded-xl p-3"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="text-xs uppercase tracking-wide mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                Suggested Profile Updates
              </div>
              <ul className="space-y-1 text-sm list-disc pl-4">
                {formatProfileUpdate(profileUpdate).map((line) => (
                  <li key={line} style={{ color: "var(--text)" }}>{line}</li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">
                <Button onClick={handleApplyProfile} disabled={applyingProfile} size="sm">
                  {applyingProfile ? "Saving..." : "Apply Updates"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Foundation update prompt */}
        {foundationUpdate && (
          <div className="px-4">
            <div
              className="ml-14 rounded-xl p-3"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="text-xs uppercase tracking-wide mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                Suggested Foundation Updates
              </div>
              <ul className="space-y-1 text-sm list-disc pl-4">
                {formatFoundationUpdate(foundationUpdate).map((line) => (
                  <li key={line} style={{ color: "var(--text)" }}>{line}</li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">
                <Button onClick={handleApplyFoundation} disabled={applyingFoundation} size="sm">
                  {applyingFoundation ? "Saving..." : "Apply Updates"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Follow-up suggestions */}
      {followUps.length > 0 && !sending && (
        <div className="px-4 py-2 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          {/* If follow-ups look like action options (more than 2), use ActionOptions */}
          {followUps.length > 2 ? (
            <ActionOptions
              title="What would you like to do?"
              options={followUps.map((fu, idx) => ({
                id: `followup-${idx}`,
                label: fu,
              }))}
              onSelect={(selected) => {
                if (selected[0]) {
                  handleSend(selected[0].label);
                }
              }}
              allowCustom
              customPlaceholder="Or ask something else..."
            />
          ) : (
            <FollowUpSuggestions
              suggestions={followUps}
              onSelect={handleFollowUpSelect}
            />
          )}
        </div>
      )}

      {/* Input area */}
      <div
        className="px-4 py-3 border-t shrink-0"
        style={{ 
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
        }}
      >
        {/* Typing suggestions */}
        {typingSuggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {typingSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion);
                  inputRef.current?.focus();
                }}
                className="px-2 py-1 rounded-lg text-xs transition-colors"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text-secondary)",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            placeholder="Type your question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setAvatarState("listening")}
            onBlur={() => setAvatarState("idle")}
            rows={1}
            className="flex-1"
            style={{
              resize: "none",
              maxHeight: 120,
            }}
          />
          <Button
            onClick={() => handleSend()}
            disabled={sending || input.trim().length === 0}
            size="icon"
          >
            {sending ? (
              <Lucide.Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
            ) : (
              <Lucide.Send style={{ width: 20, height: 20 }} />
            )}
          </Button>
        </div>

        <div
          className="mt-2 text-center"
          style={{
            fontSize: "var(--text-micro)",
            color: "var(--text-secondary)",
          }}
        >
          Enter to send • Shift+Enter for new line
        </div>
      </div>
      </div>{/* End Main Chat Area */}
    </div>
  );
}

export default function CoachAskPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-full items-center justify-center">
        <Skeleton variant="circular" width={80} height={80} />
        <Skeleton width={200} height={24} className="mt-4" />
      </div>
    }>
      <CoachAskContent />
    </Suspense>
  );
}
