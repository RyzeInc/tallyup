"use client";


import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";

interface Screen4Props {
  onComplete: () => void;
  isLoading?: boolean;
  incomeData?: {
    type: string;
    amountCents: number;
    category?: string;
    date: number;
  };
}

/**
 * Screen 4: Dashboard preview with real data
 * 
 * Shows the dashboard now populated with their actual data,
 * not empty widgets. This gets them excited about what&apos;s possible.
 */
export default function Screen4Dashboard({
  onComplete,
  isLoading = false,
  incomeData,
}: Screen4Props) {
  // Computed once per mount. Building these inline meant new argument values on
  // every render, so the Convex subscription was torn down and recreated
  // continuously instead of staying live.
  const period = useMemo(() => {
    const now = new Date();
    return {
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      periodEnd: now.getTime(),
      upcomingDays: 30,
    };
  }, []);

  const dashboardData = useQuery(api.dashboard.getDashboardData, period);

  // Format money
  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="mb-3 text-4xl">🎉</div>
        <h1
          className="text-h1 mb-2"
          style={{ color: "var(--text)" }}
        >
          You&apos;re all set!
        </h1>
        <p
          className="text-body"
          style={{ color: "var(--text-secondary)" }}
        >
          Here&apos;s a preview of your dashboard with real data.
        </p>
      </div>

      {/* Dashboard preview cards */}
      <div className="space-y-4 mb-8">
        {/* Income card */}
        {incomeData && (
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lucide.ArrowDownLeft className="h-5 w-5" style={{ color: "var(--success)" }} />
                <span className="text-meta font-semibold" style={{ color: "var(--text-secondary)" }}>
                  This Month&apos;s Income
                </span>
              </div>
            </div>
            <div
              className="text-2xl font-bold"
              style={{ color: "var(--success)" }}
            >
              {formatMoney(incomeData.amountCents)}
            </div>
            <div
              className="text-meta mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              From {incomeData.category}
            </div>
          </div>
        )}

        {/* Budget info card */}
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lucide.Target className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <span className="text-meta font-semibold" style={{ color: "var(--text-secondary)" }}>
                Your Budget
              </span>
            </div>
          </div>
          <div
            className="text-body font-semibold"
            style={{ color: "var(--text)" }}
          >
            Active & Ready to Track
          </div>
          <div
            className="text-meta mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Your budget is now tracking all spending
          </div>
        </div>

        {/* Features you can access */}
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Lucide.Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} />
            <span className="text-body font-semibold" style={{ color: "var(--text)" }}>
              What&apos;s Next
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Lucide.ChevronRight className="h-4 w-4 mt-1" style={{ color: "var(--primary)" }} />
              <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                Add more income sources and expenses
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Lucide.ChevronRight className="h-4 w-4 mt-1" style={{ color: "var(--primary)" }} />
              <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                Set financial goals and track progress
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Lucide.ChevronRight className="h-4 w-4 mt-1" style={{ color: "var(--primary)" }} />
              <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                Ask Coach for personalized insights
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Lucide.ChevronRight className="h-4 w-4 mt-1" style={{ color: "var(--primary)" }} />
              <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                Link bank accounts for automatic tracking
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onComplete}
        disabled={isLoading}
        className="w-full py-3 rounded-xl font-semibold transition-all text-body disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        style={{
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        {isLoading ? (
          <>
            <Lucide.Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
            Loading Dashboard...
          </>
        ) : (
          <>Go to Dashboard</>
        )}
      </button>

      {/* Secondary CTA */}
      <button
        onClick={onComplete}
        className="w-full py-2 text-meta rounded-lg transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        Skip for now
      </button>

      {/* Celebration note */}
      <div
        className="mt-6 p-4 rounded-xl text-center"
        style={{
          backgroundColor: "var(--success-subtle)",
          borderLeft: "4px solid var(--success)",
        }}
      >
        <div className="text-meta font-semibold" style={{ color: "var(--success)" }}>
          ✨ You&apos;re ready to go!
        </div>
        <div className="text-meta mt-1" style={{ color: "var(--text-secondary)" }}>
          Start logging transactions and build your financial picture.
        </div>
      </div>
    </div>
  );
}
