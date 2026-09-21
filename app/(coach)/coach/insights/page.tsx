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
import InsightCard from "@/components/coach/InsightCard";

// Utils
import { formatMoney } from "@/components/utils";

/**
 * CoachInsightsPage - Proactive financial analysis
 * 
 * Shows AI-generated insights and recommendations.
 */

type InsightCategory = "spending" | "saving" | "debt" | "income" | "habits" | "opportunities" | "risks";
type InsightTab = "new" | "saved" | "all";

interface Insight {
  id: string;
  type: "anomaly" | "opportunity" | "habit" | "warning" | "celebration";
  priority: "high" | "medium" | "low";
  category: InsightCategory;
  title: string;
  description: string;
  detail?: string;
  createdAt: number;
  isNew: boolean;
  isSaved: boolean;
}

const CATEGORY_PILLS: { key: InsightCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "spending", label: "Spending" },
  { key: "saving", label: "Saving" },
  { key: "debt", label: "Debt" },
  { key: "income", label: "Income" },
  { key: "habits", label: "Habits" },
  { key: "opportunities", label: "Opportunities" },
  { key: "risks", label: "Risks" },
];

export default function CoachInsightsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InsightTab>("new");
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory | "all">("all");

  // Fetch snapshot for insight generation
  const snapshot = useQuery(api.coach.getSnapshot, {});

  // Generate insights from snapshot data
  const insights = useMemo<Insight[]>(() => {
    if (!snapshot?.snapshot) return [];

    const result: Insight[] = [];
    const { cashflow, anomalies, topCategories, upcomingBills } = snapshot.snapshot;
    // Anchored to when the snapshot was computed rather than Date.now(), which
    // is impure during render and shifts on every re-render.
    const now = snapshot.snapshot.updatedAt ?? 0;

    // Anomaly insights
    if (anomalies && anomalies.length > 0) {
      anomalies.forEach((anomaly, index) => {
        result.push({
          id: `anomaly-${index}`,
          type: "anomaly",
          priority: "high",
          category: "spending",
          title: "Unusual Spending Pattern",
          description: `${anomaly.category} spending has changed significantly`,
          detail: anomaly.reason,
          createdAt: now - (index * 3600000),
          isNew: index === 0,
          isSaved: false,
        });
      });
    }

    // Cash flow insight
    if (cashflow) {
      if (cashflow.netCents > 0) {
        result.push({
          id: "positive-cashflow",
          type: "celebration",
          priority: "low",
          category: "income",
          title: "Positive Cash Flow",
          description: `You've saved ${formatMoney(cashflow.netCents)} this month`,
          detail: "Keep up the great work! Consider putting this surplus toward your goals.",
          createdAt: now - 86400000,
          isNew: false,
          isSaved: false,
        });
      } else if (cashflow.netCents < -50000) { // Over $500 negative
        result.push({
          id: "negative-cashflow",
          type: "warning",
          priority: "high",
          category: "spending",
          title: "High Spending Alert",
          description: `You've spent ${formatMoney(Math.abs(cashflow.netCents))} more than earned`,
          detail: "Review your recent transactions to identify areas to cut back.",
          createdAt: now - 43200000,
          isNew: true,
          isSaved: false,
        });
      }
    }

    // Top spending category insight
    if (topCategories && topCategories.length > 0) {
      const topCategory = topCategories[0];
      result.push({
        id: "top-spending",
        type: "habit",
        priority: "medium",
        category: "habits",
        title: "Top Spending Category",
        description: `${topCategory.category} is your biggest expense at ${formatMoney(topCategory.amountCents)}`,
        createdAt: now - 172800000,
        isNew: false,
        isSaved: true,
      });
    }

    // Upcoming bills insight
    if (upcomingBills && upcomingBills.length >= 3) {
      result.push({
        id: "bills-upcoming",
        type: "opportunity",
        priority: "medium",
        category: "opportunities",
        title: "Multiple Bills Coming",
        description: `You have ${upcomingBills.length} bills due in the next 30 days`,
        detail: "Consider setting up automatic payments to avoid late fees.",
        createdAt: now - 259200000,
        isNew: false,
        isSaved: false,
      });
    }

    // Add some placeholder insights
    result.push({
      id: "savings-opportunity",
      type: "opportunity",
      priority: "medium",
      category: "saving",
      title: "Savings Opportunity",
      description: "You could save $47/month by optimizing subscriptions",
      detail: "Review your recurring charges to find potential savings.",
      createdAt: now - 345600000,
      isNew: false,
      isSaved: true,
    });

    return result;
  }, [snapshot]);

  // Filter insights
  const filteredInsights = useMemo(() => {
    return insights.filter((insight) => {
      // Tab filter
      if (activeTab === "new" && !insight.isNew) return false;
      if (activeTab === "saved" && !insight.isSaved) return false;

      // Category filter
      if (selectedCategory !== "all" && insight.category !== selectedCategory) return false;

      return true;
    });
  }, [insights, activeTab, selectedCategory]);

  // Count new insights
  const newCount = insights.filter(i => i.isNew).length;

  // Loading state
  if (snapshot === undefined) {
    return (
      <div className="space-y-6 pb-20">
        <PageHeader title="Insights" />
        <div className="flex gap-2">
          <Skeleton width={60} height={32} variant="rectangular" />
          <Skeleton width={60} height={32} variant="rectangular" />
          <Skeleton width={60} height={32} variant="rectangular" />
        </div>
        <SkeletonCard style={{ height: 120 }} />
        <SkeletonCard style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <PageHeader
        title="Coaching Insights"
        subtitle="AI-powered financial analysis"
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

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ backgroundColor: "var(--surface-2)" }}
      >
        {[
          { key: "new" as InsightTab, label: "New", count: newCount },
          { key: "saved" as InsightTab, label: "Saved" },
          { key: "all" as InsightTab, label: "All" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "var(--surface)" : "transparent",
              color: activeTab === tab.key ? "var(--text)" : "var(--text-secondary)",
              fontSize: "var(--text-meta)",
              boxShadow: activeTab === tab.key ? "var(--shadow-sm)" : "none",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#FFFFFF",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setSelectedCategory(pill.key)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedCategory === pill.key ? "var(--primary)" : "var(--surface)",
              color: selectedCategory === pill.key ? "#FFFFFF" : "var(--text)",
              border: `1px solid ${selectedCategory === pill.key ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Insights list */}
      {filteredInsights.length === 0 ? (
        <div className="text-center py-12">
          <Lucide.Lightbulb
            className="mx-auto mb-4"
            style={{ width: 48, height: 48, color: "var(--text-secondary)", opacity: 0.5 }}
          />
          <p style={{ color: "var(--text-secondary)" }}>
            {activeTab === "new"
              ? "No new insights. Check back later!"
              : activeTab === "saved"
              ? "No saved insights yet."
              : "No insights match your filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              type={insight.type}
              priority={insight.priority}
              title={insight.title}
              description={insight.description}
              detail={insight.detail}
              isNew={insight.isNew}
              onSave={() => {
                // Toggle save state (mock)
                console.log("Save insight:", insight.id);
              }}
              onDismiss={() => {
                // Dismiss insight (mock)
                console.log("Dismiss insight:", insight.id);
              }}
              actions={[
                {
                  label: insight.type === "anomaly" ? "Review Transactions" : "Learn More",
                  onClick: () => {
                    if (insight.type === "anomaly") {
                      router.push("/activity");
                    } else {
                      router.push(`/coach/ask?q=${encodeURIComponent(`Tell me more about: ${insight.title}`)}`);
                    }
                  },
                },
              ]}
            />
          ))}
        </div>
      )}

      {/* Insight frequency setting */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <p style={{ fontSize: "var(--text-body)", color: "var(--text)", fontWeight: 500 }}>
            Insight Frequency
          </p>
          <p style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
            You prefer: Weekly digest
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/coach/settings")}>
          Change
        </Button>
      </div>
    </div>
  );
}
