"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter } from "next/navigation";
import * as Lucide from "lucide-react";

// UI Components
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

// Coach Components
import CoachAvatar from "@/components/coach/CoachAvatar";
import QuickAskInput from "@/components/coach/QuickAskInput";
import PriorityCard from "@/components/coach/PriorityCard";
import ModuleProgressPill from "@/components/coach/ModuleProgressPill";
import CheckInCard from "@/components/coach/CheckInCard";
import ConversationCard from "@/components/coach/ConversationCard";
import InsightCard from "@/components/coach/InsightCard";

// Utils
import { formatMoney, formatDateLabel } from "@/components/utils";

/**
 * CoachDashboard - Full coach home page
 * 
 * Structure:
 * 1. Coach avatar with greeting
 * 2. Quick ask input
 * 3. Today's priority card (dynamic)
 * 4. Active learning modules
 * 5. Upcoming check-ins
 * 6. Recent conversations
 * 7. Quick actions
 */

// Default suggestions for new users
const DEFAULT_SUGGESTIONS = [
  "How much can I afford to spend this week?",
  "What's my biggest expense this month?",
  "Help me create a savings plan",
  "Should I pay off debt or save?",
  "How can I reduce my spending?",
];

// Mock learning modules (will be replaced with real data)
const MOCK_MODULES = [
  { id: "1", name: "Budget Basics", progress: 100, completed: true },
  { id: "2", name: "Debt Payoff Strategy", progress: 60, completed: false },
  { id: "3", name: "Emergency Fund", progress: 25, completed: false },
];

