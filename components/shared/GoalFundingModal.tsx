"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { X, Wallet, Tag, Percent, Info, Check } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface GoalFundingModalProps {
  goalId: Id<"goals">;
  goalName: string;
  currentFundingAccountId?: Id<"accounts">;
  currentFundingCategories?: string[];
  currentAutoAllocatePercent?: number;
  currentAutoAllocateEnabled?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function GoalFundingModal({
  goalId,
  goalName,
  currentFundingAccountId,
  currentFundingCategories,
  currentAutoAllocatePercent,
  currentAutoAllocateEnabled,
  onClose,
  onSaved,
}: GoalFundingModalProps) {
  const toast = useToast();
  const updateGoal = useMutation(api.goals.updateGoal);

  // Fetch accounts and income categories for selection
  const accounts = useQuery(api.accounts.listAccounts, {}) as
    | { _id: Id<"accounts">; name: string; type?: string; currentBalance?: number }[]
    | undefined;
  const incomeCategories = useQuery(api.categories.listCategories, { categoryType: "income" }) as
    | { _id: string; name: string }[]
    | undefined;

  // State
  const [fundingAccountId, setFundingAccountId] = useState<Id<"accounts"> | null>(
    currentFundingAccountId || null
  );
  const [fundingCategories, setFundingCategories] = useState<string[]>(
    currentFundingCategories || []
  );
  const [autoAllocatePercent, setAutoAllocatePercent] = useState<number>(
    currentAutoAllocatePercent ?? 10
  );
  const [autoAllocateEnabled, setAutoAllocateEnabled] = useState<boolean>(
    currentAutoAllocateEnabled ?? false
  );
  const [saving, setSaving] = useState(false);

  // Get unique income category names
  const incomeCategoryNames = useMemo(() => {
    if (!incomeCategories) return [];
    return [...new Set(incomeCategories.map((c) => c.name))].sort();
  }, [incomeCategories]);

  function toggleCategory(name: string) {
    setFundingCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGoal({
        id: goalId,
        fundingAccountId: fundingAccountId || null,
        fundingIncomeCategories: fundingCategories.length > 0 ? fundingCategories : null,
        autoAllocatePercent: autoAllocateEnabled ? autoAllocatePercent : null,
        autoAllocateEnabled,
      });
      toast.success("Funding settings saved");
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error("Failed to save", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-10 w-full sm:w-[480px] sm:max-w-[calc(100vw-32px)] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Configure goal funding"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              Auto-Funding Settings
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {goalName}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]">
            <X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Info Box */}
          <div
            className="flex gap-3 p-3 rounded-xl"
            style={{ backgroundColor: "var(--primary-subtle)" }}
          >
            <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
                How auto-funding works
              </p>
              <p>
                When income from selected categories is logged, a portion can automatically
                contribute to this goal. Great for dedicating gig income or bonuses to savings.
              </p>
            </div>
          </div>

          {/* Funding Account */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Funding Account
              </span>
            </div>
            <select
              value={fundingAccountId || ""}
              onChange={(e) =>
                setFundingAccountId(e.target.value ? (e.target.value as Id<"accounts">) : null)
              }
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="">No account linked</option>
              {accounts?.map((account) => (
                <option key={account._id} value={account._id}>
                  {account.name}
                  {account.type ? ` (${account.type})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              Optional: Link this goal to a specific account for tracking
            </p>
          </div>

          {/* Income Categories */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Fund from Income Categories
              </span>
            </div>
            {incomeCategoryNames.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                No income categories found. Log some income first!
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {incomeCategoryNames.map((name) => {
                  const isSelected = fundingCategories.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleCategory(name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--primary)" : "var(--surface-subtle)",
                        color: isSelected ? "var(--on-primary)" : "var(--text)",
                        border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                      }}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
              Select which income types should contribute to this goal
            </p>
          </div>

          {/* Auto-Allocate Toggle */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--surface-subtle)" }}
          >
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Enable Auto-Allocation
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoAllocateEnabled}
                onChange={(e) => setAutoAllocateEnabled(e.target.checked)}
                className="h-5 w-5 rounded"
                style={{ accentColor: "var(--primary)" }}
              />
            </label>

            {autoAllocateEnabled && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Allocation Percentage
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>
                    {autoAllocatePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={autoAllocatePercent}
                  onChange={(e) => setAutoAllocatePercent(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--primary)" }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                  <span>1%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {autoAllocateEnabled && fundingCategories.length > 0 && (
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--success-subtle)", border: "1px solid var(--success)" }}
            >
              <div className="text-sm font-medium mb-1" style={{ color: "var(--success)" }}>
                Auto-Funding Preview
              </div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                When you log income from{" "}
                <span className="font-medium" style={{ color: "var(--text)" }}>
                  {fundingCategories.join(", ")}
                </span>
                , {autoAllocatePercent}% will automatically go toward{" "}
                <span className="font-medium" style={{ color: "var(--text)" }}>
                  {goalName}
                </span>
                .
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
