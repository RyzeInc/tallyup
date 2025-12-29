"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatMoney } from "@/components/utils";
import * as Lucide from "lucide-react";
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

// Default budget categories with suggested amounts
const DEFAULT_BUDGET_CATEGORIES = [
  { id: "housing", name: "Housing", icon: "🏠", description: "Rent, mortgage, property taxes", suggestedPercent: 30 },
  { id: "utilities", name: "Utilities", icon: "💡", description: "Electric, gas, water, internet, phone", suggestedPercent: 8 },
  { id: "food", name: "Food", icon: "🍽️", description: "Groceries and dining out", suggestedPercent: 12 },
  { id: "transportation", name: "Transportation", icon: "🚗", description: "Gas, car payments, public transit, rideshare", suggestedPercent: 10 },
  { id: "insurance", name: "Insurance", icon: "🛡️", description: "Health, auto, home, life insurance", suggestedPercent: 8 },
  { id: "debt", name: "Debt Payments", icon: "💳", description: "Credit cards, student loans, personal loans", suggestedPercent: 10 },
  { id: "healthcare", name: "Health Care", icon: "🏥", description: "Medical, dental, prescriptions, therapy", suggestedPercent: 5 },
  { id: "personal", name: "Personal Care & Lifestyle", icon: "✨", description: "Clothing, haircuts, gym, subscriptions", suggestedPercent: 5 },
  { id: "entertainment", name: "Entertainment", icon: "🎬", description: "Movies, games, hobbies, streaming", suggestedPercent: 5 },
  { id: "savings", name: "Savings & Investments", icon: "💰", description: "Emergency fund, retirement, investments", suggestedPercent: 10 },
];

// Temporary mock data until API is implemented
const MOCK_BUDGETS: BudgetCategory[] = [];

