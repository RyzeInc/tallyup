"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { formatMoney } from "@/components/utils";
import * as Lucide from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { useTimeRange } from "@/components/TimeRangeProvider";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useToast } from "@/components/ToastProvider";

/**
 * Budgeting Page - Connected to Convex API
 */

type PeriodType = "monthly" | "weekly" | "biweekly" | "quarterly" | "yearly" | "custom";

interface BudgetCategory {
  _id: Id<"budgetCategories">;
  name: string;
  budgetAmountCents: number;
  periodType: PeriodType;
  icon?: string;
  color?: string;
  matchCategories?: string[];
  rolloverEnabled?: boolean;
  isHardLimit?: boolean;
}

type EntryDoc = Doc<"entries">;

type BudgetExplain = {
  asOfDate?: number;
};

interface BudgetStatusSummary {
  planId: string;
  budgetCategoryId?: Id<"budgetCategories">;
  budgetGroupId?: Id<"budgetGroups">;
  budgetedCents: number;
  spentCents: number;
  availableCents: number;
  paceExpectedCents: number;
  paceDeltaCents: number;
  projectedEndCents: number;
  forecastRiskCents: number;
}

const DEFAULT_BUDGET_CATEGORIES = [
  { id: "housing", name: "Housing", icon: "🏠", description: "Rent, mortgage, property taxes", suggestedPercent: 30, matchCategories: ["rent", "mortgage", "housing"] },
  { id: "utilities", name: "Utilities", icon: "💡", description: "Electric, gas, water, internet, phone", suggestedPercent: 8, matchCategories: ["utilities", "electric", "gas", "water", "internet", "phone"] },
  { id: "food", name: "Food", icon: "🍽️", description: "Groceries and dining out", suggestedPercent: 12, matchCategories: ["groceries", "food", "dining", "restaurants"] },
  { id: "transportation", name: "Transportation", icon: "🚗", description: "Gas, car payments, transit", suggestedPercent: 10, matchCategories: ["transportation", "gas", "fuel", "car", "uber", "lyft", "transit"] },
  { id: "insurance", name: "Insurance", icon: "🛡️", description: "Health, auto, home, life insurance", suggestedPercent: 8, matchCategories: ["insurance"] },
  { id: "debt", name: "Debt Payments", icon: "💳", description: "Credit cards, student loans", suggestedPercent: 10, matchCategories: ["debt", "loan", "credit card"] },
  { id: "healthcare", name: "Health Care", icon: "🏥", description: "Medical, dental, prescriptions", suggestedPercent: 5, matchCategories: ["healthcare", "medical", "dental", "pharmacy"] },
  { id: "personal", name: "Personal Care", icon: "✨", description: "Clothing, haircuts, gym", suggestedPercent: 5, matchCategories: ["personal", "clothing", "gym"] },
  { id: "entertainment", name: "Entertainment", icon: "🎬", description: "Movies, games, streaming", suggestedPercent: 5, matchCategories: ["entertainment", "movies", "games", "streaming"] },
  { id: "savings", name: "Savings", icon: "💰", description: "Emergency fund, investments", suggestedPercent: 10, matchCategories: ["savings", "investments"] },
];

