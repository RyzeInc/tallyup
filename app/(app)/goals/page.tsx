"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatMoney } from "@/components/utils";
import * as Lucide from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ToastProvider";

/**
 * Goals Page - Connected to Convex API
 */

type GoalType = "savings" | "paydown" | "sinkingFund";
type GoalStatus = "active" | "paused" | "completed" | "abandoned";

interface Goal {
  _id: Id<"goals">;
  name: string;
  description?: string;
  goalType: GoalType;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate?: number;
  icon?: string;
  color?: string;
  status: GoalStatus;
  priority?: number;
}

const GOAL_TYPES = [
  { type: "savings" as const, label: "Savings Goal", description: "Save toward a specific target", icon: Lucide.PiggyBank, color: "var(--success)" },
  { type: "paydown" as const, label: "Pay-Down Goal", description: "Track debt repayment progress", icon: Lucide.TrendingDown, color: "var(--warning)" },
  { type: "sinkingFund" as const, label: "Sinking Fund", description: "Prepare for recurring expenses", icon: Lucide.Calendar, color: "var(--primary)" },
];

const SUGGESTED_GOALS = [
  { name: "Emergency Fund", icon: "🆘", type: "savings" },
  { name: "Vacation", icon: "🏖️", type: "savings" },
  { name: "New Car", icon: "🚗", type: "savings" },
  { name: "Down Payment", icon: "🏠", type: "savings" },
  { name: "Credit Card Payoff", icon: "💳", type: "paydown" },
  { name: "Student Loans", icon: "🎓", type: "paydown" },
  { name: "Insurance Premium", icon: "📋", type: "sinkingFund" },
  { name: "Holiday Gifts", icon: "🎁", type: "sinkingFund" },
  { name: "Car Maintenance", icon: "🔧", type: "sinkingFund" },
];

