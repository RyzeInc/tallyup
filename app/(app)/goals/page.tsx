"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatMoney } from "@/components/utils";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

/**
 * Goals Page - Intentional, time-bounded savings
 * 
 * Goal Types:
 * 1. Savings goals - Save toward a target
 * 2. Pay-down goals - Pay down debt
 * 3. Sinking funds - Recurring expense preparation
 */

interface Goal {
  id: string;
  name: string;
  description?: string;
  goalType: "savings" | "paydown" | "sinkingFund";
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate?: number;
  icon?: string;
  status: "active" | "paused" | "completed" | "abandoned";
}

// Goal type configurations
const GOAL_TYPES = [
  {
    type: "savings" as const,
    label: "Savings Goal",
    description: "Save toward a specific target",
    icon: Lucide.PiggyBank,
    color: "var(--success)",
  },
  {
    type: "paydown" as const,
    label: "Pay-Down Goal",
    description: "Track debt repayment progress",
    icon: Lucide.TrendingDown,
    color: "var(--warning)",
  },
  {
    type: "sinkingFund" as const,
    label: "Sinking Fund",
    description: "Prepare for recurring expenses",
    icon: Lucide.Calendar,
    color: "var(--primary)",
  },
];

// Suggested goals
const SUGGESTED_GOALS = [
  { name: "Emergency Fund", icon: "🆘", type: "savings", suggested: true },
  { name: "Vacation", icon: "🏖️", type: "savings", suggested: false },
  { name: "New Car", icon: "🚗", type: "savings", suggested: false },
  { name: "Down Payment", icon: "🏠", type: "savings", suggested: false },
  { name: "Credit Card Payoff", icon: "💳", type: "paydown", suggested: true },
  { name: "Student Loans", icon: "🎓", type: "paydown", suggested: false },
  { name: "Insurance Premium", icon: "📋", type: "sinkingFund", suggested: true },
  { name: "Holiday Gifts", icon: "🎁", type: "sinkingFund", suggested: false },
  { name: "Car Maintenance", icon: "🔧", type: "sinkingFund", suggested: false },
];