export default function BudgetingPage() {
  const { startDate, endDate, label } = useTimeRange();
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"choose" | "customize" | "amount">("choose");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>({});
  const [monthlyIncome, setMonthlyIncome] = useState("");

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

      {/* Create Budget Modal - Multi-step Wizard */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => {
            setShowCreate(false);
            setCreateStep("choose");
            setSelectedCategories(new Set());
            setCategoryAmounts({});
            setMonthlyIncome("");
          }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-8 safe-area-inset-bottom max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {createStep !== "choose" && (
                  <button
                    onClick={() => setCreateStep(createStep === "amount" ? "customize" : "choose")}
                    className="p-1 rounded-full hover:bg-[var(--surface-2)]"
                  >
                    <Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                )}
                <h2 className="text-h2" style={{ color: "var(--text)" }}>
                  {createStep === "choose" ? "Set Up Your Budget" : 
                   createStep === "customize" ? "Select Categories" : 
                   "Set Amounts"}
                </h2>
              </div>
              <button onClick={() => {
                setShowCreate(false);
                setCreateStep("choose");
                setSelectedCategories(new Set());
                setCategoryAmounts({});
                setMonthlyIncome("");
              }}>
                <Lucide.X className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>

            {/* Step 1: Choose Setup Method */}
            {createStep === "choose" && (
              <div className="space-y-4">
                <p className="text-body" style={{ color: "var(--text-secondary)" }}>
                  How would you like to create your budget?
                </p>
                
                <button
                  onClick={() => {
                    // Select all recommended categories
                    const recommended = new Set(DEFAULT_BUDGET_CATEGORIES.map(c => c.id));
                    setSelectedCategories(recommended);
                    setCreateStep("customize");
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--primary)20" }}
                  >
                    <Lucide.Sparkles className="h-6 w-6" style={{ color: "var(--primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold mb-1" style={{ color: "var(--text)" }}>
                      Start with recommended categories
                    </div>
                    <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                      We&apos;ll suggest 10 common budget categories you can customize
                    </div>
                  </div>
                  <Lucide.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                </button>

                <button
                  onClick={() => {
                    setSelectedCategories(new Set());
                    setCreateStep("customize");
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--accent-subtle)" }}
                  >
                    <Lucide.Pencil className="h-6 w-6" style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold mb-1" style={{ color: "var(--text)" }}>
                      Build from scratch
                    </div>
                    <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                      Pick only the categories that apply to you
                    </div>
                  </div>
                  <Lucide.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                </button>
              </div>
            )}

            {/* Step 2: Select/Customize Categories */}
            {createStep === "customize" && (
              <div className="space-y-4">
                <p className="text-meta" style={{ color: "var(--text-secondary)" }}>
                  Select the categories you want to budget for. You can always add more later.
                </p>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {DEFAULT_BUDGET_CATEGORIES.map((category) => {
                    const isSelected = selectedCategories.has(category.id);
                    return (
                      <button
                        key={category.id}
                        onClick={() => {
                          const updated = new Set(selectedCategories);
                          if (isSelected) {
                            updated.delete(category.id);
                          } else {
                            updated.add(category.id);
                          }
                          setSelectedCategories(updated);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? "var(--accent-subtle)" : "var(--surface-2)",
                          border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                        }}
                      >
                        <span className="text-xl">{category.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                            {category.name}
                          </div>
                          <div className="text-micro truncate" style={{ color: "var(--text-tertiary)" }}>
                            {category.description}
                          </div>
                        </div>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                            border: isSelected ? "none" : "2px solid var(--border)",
                          }}
                        >
                          {isSelected && <Lucide.Check className="h-4 w-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                      {selectedCategories.size} categories selected
                    </span>
                    <button
                      onClick={() => {
                        if (selectedCategories.size === DEFAULT_BUDGET_CATEGORIES.length) {
                          setSelectedCategories(new Set());
                        } else {
                          setSelectedCategories(new Set(DEFAULT_BUDGET_CATEGORIES.map(c => c.id)));
                        }
                      }}
                      className="text-meta font-medium"
                      style={{ color: "var(--primary)" }}
                    >
                      {selectedCategories.size === DEFAULT_BUDGET_CATEGORIES.length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <button
                    onClick={() => setCreateStep("amount")}
                    disabled={selectedCategories.size === 0}
                    className="w-full py-3 rounded-xl font-medium transition-colors"
                    style={{
                      backgroundColor: selectedCategories.size > 0 ? "var(--primary)" : "var(--surface-2)",
                      color: selectedCategories.size > 0 ? "#fff" : "var(--text-tertiary)",
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Set Amounts */}
            {createStep === "amount" && (
              <div className="space-y-4">
                {/* Monthly income helper */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--accent-subtle)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lucide.Lightbulb className="h-4 w-4" style={{ color: "var(--primary)" }} />
                    <span className="text-meta font-medium" style={{ color: "var(--primary)" }}>
                      Quick Setup
                    </span>
                  </div>
                  <p className="text-meta mb-3" style={{ color: "var(--text-secondary)" }}>
                    Enter your monthly income and we&apos;ll suggest budget amounts based on recommended percentages.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={monthlyIncome}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, "");
                        setMonthlyIncome(value);
                        // Auto-fill suggested amounts
                        if (value) {
                          const income = parseFloat(value) * 100;
                          const amounts: Record<string, string> = {};
                          DEFAULT_BUDGET_CATEGORIES.forEach((cat) => {
                            if (selectedCategories.has(cat.id)) {
                              const suggested = Math.round((income * cat.suggestedPercent) / 100);
                              amounts[cat.id] = (suggested / 100).toFixed(0);
                            }
                          });
                          setCategoryAmounts(amounts);
                        }
                      }}
                      placeholder="Monthly income"
                      className="flex-1 px-4 py-2 rounded-lg text-body outline-none"
                      style={{
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                    <button
                      onClick={() => {
                        if (monthlyIncome) {
                          const income = parseFloat(monthlyIncome) * 100;
                          const amounts: Record<string, string> = {};
                          DEFAULT_BUDGET_CATEGORIES.forEach((cat) => {
                            if (selectedCategories.has(cat.id)) {
                              const suggested = Math.round((income * cat.suggestedPercent) / 100);
                              amounts[cat.id] = (suggested / 100).toFixed(0);
                            }
                          });
                          setCategoryAmounts(amounts);
                        }
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: "var(--primary)",
                        color: "#fff",
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Category amounts */}
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {DEFAULT_BUDGET_CATEGORIES.filter((c) => selectedCategories.has(c.id)).map((category) => (
                    <div key={category.id} className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center">{category.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-meta font-medium" style={{ color: "var(--text)" }}>
                          {category.name}
                        </div>
                        {monthlyIncome && (
                          <div className="text-micro" style={{ color: "var(--text-tertiary)" }}>
                            Suggested: {category.suggestedPercent}%
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body" style={{ color: "var(--text-tertiary)" }}>
                          $
                        </span>
                        <input
                          type="text"
                          value={categoryAmounts[category.id] || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, "");
                            setCategoryAmounts((prev) => ({ ...prev, [category.id]: value }));
                          }}
                          placeholder="0"
                          className="w-28 pl-7 pr-3 py-2 rounded-lg text-body text-right outline-none"
                          style={{
                            backgroundColor: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total summary */}
                <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                      Total Budget
                    </span>
                    <span className="text-body font-semibold tabular-nums" style={{ color: "var(--primary)" }}>
                      {formatMoney(
                        Object.values(categoryAmounts).reduce(
                          (sum, val) => sum + (parseFloat(val || "0") * 100),
                          0
                        )
                      )}
                      /mo
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // TODO: Save budgets when API is ready
                      console.log("Saving budgets:", categoryAmounts);
                      setShowCreate(false);
                      setCreateStep("choose");
                      setSelectedCategories(new Set());
                      setCategoryAmounts({});
                      setMonthlyIncome("");
                    }}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