export default function GoalsPage() {
  const toast = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<GoalType | null>(null);
  const [createName, setCreateName] = useState("");
  const [createIcon, setCreateIcon] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createTargetDate, setCreateTargetDate] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editName, setEditName] = useState("");
  const [editCurrentAmount, setEditCurrentAmount] = useState("");
  const [editTargetAmount, setEditTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Queries
  const goals = useQuery(api.goals.listGoals, { includeCompleted: true }) as Goal[] | undefined;
  const plaidSuggestedGoals = useQuery(api.plaid.getPlaidSuggestedGoals, {});

  // Mutations
  const createGoal = useMutation(api.goals.createGoal);
  const updateGoalMutation = useMutation(api.goals.updateGoal);
  const updateGoalProgress = useMutation(api.goals.updateGoalProgress);

  function errorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return undefined;
  }

  const activeGoals = useMemo(() => (goals ?? []).filter((g) => g.status === "active"), [goals]);
  const completedGoals = useMemo(() => (goals ?? []).filter((g) => g.status === "completed"), [goals]);

  // Filter out Plaid suggestions that already have similar goals
  const filteredPlaidSuggestions = useMemo(() => {
    if (!plaidSuggestedGoals || plaidSuggestedGoals.length === 0) return [];
    const activeNames = new Set(activeGoals.map(g => g.name.toLowerCase()));
    return plaidSuggestedGoals.filter(
      s => !activeNames.has(s.name.toLowerCase())
    );
  }, [plaidSuggestedGoals, activeGoals]);

  const totalProgress = useMemo(() => {
    return activeGoals.reduce(
      (acc, goal) => ({ current: acc.current + goal.currentAmountCents, target: acc.target + goal.targetAmountCents }),
      { current: 0, target: 0 }
    );
  }, [activeGoals]);

  const overallProgress = totalProgress.target > 0 ? (totalProgress.current / totalProgress.target) * 100 : 0;

  function handleSelectType(type: GoalType) {
    setSelectedType(type);
    setCreateStep("details");
  }

  function handleSelectSuggested(suggestion: typeof SUGGESTED_GOALS[0]) {
    setSelectedType(suggestion.type as GoalType);
    setCreateName(suggestion.name);
    setCreateIcon(suggestion.icon);
    setCreateStep("details");
  }

  function resetCreate() {
    setShowCreate(false);
    setCreateStep("type");
    setSelectedType(null);
    setCreateName("");
    setCreateIcon("");
    setCreateAmount("");
    setCreateTargetDate("");
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setEditName(goal.name);
    setEditCurrentAmount((goal.currentAmountCents / 100).toFixed(2));
    setEditTargetAmount((goal.targetAmountCents / 100).toFixed(2));
  }

  async function handleCreate() {
    if (!createName.trim() || !createAmount || !selectedType) return;
    setCreating(true);
    try {
      const targetAmountCents = Math.round(parseFloat(createAmount.replace(/[^0-9.]/g, "")) * 100);
      const targetDate = createTargetDate ? new Date(createTargetDate).getTime() : undefined;
      await createGoal({
        name: createName.trim(),
        icon: createIcon || undefined,
        goalType: selectedType,
        targetAmountCents,
        targetDate,
      });
      toast.success("Goal created!");
      resetCreate();
    } catch (e: unknown) {
      toast.error("Failed to create goal", { description: errorMessage(e) });
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingGoal) return;
    setSaving(true);
    try {
      const currentCents = Math.round(parseFloat(editCurrentAmount || "0") * 100);
      const targetCents = Math.round(parseFloat(editTargetAmount || "0") * 100);
      const delta = currentCents - editingGoal.currentAmountCents;
      
      if (delta !== 0) {
        await updateGoalProgress({ id: editingGoal._id, deltaAmountCents: delta });
      }
      if (editName.trim() !== editingGoal.name || targetCents !== editingGoal.targetAmountCents) {
        await updateGoalMutation({ id: editingGoal._id, name: editName.trim(), targetAmountCents: targetCents });
      }
      toast.success("Goal updated");
      setEditingGoal(null);
    } catch (e: unknown) {
      toast.error("Failed to update goal", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteGoal() {
    if (!editingGoal) return;
    setSaving(true);
    try {
      await updateGoalMutation({ id: editingGoal._id, status: "completed" });
      toast.success("Goal completed! 🎉");
      setEditingGoal(null);
    } catch (e: unknown) {
      toast.error("Failed to complete goal", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleAbandonGoal() {
    if (!editingGoal) return;
    setSaving(true);
    try {
      await updateGoalMutation({ id: editingGoal._id, status: "abandoned" });
      toast.success("Goal archived");
      setEditingGoal(null);
    } catch (e: unknown) {
      toast.error("Failed to archive goal", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>
          <Lucide.Plus className="h-4 w-4" />
          Add Goal
        </button>
      </div>

      <SignedOut>
        <EmptyState icon={<Lucide.Target className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />} title="Sign in to set goals" subtitle="Track savings, debt payoff, and sinking funds." action={<SignInButton mode="modal"><button className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>Sign in</button></SignInButton>} />
      </SignedOut>

      <SignedIn>
        {/* Overall Progress */}
        {activeGoals.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Progress</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{Math.round(overallProgress)}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden mb-2" style={{ backgroundColor: "var(--surface-2)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(overallProgress, 100)}%`, backgroundColor: "var(--success)" }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium" style={{ color: "var(--text)" }}>{formatMoney(totalProgress.current)}</span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>of {formatMoney(totalProgress.target)}</span>
            </div>
          </div>
        )}

        {/* Active Goals */}
        {activeGoals.length === 0 ? (
          <EmptyState icon={<Lucide.Target className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />} title="Start your first goal" subtitle="Goals help you save intentionally. Track emergency funds, vacations, or debt payoff." action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>Create Goal</button>} />
        ) : (
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const progress = goal.targetAmountCents > 0 ? (goal.currentAmountCents / goal.targetAmountCents) * 100 : 0;
              const remaining = goal.targetAmountCents - goal.currentAmountCents;
              return (
                <button key={goal._id} onClick={() => openEdit(goal)} className="w-full text-left rounded-xl p-4 transition-colors hover:opacity-90" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ backgroundColor: "var(--surface-2)" }}>{goal.icon || "🎯"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium" style={{ color: "var(--text)" }}>{goal.name}</h3>
                        <span className="text-sm font-medium" style={{ color: "var(--success)" }}>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: "var(--surface-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: "var(--success)" }} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: "var(--text-secondary)" }}>{formatMoney(goal.currentAmountCents)} saved</span>
                        <span style={{ color: "var(--text-tertiary)" }}>{formatMoney(remaining)} to go</span>
                      </div>
                      {goal.targetDate && (
                        <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                          Target: {new Date(goal.targetDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Plaid-Suggested Goals */}
        {filteredPlaidSuggestions.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Lucide.Sparkles className="h-5 w-5" style={{ color: "var(--primary)" }} />
              <h2 className="font-medium" style={{ color: "var(--text)" }}>Suggested Goals</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--primary-subtle)", color: "var(--primary)" }}>
                From Plaid
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
              Based on your connected accounts and spending patterns
            </p>
            <div className="space-y-2">
              {filteredPlaidSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.type}-${suggestion.name}-${idx}`}
                  onClick={() => {
                    setSelectedType(suggestion.type);
                    setCreateName(suggestion.name);
                    setCreateIcon(suggestion.icon);
                    setCreateAmount((suggestion.suggestedAmountCents / 100).toFixed(2));
                    setCreateStep("details");
                    setShowCreate(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--surface-2)" }}
                >
                  <span className="text-lg">{suggestion.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ color: "var(--text)" }}>{suggestion.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{suggestion.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium" style={{ color: suggestion.type === "paydown" ? "var(--warning)" : "var(--success)" }}>
                      {formatMoney(suggestion.suggestedAmountCents)}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {suggestion.type === "paydown" ? "to pay off" : "to save"}
                    </div>
                  </div>
                  <Lucide.ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Lucide.CheckCircle2 className="h-5 w-5" style={{ color: "var(--success)" }} />
              <h2 className="font-medium" style={{ color: "var(--text)" }}>Completed</h2>
            </div>
            <div className="space-y-2">
              {completedGoals.map((goal) => (
                <div key={goal._id} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: "var(--success-subtle)" }}>
                  <span className="text-lg">{goal.icon || "🎯"}</span>
                  <span className="font-medium flex-1" style={{ color: "var(--text)" }}>{goal.name}</span>
                  <span className="text-xs" style={{ color: "var(--success)" }}>{formatMoney(goal.targetAmountCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={resetCreate} />
            <div className="relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {createStep === "details" && <button onClick={() => setCreateStep("type")}><Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} /></button>}
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>{createStep === "type" ? "New Goal" : GOAL_TYPES.find(t => t.type === selectedType)?.label}</h2>
                </div>
                <button onClick={resetCreate}><Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></button>
              </div>

              {createStep === "type" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {GOAL_TYPES.map((goalType) => {
                      const Icon = goalType.icon;
                      return (
                        <button key={goalType.type} onClick={() => handleSelectType(goalType.type)} className="w-full flex items-center gap-3 p-4 rounded-xl text-left" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${goalType.color}20` }}><Icon className="h-5 w-5" style={{ color: goalType.color }} /></div>
                          <div className="flex-1"><div className="font-medium" style={{ color: "var(--text)" }}>{goalType.label}</div><div className="text-xs" style={{ color: "var(--text-secondary)" }}>{goalType.description}</div></div>
                          <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Popular Goals</div>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_GOALS.slice(0, 6).map((suggestion) => (
                        <button key={suggestion.name} onClick={() => handleSelectSuggested(suggestion)} className="flex items-center gap-2 px-3 py-2 rounded-full text-sm" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                          <span>{suggestion.icon}</span><span>{suggestion.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div><label className="text-sm font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Goal Name</label><input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g., Emergency Fund" className="w-full px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} /></div>
                  <div><label className="text-sm font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Target Amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>$</span><input type="text" value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} placeholder="1,000" className="w-full pl-7 pr-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} /></div></div>
                  <div><label className="text-sm font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Target Date (optional)</label><input type="date" value={createTargetDate} onChange={(e) => setCreateTargetDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} /></div>
                  
                  {createAmount && createTargetDate && (() => {
                    const target = parseFloat(createAmount.replace(/[^0-9.]/g, "")) * 100;
                    const targetDate = new Date(createTargetDate);
                    const today = new Date();
                    const daysUntil = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
                    const monthsUntil = Math.max(0.5, daysUntil / 30.44);
                    const monthlyAmount = Math.ceil(target / monthsUntil);
                    const weeklyAmount = Math.ceil(target / Math.max(1, daysUntil / 7));
                    return (
                      <div className="p-3 rounded-xl space-y-2" style={{ backgroundColor: "var(--primary-subtle)" }}>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>To reach your goal in {daysUntil} days:</div>
                        <div className="flex justify-between text-sm"><span style={{ color: "var(--text-secondary)" }}>Per month:</span><span className="font-semibold" style={{ color: "var(--primary)" }}>{formatMoney(monthlyAmount)}</span></div>
                        <div className="flex justify-between text-sm"><span style={{ color: "var(--text-secondary)" }}>Per week:</span><span className="font-semibold" style={{ color: "var(--primary)" }}>{formatMoney(weeklyAmount)}</span></div>
                      </div>
                    );
                  })()}

                  <button onClick={handleCreate} disabled={!createName || !createAmount || creating} className="w-full py-3 rounded-xl font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>{creating ? "Creating..." : "Create Goal"}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingGoal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditingGoal(null)} />
            <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{editingGoal.icon || "🎯"}</span>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Edit Goal</h2>
                </div>
                <button onClick={() => setEditingGoal(null)}><Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></button>
              </div>

              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} /></div>
                <div><label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Current Amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>$</span><input type="number" step="0.01" value={editCurrentAmount} onChange={(e) => setEditCurrentAmount(e.target.value)} className="w-full pl-7 pr-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} /></div></div>
                <div><label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Target Amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>$</span><input type="number" step="0.01" value={editTargetAmount} onChange={(e) => setEditTargetAmount(e.target.value)} className="w-full pl-7 pr-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} /></div></div>

                <div className="flex gap-2 pt-2">
                  <button onClick={handleAbandonGoal} disabled={saving} className="px-3 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}>Archive</button>
                  <button onClick={handleCompleteGoal} disabled={saving} className="px-3 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--success-subtle)", color: "var(--success)" }}>Complete</button>
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