export default function CoachDashboard() {
  const router = useRouter();
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "thinking">("idle");
  
  // Fetch coach snapshot data
  const snapshot = useQuery(api.coach.getSnapshot, {});
  const sendMessage = useAction(api.coach.chat);
  
  // Extract user's first name for greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Get recent conversations from coach events
  const recentConversations = useMemo(() => {
    if (!snapshot?.snapshot) return [];
    
    // This would come from coach events - for now return placeholder
    return snapshot.snapshot.recentSummaries?.map((summary, index) => ({
      id: `conv-${index}`,
      date: Date.now() - (index * 24 * 60 * 60 * 1000), // Mock dates
      summary,
      tags: [],
    })) || [];
  }, [snapshot]);

  // Build priority card based on snapshot
  const priorityInsight = useMemo(() => {
    if (!snapshot?.snapshot) return null;

    const { cashflow, anomalies, upcomingBills } = snapshot.snapshot;
    
    // Check for anomalies first (spending alerts)
    if (anomalies && anomalies.length > 0) {
      const topAnomaly = anomalies[0];
      return {
        type: "spending" as const,
        priority: "medium" as const,
        title: "Spending Pattern Alert",
        description: `${topAnomaly.category}: ${topAnomaly.reason}`,
        actions: [
          { label: "Review", onClick: () => router.push("/activity") },
          { label: "Set limit", onClick: () => router.push("/budgeting") },
        ],
      };
    }

    // Check cashflow
    if (cashflow && cashflow.netCents < 0) {
      return {
        type: "alert" as const,
        priority: "high" as const,
        title: "Negative Cash Flow",
        description: `You've spent ${formatMoney(Math.abs(cashflow.netCents))} more than you've earned this month.`,
        actions: [
          { label: "Review spending", onClick: () => router.push("/budgeting") },
        ],
      };
    }

    // Check upcoming bills
    if (upcomingBills && upcomingBills.length > 0) {
      const nextBill = upcomingBills[0];
      return {
        type: "bill" as const,
        priority: "low" as const,
        title: "Upcoming Bill",
        description: `${nextBill.name} is due ${formatDateLabel(nextBill.expectedDate, { relative: true })}`,
        actions: [
          { label: "View all", onClick: () => router.push("/recurring") },
        ],
      };
    }

    // Default encouragement
    return {
      type: "goal" as const,
      priority: "low" as const,
      title: "Stay on Track",
      description: "You're doing great! Keep building healthy money habits.",
      actions: [
        { label: "Check goals", onClick: () => router.push("/goals") },
      ],
    };
  }, [snapshot, router]);

  // Handle quick ask submission
  const handleQuickAsk = useCallback(async (question: string) => {
    setAvatarState("thinking");
    
    // Navigate to chat with the question
    // In a full implementation, we'd pass this via context or URL params
    router.push(`/coach/ask?q=${encodeURIComponent(question)}`);
  }, [router]);

  const handleInputFocus = useCallback(() => {
    setAvatarState("listening");
  }, []);

  const handleInputBlur = useCallback(() => {
    setAvatarState("idle");
  }, []);

  // Loading state
  if (snapshot === undefined) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width={56} height={56} />
          <div className="space-y-2">
            <Skeleton width={200} height={24} />
            <Skeleton width={150} height={16} />
          </div>
        </div>
        <Skeleton variant="rectangular" height={56} />
        <SkeletonCard style={{ height: 120 }} />
        <SkeletonCard style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header with avatar and greeting */}
      <div className="flex items-center gap-4">
        <CoachAvatar state={avatarState} size="md" />
        <div>
          <h1
            style={{
              fontSize: "var(--text-h1)",
              fontWeight: "var(--text-h1-weight)",
              color: "var(--text)",
            }}
          >
            {greeting}!
          </h1>
          <p
            style={{
              fontSize: "var(--text-meta)",
              color: "var(--text-secondary)",
            }}
          >
            Ready for today&apos;s insight?
          </p>
        </div>
      </div>

      {/* Quick Ask Input */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2"
          style={{
            fontSize: "var(--text-micro)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Lucide.Search style={{ width: 14, height: 14 }} />
          <span>Quick Ask</span>
        </div>
        <QuickAskInput
          onSubmit={handleQuickAsk}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          suggestions={DEFAULT_SUGGESTIONS}
          recentQueries={recentConversations.slice(0, 3).map(c => c.summary)}
        />
      </div>

      {/* Today's Priority */}
      {priorityInsight && (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2"
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Lucide.Target style={{ width: 14, height: 14 }} />
            <span>Today&apos;s Priority</span>
          </div>
          <PriorityCard
            type={priorityInsight.type}
            priority={priorityInsight.priority}
            title={priorityInsight.title}
            description={priorityInsight.description}
            actions={priorityInsight.actions}
          />
        </div>
      )}

      {/* Financial Snapshot */}
      {snapshot?.snapshot && (
        <Card float>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Lucide.TrendingUp style={{ width: 18, height: 18, color: "var(--primary)" }} />
                <span>{snapshot.snapshot.monthLabel}</span>
              </div>
            </CardTitle>
            <CardDescription>Your financial snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Income
                </div>
                <div
                  style={{
                    fontSize: "var(--text-h2)",
                    fontWeight: 600,
                    color: "var(--success)",
                  }}
                >
                  {formatMoney(snapshot.snapshot.cashflow.incomeCents)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Expenses
                </div>
                <div
                  style={{
                    fontSize: "var(--text-h2)",
                    fontWeight: 600,
                    color: "var(--danger)",
                  }}
                >
                  {formatMoney(snapshot.snapshot.cashflow.expenseCents)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Net
                </div>
                <div
                  style={{
                    fontSize: "var(--text-h2)",
                    fontWeight: 600,
                    color: snapshot.snapshot.cashflow.netCents >= 0 ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {formatMoney(snapshot.snapshot.cashflow.netCents)}
                </div>
              </div>
            </div>

            {/* Top Categories */}
            {snapshot.snapshot.topCategories.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <div
                  className="mb-2"
                  style={{
                    fontSize: "var(--text-micro)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  Top Spending
                </div>
                <div className="space-y-2">
                  {snapshot.snapshot.topCategories.slice(0, 3).map((cat, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span style={{ fontSize: "var(--text-meta)", color: "var(--text)" }}>
                        {cat.category}
                      </span>
                      <span style={{ fontSize: "var(--text-meta)", fontWeight: 600, color: "var(--text)" }}>
                        {formatMoney(cat.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Modules */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2"
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Lucide.BookOpen style={{ width: 14, height: 14 }} />
            <span>Learning Modules</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/coach/modules")}
            rightIcon={<Lucide.ChevronRight style={{ width: 16, height: 16 }} />}
          >
            View All
          </Button>
        </div>
        <div className="space-y-2">
          {MOCK_MODULES.map((module) => (
            <ModuleProgressPill
              key={module.id}
              name={module.name}
              progress={module.progress}
              completed={module.completed}
              onClick={() => router.push(`/coach/modules/${module.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Upcoming Check-ins */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2"
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Lucide.Calendar style={{ width: 14, height: 14 }} />
            <span>Upcoming Check-ins</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/coach/checkins")}
            rightIcon={<Lucide.ChevronRight style={{ width: 16, height: 16 }} />}
          >
            View All
          </Button>
        </div>
        <CheckInCard
          title="Weekly Review"
          time="Tomorrow, 8:00 AM"
          duration="5-7 minutes"
          agenda={[
            "Spending vs budget",
            "Progress on goals",
            "Upcoming bills",
          ]}
          onStart={() => router.push("/coach/checkins/weekly")}
          onReschedule={() => {}}
        />
      </div>

      {/* Recent Conversations */}
      {recentConversations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2"
              style={{
                fontSize: "var(--text-micro)",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <Lucide.MessageCircle style={{ width: 14, height: 14 }} />
              <span>Recent Conversations</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/coach/conversations")}
              rightIcon={<Lucide.ChevronRight style={{ width: 16, height: 16 }} />}
            >
              See All
            </Button>
          </div>
          <div className="space-y-2">
            {recentConversations.slice(0, 3).map((conv) => (
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
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <div
          className="flex items-center gap-2"
          style={{
            fontSize: "var(--text-micro)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <Lucide.Zap style={{ width: 14, height: 14 }} />
          <span>Quick Actions</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/coach/scenario")}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Lucide.Calculator style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: "var(--text-micro)" }}>Run Scenario</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/coach/ask")}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Lucide.MessageSquare style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: "var(--text-micro)" }}>Ask About...</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/coach/settings")}
            className="flex flex-col items-center gap-1 h-auto py-3"
          >
            <Lucide.Settings style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: "var(--text-micro)" }}>Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
