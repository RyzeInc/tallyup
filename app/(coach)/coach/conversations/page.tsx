"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter } from "next/navigation";
import * as Lucide from "lucide-react";

// UI Components
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

// Coach Components
import ConversationCard from "@/components/coach/ConversationCard";

// Utils
import { formatDateLabel } from "@/components/utils";

/**
 * CoachConversationsPage - Conversation history
 * 
 * Shows past conversations with the coach.
 */

type ConversationTab = "recent" | "saved" | "by-topic";
type ConversationTopic = "budgeting" | "debt" | "saving" | "investing" | "taxes" | "retirement" | "other";

interface Conversation {
  id: string;
  date: number;
  summary: string;
  tags: string[];
  topic: ConversationTopic;
  isSaved: boolean;
  messageCount?: number;
}

const TOPIC_LABELS: Record<ConversationTopic, string> = {
  budgeting: "Budgeting",
  debt: "Debt",
  saving: "Saving",
  investing: "Investing",
  taxes: "Taxes",
  retirement: "Retirement",
  other: "Other",
};

export default function CoachConversationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ConversationTab>("recent");
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch real conversation history
  const conversationsData = useQuery(api.coach.listConversations, { limit: 100 });

  // Transform API data to our Conversation type
  const conversations = useMemo<Conversation[]>(() => {
    if (!conversationsData) return [];

    return conversationsData.map((conv) => {
      // Determine topic from tags
      let topic: ConversationTopic = "other";
      if (conv.tags.includes("budgeting")) topic = "budgeting";
      else if (conv.tags.includes("debt")) topic = "debt";
      else if (conv.tags.includes("saving")) topic = "saving";
      else if (conv.tags.includes("investing")) topic = "investing";

      return {
        id: conv.id,
        date: conv.lastMessageAt,
        summary: conv.summary || "Conversation",
        tags: conv.tags,
        topic,
        isSaved: false, // TODO: Add saved conversations feature
        messageCount: conv.messageCount,
      };
    });
  }, [conversationsData]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Tab filter
      if (activeTab === "saved" && !conv.isSaved) return false;
      if (activeTab === "by-topic" && selectedTopic && conv.topic !== selectedTopic) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          conv.summary.toLowerCase().includes(query) ||
          conv.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [conversations, activeTab, selectedTopic, searchQuery]);

  // Group conversations by month
  const groupedConversations = useMemo(() => {
    const groups: Record<string, Conversation[]> = {};
    
    filteredConversations.forEach((conv) => {
      const date = new Date(conv.date);
      const key = `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(conv);
    });

    return groups;
  }, [filteredConversations]);

  // Get topic counts
  const topicCounts = useMemo(() => {
    const counts: Record<ConversationTopic, number> = {
      budgeting: 0,
      debt: 0,
      saving: 0,
      investing: 0,
      taxes: 0,
      retirement: 0,
      other: 0,
    };
    conversations.forEach((conv) => {
      counts[conv.topic]++;
    });
    return counts;
  }, [conversations]);

  // Loading state
  if (conversationsData === undefined) {
    return (
      <div className="space-y-6 pb-20">
        <PageHeader title="Conversations" />
        <Skeleton variant="rectangular" height={44} />
        <SkeletonCard style={{ height: 80 }} />
        <SkeletonCard style={{ height: 80 }} />
        <SkeletonCard style={{ height: 80 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <PageHeader
        title="Conversation History"
        subtitle="Your past conversations with the coach"
        rightSlot={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/coach")}
          >
            <Lucide.ChevronLeft style={{ width: 16, height: 16 }} />
            <span className="ml-1">Back</span>
          </Button>
        }
      />

      {/* Search */}
      <div
        className="relative flex items-center gap-2 rounded-xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "var(--space-3) var(--space-4)",
        }}
      >
        <Lucide.Search
          style={{ width: 18, height: 18, color: "var(--text-secondary)" }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="flex-1 bg-transparent outline-none"
          style={{
            fontSize: "var(--text-body)",
            color: "var(--text)",
          }}
        />
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ backgroundColor: "var(--surface-2)" }}
      >
        {[
          { key: "recent" as ConversationTab, label: "Recent" },
          { key: "saved" as ConversationTab, label: "Saved" },
          { key: "by-topic" as ConversationTab, label: "By Topic" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key !== "by-topic") setSelectedTopic(null);
            }}
            className="flex-1 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "var(--surface)" : "transparent",
              color: activeTab === tab.key ? "var(--text)" : "var(--text-secondary)",
              fontSize: "var(--text-meta)",
              boxShadow: activeTab === tab.key ? "var(--shadow-sm)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Topic pills (shown on By Topic tab) */}
      {activeTab === "by-topic" && (
        <div className="space-y-2">
          <div
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Topics
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TOPIC_LABELS).map(([key, label]) => {
              const count = topicCounts[key as ConversationTopic];
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTopic(key as ConversationTopic)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: selectedTopic === key ? "var(--primary)" : "var(--surface)",
                    color: selectedTopic === key ? "#FFFFFF" : "var(--text)",
                    border: `1px solid ${selectedTopic === key ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversations list */}
      {Object.keys(groupedConversations).length === 0 ? (
        <div className="text-center py-12">
          <Lucide.MessageCircle
            className="mx-auto mb-4"
            style={{ width: 48, height: 48, color: "var(--text-secondary)", opacity: 0.5 }}
          />
          <p style={{ color: "var(--text-secondary)" }}>
            {searchQuery
              ? "No conversations match your search."
              : activeTab === "saved"
              ? "No saved conversations yet."
              : "No conversations yet. Start chatting!"}
          </p>
          {!searchQuery && (
            <Button
              className="mt-4"
              onClick={() => router.push("/coach/ask")}
            >
              Start a Conversation
            </Button>
          )}
        </div>
      ) : (
        Object.entries(groupedConversations).map(([month, convos]) => (
          <div key={month} className="space-y-2">
            <div
              style={{
                fontSize: "var(--text-micro)",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {month}
            </div>
            <div className="space-y-2">
              {convos.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  date={conv.date}
                  summary={conv.summary}
                  tags={conv.tags}
                  onClick={() => router.push(`/coach/conversations/${conv.id}`)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Memory settings */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <p style={{ fontSize: "var(--text-body)", color: "var(--text)", fontWeight: 500 }}>
            Memory Settings
          </p>
          <p style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
            Coach remembers: 6 months of conversations
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/coach/settings")}>
          Change
        </Button>
      </div>
    </div>
  );
}