export default function GoalsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<"savings" | "paydown" | "sinkingFund" | null>(null);
  const [createName, setCreateName] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createTargetDate, setCreateTargetDate] = useState("");

  // Placeholder for goals - will be replaced with actual query
  const goals: Goal[] = [];

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  // Calculate total saved across all active goals
  const totalProgress = useMemo(() => {
    return activeGoals.reduce(
      (acc, goal) => ({
        current: acc.current + goal.currentAmountCents,
        target: acc.target + goal.targetAmountCents,
      }),
      { current: 0, target: 0 }
    );
  }, [activeGoals]);

  const overallProgress = totalProgress.target > 0
    ? (totalProgress.current / totalProgress.target) * 100
    : 0;

  function handleSelectType(type: "savings" | "paydown" | "sinkingFund") {
    setSelectedType(type);
    setCreateStep("details");
  }

  function handleSelectSuggested(suggestion: typeof SUGGESTED_GOALS[0]) {
    setSelectedType(suggestion.type as any);
    setCreateName(suggestion.name);
    setCreateStep("details");
  }

  function resetCreate() {
    setShowCreate(false);
    setCreateStep("type");
    setSelectedType(null);
    setCreateName("");
    setCreateAmount("");
    setCreateTargetDate("");
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-h1" style={{ color: "var(--text)" }}>Goals</h1>
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

        <SignedOut>
          <div className="text-center py-6">
            <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign in to set financial goals
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
          {/* Overall Progress */}
          {activeGoals.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-micro" style={{ color: "var(--text-secondary)" }}>
                  Total Progress
                </span>
                <span className="text-micro font-medium" style={{ color: "var(--text-secondary)" }}>
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden mb-3"
                style={{ backgroundColor: "var(--surface-2)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(overallProgress, 100)}%`,
                    backgroundColor: "var(--success)",
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                  {formatMoney(totalProgress.current)}
                </span>
                <span className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                  of {formatMoney(totalProgress.target)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Lucide.Target className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <div className="text-body font-medium mb-1" style={{ color: "var(--text)" }}>
                No active goals
              </div>
              <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                Set goals to track your savings progress
              </div>
            </div>
          )}
        </SignedIn>
      </div>

      {/* Active Goals */}
      <SignedIn>
        {activeGoals.length === 0 ? (
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <EmptyState
              icon={<Lucide.Target className="h-8 w-8" style={{ color: "var(--text-tertiary)" }} />}
              title="Start your first goal"
              subtitle="Goals help you save intentionally. Whether it's an emergency fund, vacation, or paying down debt, we'll help you track real progress."
              action={
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: "var(--primary)", color: "#fff" }}
                >
                  Create Goal
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const progress = goal.targetAmountCents > 0
                ? (goal.currentAmountCents / goal.targetAmountCents) * 100
                : 0;
              const remaining = goal.targetAmountCents - goal.currentAmountCents;

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                      style={{ backgroundColor: "var(--surface-2)" }}
                    >
                      {goal.icon || "🎯"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-body font-medium" style={{ color: "var(--text)" }}>
                          {goal.name}
                        </h3>
                        <span className="text-meta font-medium" style={{ color: "var(--success)" }}>
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden mb-2"
                        style={{ backgroundColor: "var(--surface-2)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(progress, 100)}%`,
                            backgroundColor: "var(--success)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                          {formatMoney(goal.currentAmountCents)} saved
                        </span>
                        <span className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                          {formatMoney(remaining)} to go
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Lucide.CheckCircle2 className="h-5 w-5" style={{ color: "var(--success)" }} />
              <h2 className="text-h2" style={{ color: "var(--text)" }}>
                Completed
              </h2>
            </div>
            <div className="space-y-2">
              {completedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 p-2 rounded-lg"
                  style={{ backgroundColor: "var(--success-subtle)" }}
                >
                  <span className="text-lg">{goal.icon || "🎯"}</span>
                  <span className="text-body font-medium flex-1" style={{ color: "var(--text)" }}>
                    {goal.name}
                  </span>
                  <span className="text-meta" style={{ color: "var(--success)" }}>
                    {formatMoney(goal.targetAmountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SignedIn>

      {/* Create Goal Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={resetCreate}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-5 pb-8 safe-area-inset-bottom max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {createStep === "details" && (
                  <button onClick={() => setCreateStep("type")}>
                    <Lucide.ChevronLeft className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                )}
                <h2 className="text-h2" style={{ color: "var(--text)" }}>
                  {createStep === "type" ? "New Goal" : GOAL_TYPES.find(t => t.type === selectedType)?.label}
                </h2>
              </div>
              <button onClick={resetCreate}>
                <Lucide.X className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>

            {createStep === "type" ? (
              <div className="space-y-4">
                {/* Goal Type Selection */}
                <div className="space-y-2">
                  {GOAL_TYPES.map((goalType) => {
                    const Icon = goalType.icon;
                    return (
                      <button
                        key={goalType.type}
                        onClick={() => handleSelectType(goalType.type)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
                        style={{
                          backgroundColor: "var(--surface-2)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${goalType.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: goalType.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                            {goalType.label}
                          </div>
                          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                            {goalType.description}
                          </div>
                        </div>
                        <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                      </button>
                    );
                  })}
                </div>

                {/* Quick Start Suggestions */}
                <div>
                  <div className="text-micro font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Popular Goals
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_GOALS.slice(0, 6).map((suggestion) => (
                      <button
                        key={suggestion.name}
                        onClick={() => handleSelectSuggested(suggestion)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full text-sm"
                        style={{
                          backgroundColor: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        <span>{suggestion.icon}</span>
                        <span>{suggestion.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-meta font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Goal Name
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g., Emergency Fund"
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
                    Target Amount
                  </label>
                  <input
                    type="text"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    placeholder="$1,000"
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
                    Target Date (optional)
                  </label>
                  <input
                    type="date"
                    value={createTargetDate}
                    onChange={(e) => setCreateTargetDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-body outline-none"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                {createAmount && createTargetDate && (() => {
                  const target = parseFloat(createAmount.replace(/[^0-9.]/g, "")) * 100;
                  const targetDate = new Date(createTargetDate);
                  const today = new Date();
                  const monthsUntil = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000)));
                  const monthlyAmount = Math.ceil(target / monthsUntil);

                  return (
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: "var(--accent-subtle)" }}
                    >
                      <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                        To reach your goal, save about
                      </div>
                      <div className="text-body font-semibold" style={{ color: "var(--primary)" }}>
                        {formatMoney(monthlyAmount)} per month
                      </div>
                    </div>
                  );
                })()}

                <button
                  className="w-full py-3 rounded-xl font-medium"
                  style={{
                    backgroundColor: createName && createAmount ? "var(--primary)" : "var(--surface-2)",
                    color: createName && createAmount ? "#fff" : "var(--text-tertiary)",
                  }}
                  disabled={!createName || !createAmount}
                >
                  Create Goal
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