export default function BudgetingPage() {
  const { startDate, endDate, label } = useTimeRange();
  const toast = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"choose" | "customize" | "amount">("choose");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>({});
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingBudget, setEditingBudget] = useState<BudgetCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editRollover, setEditRollover] = useState(false);
  const [editHardLimit, setEditHardLimit] = useState(false);
  const [saving, setSaving] = useState(false);

  const budgetCategories = useQuery(api.budgets.listBudgetCategories, {}) as BudgetCategory[] | undefined;
  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 2000, type: "expense" }) as EntryDoc[] | undefined;
  const timezoneOffsetMinutes = useMemo(() => -new Date().getTimezoneOffset(), []);
  const asOfDate = Date.now();
  const budgetStatus = useQuery(api.budgetEngine.getBudgetStatus, {
    rangeStart: startDate,
    rangeEnd: endDate,
    asOfDate,
    timezoneOffsetMinutes,
    rangeMode: "proratedBudget",
  }) as { summary: BudgetStatusSummary[]; explain: BudgetExplain } | undefined;

  function errorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return undefined;
  }

  const createBudgetCategory = useMutation(api.budgets.createBudgetCategory);
  const updateBudgetCategory = useMutation(api.budgets.updateBudgetCategory);

  const categorySpending = useMemo(() => {
    if (!entries) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const entry of entries) {
      if (entry.excludeFromTotals || entry.excludeFromBudgets) continue;
      const category = (entry.category || entry.bucket || "Uncategorized").toLowerCase().trim();
      map.set(category, (map.get(category) || 0) + entry.amountCents);
    }
    return map;
  }, [entries]);

  const statusByCategory = useMemo(() => {
    const map = new Map<string, BudgetStatusSummary>();
    if (!budgetStatus?.summary) return map;
    for (const s of budgetStatus.summary) {
      if (s.budgetCategoryId) map.set(s.budgetCategoryId, s);
    }
    return map;
  }, [budgetStatus]);

  const totalSpent = useMemo(() => {
    let total = 0;
    categorySpending.forEach((v) => { total += v; });
    return total;
  }, [categorySpending]);

  const topCategories = useMemo(() => {
    return [...categorySpending.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [categorySpending]);

  const budgetHealth = useMemo(() => {
    if (!budgetCategories || budgetCategories.length === 0) return { onTrack: 0, warning: 0, overspent: 0 };
    let onTrack = 0, warning = 0, overspent = 0;
    for (const budget of budgetCategories) {
      const status = statusByCategory.get(budget._id);
      const budgeted = status?.budgetedCents ?? budget.budgetAmountCents;
      const projected = status?.projectedEndCents ?? 0;
      const paceDelta = status?.paceDeltaCents ?? 0;
      if (projected > budgeted) overspent++;
      else if (paceDelta > 0) warning++;
      else onTrack++;
    }
    return { onTrack, warning, overspent };
  }, [budgetCategories, statusByCategory]);

  function resetCreateForm() {
    setCreateStep("choose");
    setSelectedCategories(new Set());
    setCategoryAmounts({});
    setMonthlyIncome("");
  }

  function openEdit(budget: BudgetCategory) {
    setEditingBudget(budget);
    setEditName(budget.name);
    setEditAmount((budget.budgetAmountCents / 100).toFixed(0));
    setEditRollover(budget.rolloverEnabled ?? false);
    setEditHardLimit(budget.isHardLimit ?? false);
  }

  async function handleCreateBudgets() {
    setCreating(true);
    try {
      for (const catId of selectedCategories) {
        const catConfig = DEFAULT_BUDGET_CATEGORIES.find(c => c.id === catId);
        if (!catConfig) continue;
        const amountStr = categoryAmounts[catId];
        const amountCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : 0;
        if (amountCents > 0) {
          await createBudgetCategory({
            name: catConfig.name,
            icon: catConfig.icon,
            periodType: "monthly",
            budgetAmountCents: amountCents,
            matchCategories: catConfig.matchCategories,
          });
        }
      }
      toast.success("Budgets created!");
      setShowCreate(false);
      resetCreateForm();
    } catch (e: unknown) {
      toast.error("Failed to create budgets", { description: errorMessage(e) });
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingBudget) return;
    setSaving(true);
    try {
      await updateBudgetCategory({
        id: editingBudget._id,
        name: editName.trim() || undefined,
        budgetAmountCents: editAmount ? Math.round(parseFloat(editAmount) * 100) : undefined,
        rolloverEnabled: editRollover,
        isHardLimit: editHardLimit,
      });
      toast.success("Budget updated");
      setEditingBudget(null);
    } catch (e: unknown) {
      toast.error("Failed to update", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveBudget() {
    if (!editingBudget) return;
    setSaving(true);
    try {
      await updateBudgetCategory({ id: editingBudget._id, archived: true });
      toast.success("Budget archived");
      setEditingBudget(null);
    } catch (e: unknown) {
      toast.error("Failed to archive", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Budgeting"
        subtitle="Track spending against your goals"
        rightSlot={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>
            <Lucide.Plus className="h-4 w-4" />
            Add Budget
          </button>
        }
      />

      <div className="flex items-center justify-end">
        <GlobalDateRangePicker />
      </div>

      <SignedOut>
        <EmptyState icon={<Lucide.Wallet className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />} title="Sign in to manage budgets" subtitle="Create budgets to track spending by category." action={<SignInButton mode="modal"><button className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>Sign in</button></SignInButton>} />
      </SignedOut>

      <SignedIn>
        {budgetCategories && budgetCategories.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
              Budget Health ({label})
              {budgetStatus?.explain?.asOfDate && (
                <span className="ml-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  As of {new Date(budgetStatus.explain.asOfDate).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--success)" }}>{budgetHealth.onTrack}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>On Track</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--warning)" }}>{budgetHealth.warning}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Warning</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--danger)" }}>{budgetHealth.overspent}</div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Over Budget</div>
              </div>
            </div>
          </div>
        )}

        {!budgetCategories || budgetCategories.length === 0 ? (
          <EmptyState icon={<Lucide.Wallet className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />} title="No budgets yet" subtitle="Create budgets to track spending against your goals." action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>Create First Budget</button>} />
        ) : (
          <div className="space-y-3">
            {budgetCategories.map((budget) => {
              const status = statusByCategory.get(budget._id);
              const budgeted = status?.budgetedCents ?? budget.budgetAmountCents;
              const spent = status?.spentCents ?? 0;
              const available = status?.availableCents ?? (budgeted - spent);
              const paceDelta = status?.paceDeltaCents ?? 0;
              const projectedEnd = status?.projectedEndCents ?? spent;
              const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
              const isOverBudget = projectedEnd > budgeted;
              const isWarning = paceDelta > 0 && !isOverBudget;
              return (
                <button key={budget._id} onClick={() => openEdit(budget)} className="w-full text-left rounded-xl p-4 transition-colors hover:opacity-90" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{budget.icon || "📊"}</span>
                      <span className="font-medium" style={{ color: "var(--text)" }}>{budget.name}</span>
                      {budget.rolloverEnabled && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--primary-subtle)", color: "var(--primary)" }}>Rollover</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{formatMoney(spent)} / {formatMoney(budgeted)}</div>
                      <div className="text-xs" style={{ color: isOverBudget ? "var(--danger)" : isWarning ? "var(--warning)" : "var(--success)" }}>
                        {isOverBudget ? `${formatMoney(Math.abs(projectedEnd - budgeted))} projected over` : `${formatMoney(available)} available`}
                      </div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: isOverBudget ? "var(--danger)" : isWarning ? "var(--warning)" : "var(--success)" }} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div style={{ color: "var(--text-tertiary)" }}>Available</div>
                      <div className="font-medium tabular-nums" style={{ color: "var(--text)" }}>{formatMoney(available)}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-tertiary)" }}>Pace</div>
                      <div className="font-medium tabular-nums" style={{ color: paceDelta > 0 ? "var(--warning)" : "var(--success)" }}>
                        {paceDelta > 0 ? `${formatMoney(paceDelta)} over` : `${formatMoney(Math.abs(paceDelta))} under`}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-tertiary)" }}>Forecast</div>
                      <div className="font-medium tabular-nums" style={{ color: projectedEnd > budgeted ? "var(--danger)" : "var(--text)" }}>
                        {formatMoney(projectedEnd)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {(!budgetCategories || budgetCategories.length === 0) && topCategories.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Top Spending ({label})</div>
            <div className="space-y-2">
              {topCategories.map(([category, amount]) => {
                const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize" style={{ color: "var(--text)" }}>{category}</span>
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{formatMoney(amount)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "var(--primary)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Lucide.TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Projections</span>
          </div>
          {(() => {
            const now = new Date();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const daysInMonth = endOfMonth.getDate();
            const dayOfMonth = now.getDate();
            const daysLeft = daysInMonth - dayOfMonth;
            const dailyRate = totalSpent > 0 ? totalSpent / dayOfMonth : 0;
            const projectedTotal = dailyRate * daysInMonth;
            return (
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span style={{ color: "var(--text-secondary)" }}>Days left this month</span><span className="font-medium" style={{ color: "var(--text)" }}>{daysLeft}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--text-secondary)" }}>Daily average</span><span className="font-medium tabular-nums" style={{ color: "var(--text)" }}>{formatMoney(Math.round(dailyRate))}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--text-secondary)" }}>Projected month total</span><span className="font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>~{formatMoney(Math.round(projectedTotal))}</span></div>
              </div>
            );
          })()}
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCreate(false); resetCreateForm(); }} />
            <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {createStep !== "choose" && <button onClick={() => setCreateStep(createStep === "amount" ? "customize" : "choose")} className="p-1 rounded-full hover:bg-[var(--surface-2)]"><Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} /></button>}
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>{createStep === "choose" ? "Set Up Your Budget" : createStep === "customize" ? "Select Categories" : "Set Amounts"}</h2>
                </div>
                <button onClick={() => { setShowCreate(false); resetCreateForm(); }}><Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></button>
              </div>

              {createStep === "choose" && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>How would you like to create your budget?</p>
                  <button onClick={() => { setSelectedCategories(new Set(DEFAULT_BUDGET_CATEGORIES.map(c => c.id))); setCreateStep("customize"); }} className="w-full flex items-center gap-4 p-4 rounded-xl text-left hover:opacity-90" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary-subtle)" }}><Lucide.Sparkles className="h-5 w-5" style={{ color: "var(--primary)" }} /></div>
                    <div className="flex-1"><div className="font-medium" style={{ color: "var(--text)" }}>Start with recommended</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>10 common budget categories</div></div>
                    <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                  <button onClick={() => { setSelectedCategories(new Set()); setCreateStep("customize"); }} className="w-full flex items-center gap-4 p-4 rounded-xl text-left hover:opacity-90" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--surface)" }}><Lucide.Pencil className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></div>
                    <div className="flex-1"><div className="font-medium" style={{ color: "var(--text)" }}>Build from scratch</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Pick only what applies to you</div></div>
                    <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                </div>
              )}

              {createStep === "customize" && (
                <div className="space-y-4">
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Select categories to budget for:</p>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {DEFAULT_BUDGET_CATEGORIES.map((cat) => {
                      const isSelected = selectedCategories.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            const updated = new Set(selectedCategories);
                            if (isSelected) {
                              updated.delete(cat.id);
                            } else {
                              updated.add(cat.id);
                            }
                            setSelectedCategories(updated);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
                          style={{ backgroundColor: isSelected ? "var(--primary-subtle)" : "var(--surface-2)", border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}` }}
                        >
                          <span className="text-lg">{cat.icon}</span>
                          <div className="flex-1"><div className="text-sm font-medium" style={{ color: "var(--text)" }}>{cat.name}</div><div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{cat.description}</div></div>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: isSelected ? "var(--primary)" : "var(--surface)", border: isSelected ? "none" : "2px solid var(--border)" }}>{isSelected && <Lucide.Check className="h-3 w-3 text-white" />}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setCreateStep("amount")} disabled={selectedCategories.size === 0} className="w-full py-2.5 rounded-xl font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>Continue ({selectedCategories.size} selected)</button>
                </div>
              )}

              {createStep === "amount" && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--primary-subtle)" }}>
                    <div className="flex items-center gap-2 mb-2"><Lucide.Lightbulb className="h-4 w-4" style={{ color: "var(--primary)" }} /><span className="text-xs font-medium" style={{ color: "var(--primary)" }}>Quick Setup</span></div>
                    <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>Enter monthly income for suggested amounts:</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                      <input type="number" value={monthlyIncome} onChange={(e) => { setMonthlyIncome(e.target.value); if (e.target.value) { const income = parseFloat(e.target.value) * 100; const amounts: Record<string, string> = {}; DEFAULT_BUDGET_CATEGORIES.forEach((cat) => { if (selectedCategories.has(cat.id)) { amounts[cat.id] = (Math.round((income * cat.suggestedPercent) / 100) / 100).toFixed(0); } }); setCategoryAmounts(amounts); } }} placeholder="5000" className="w-full pl-7 pr-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }} />
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {DEFAULT_BUDGET_CATEGORIES.filter(c => selectedCategories.has(c.id)).map((cat) => (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-lg">{cat.icon}</span>
                        <div className="flex-1"><div className="text-sm font-medium" style={{ color: "var(--text)" }}>{cat.name}</div>{monthlyIncome && <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{cat.suggestedPercent}% suggested</div>}</div>
                        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span><input type="number" value={categoryAmounts[cat.id] || ""} onChange={(e) => setCategoryAmounts(prev => ({ ...prev, [cat.id]: e.target.value }))} placeholder="0" className="w-24 pl-7 pr-2 py-2 rounded-lg text-sm text-right" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="flex justify-between mb-3"><span className="text-sm font-medium" style={{ color: "var(--text)" }}>Total Budget</span><span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{formatMoney(Object.values(categoryAmounts).reduce((s, v) => s + (parseFloat(v || "0") * 100), 0))}/mo</span></div>
                    <button onClick={handleCreateBudgets} disabled={creating} className="w-full py-2.5 rounded-xl font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>{creating ? "Creating..." : "Create Budgets"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {editingBudget && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setEditingBudget(null)} />
            <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Edit Budget</h2><button onClick={() => setEditingBudget(null)}><Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></button></div>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} /></div>
                <div><label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Budget Amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>$</span><input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full pl-7 pr-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} /></div></div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editRollover} onChange={(e) => setEditRollover(e.target.checked)} className="w-4 h-4 rounded" /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Enable rollover</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editHardLimit} onChange={(e) => setEditHardLimit(e.target.checked)} className="w-4 h-4 rounded" /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Hard limit warning</span></label>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleArchiveBudget} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}>Archive</button>
                  <button onClick={() => setEditingBudget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}>Cancel</button>
                  <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>{saving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}
