"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { formatMoney, centsToDollars } from "@/components/utils";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { useTimeRange } from "@/components/TimeRangeProvider";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";

/**
 * Budgeting Page - Planning separated from logging
 * 
 * Features:
 * 1. Category budgets with progress bars
 * 2. Flexible (non-monthly) budgets
 * 3. Budget health indicators
 * 4. Simple projections
 */

interface BudgetCategory {
  _id: string;
  name: string;
  budgetAmountCents: number;
  periodType: string;
  icon?: string;
  color?: string;
  matchCategories?: string[];
}

// Temporary mock data until API is implemented
const MOCK_BUDGETS: BudgetCategory[] = [];

export default function BudgetingPage() {
  const { startDate, endDate, label } = useTimeRange();
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createPeriod, setCreatePeriod] = useState<"monthly" | "weekly" | "biweekly">("monthly");

  // Query entries to calculate spending per category
  const entries = useQuery(api.entries.listEntries, { 
    startDate, 
    endDate, 
    limit: 2000,
    type: "expense"
  }) as any[] | undefined;

  // Calculate spending by category
  const categorySpending = useMemo(() => {
    if (!entries) return new Map<string, number>();
    const map = new Map<string, number>();
    
    for (const entry of entries) {
      if (entry.excludeFromTotals) continue;
      const category = (entry.category || entry.bucket || "Uncategorized").toLowerCase();
      map.set(category, (map.get(category) || 0) + entry.amountCents);
    }
    
    return map;
  }, [entries]);

  // Calculate total spent
  const totalSpent = useMemo(() => {
    let total = 0;
    categorySpending.forEach((value) => {
      total += value;
    });
    return total;
  }, [categorySpending]);

  // Get top spending categories
  const topCategories = useMemo(() => {
    const sorted = [...categorySpending.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 6);
  }, [categorySpending]);

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-h1" style={{ color: "var(--text)" }}>Budgeting</h1>
          <GlobalDateRangePicker />
        </div>

        <SignedOut>
          <div className="text-center py-6">
            <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign in to set up budgets
            </div>
            <SignInButton mode="modal">
              <button
                className="rounded-lg px-5 py-2.5 font-semibold text-sm"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Total Spending Overview */}
          <div className="mb-4">
            <div className="text-micro mb-1" style={{ color: "var(--text-secondary)" }}>
              Total Spent ({label})
            </div>
            <div className="text-kpi tabular-nums" style={{ color: "var(--text)" }}>
              {formatMoney(totalSpent)}
            </div>
          </div>

          {/* Spending Distribution */}
          {topCategories.length > 0 && (
            <div className="space-y-2">
              <div className="text-micro font-medium" style={{ color: "var(--text-secondary)" }}>
                Top Categories
              </div>
              {topCategories.map(([category, amount]) => {
                const percentage = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-medium capitalize" style={{ color: "var(--text)" }}>
                        {category}
                      </span>
                      <span className="text-meta tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {formatMoney(amount)}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Budget Categories Section */}
      <SignedIn>
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2" style={{ color: "var(--text)" }}>
              Category Budgets
            </h2>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--on-primary, #fff)",
              }}
            >
              <Lucide.Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {MOCK_BUDGETS.length === 0 ? (
            <EmptyState
              icon={<Lucide.Wallet className="h-8 w-8" style={{ color: "var(--text-tertiary)" }} />}
              title="No budgets yet"
              subtitle="Create budgets to track your spending against goals. Set limits for categories like Food, Entertainment, or Shopping."
              action={
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: "var(--primary)", color: "#fff" }}
                >
                  Create First Budget
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {/* Budget items would go here */}
            </div>
          )}
        </div>

        {/* What-If Projections */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Lucide.TrendingUp className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-h2" style={{ color: "var(--text)" }}>
              Projections
            </h2>
          </div>

          <div className="space-y-3">
            {/* Days remaining in period */}
            {(() => {
              const now = new Date();
              const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              const daysLeft = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const dailyRate = totalSpent > 0 ? totalSpent / (new Date().getDate()) : 0;
              const projectedTotal = dailyRate * endOfMonth.getDate();

              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-body" style={{ color: "var(--text)" }}>
                      Days left this month
                    </span>
                    <span className="text-body font-medium tabular-nums" style={{ color: "var(--text)" }}>
                      {daysLeft}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body" style={{ color: "var(--text)" }}>
                      Daily average
                    </span>
                    <span className="text-body font-medium tabular-nums" style={{ color: "var(--text)" }}>
                      {formatMoney(Math.round(dailyRate))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body" style={{ color: "var(--text)" }}>
                      Projected month total
                    </span>
                    <span className="text-body font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      ~{formatMoney(Math.round(projectedTotal))}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </SignedIn>

      {/* Create Budget Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-5 pb-8 safe-area-inset-bottom"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2" style={{ color: "var(--text)" }}>
                New Budget
              </h2>
              <button onClick={() => setShowCreate(false)}>
                <Lucide.X className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-meta font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Groceries"
                  className="w-full px-4 py-3 rounded-xl text-body outline-none"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div>
                <label className="text-meta font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Budget Amount
                </label>
                <input
                  type="text"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="$500"
                  className="w-full px-4 py-3 rounded-xl text-body outline-none"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div>
                <label className="text-meta font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>
                  Period
                </label>
                <div className="flex gap-2">
                  {(["weekly", "biweekly", "monthly"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setCreatePeriod(period)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium capitalize"
                      style={{
                        backgroundColor: createPeriod === period ? "var(--accent-subtle)" : "var(--surface-2)",
                        border: `1px solid ${createPeriod === period ? "var(--primary)" : "var(--border)"}`,
                        color: createPeriod === period ? "var(--primary)" : "var(--text)",
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="w-full py-3 rounded-xl font-medium"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                }}
              >
                Create Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
