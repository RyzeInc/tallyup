"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

// API goal types
type ApiGoalType = "savings" | "paydown" | "sinkingFund";

// UI goal type keys
type GoalTypeKey = "emergency" | "savings" | "debt" | "sinking" | "custom";

const TYPE_OPTIONS: {
  key: GoalTypeKey;
  apiType: ApiGoalType;
  title: string;
  icon: string;
  description: string;
}[] = [
  { key: "emergency", apiType: "savings", title: "Emergency Fund", icon: "🛡️", description: "3-6 months expenses" },
  { key: "savings", apiType: "savings", title: "Savings Goal", icon: "💰", description: "Vacation, purchase, etc." },
  { key: "debt", apiType: "paydown", title: "Debt Payoff", icon: "📉", description: "Pay down a debt" },
  { key: "sinking", apiType: "sinkingFund", title: "Sinking Fund", icon: "📅", description: "Annual or irregular expenses" },
  { key: "custom", apiType: "savings", title: "Custom Goal", icon: "🎯", description: "Any other goal" },
];

type AddGoalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoalCreated?: (goalId: string, goalName: string) => void;
};

export function AddGoalDialog({
  open,
  onOpenChange,
  onGoalCreated,
}: AddGoalDialogProps) {
  const toast = useToast();
  const createGoal = useMutation(api.goals.createGoal);

  const [step, setStep] = React.useState(0);
  const [type, setType] = React.useState<GoalTypeKey>("savings");
  const [name, setName] = React.useState("");
  const [targetAmount, setTargetAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setType("savings");
      setName("");
      setTargetAmount("");
      setSaving(false);
    }
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const canContinue = React.useMemo(() => {
    if (step === 0) return !!type;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return !!targetAmount.trim() && !Number.isNaN(parseFloat(targetAmount));
    return true;
  }, [step, type, name, targetAmount]);

  const handleNext = () => {
    if (!canContinue) return;
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    const amountCents = Math.round(parseFloat(targetAmount.replace(/[^0-9.]/g, "")) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    setSaving(true);
    try {
      const selectedType = TYPE_OPTIONS.find((t) => t.key === type);
      const goalId = await createGoal({
        name: name.trim(),
        icon: selectedType?.icon,
        goalType: selectedType?.apiType ?? "savings",
        targetAmountCents: amountCents,
      });
      toast.success(`Goal "${name.trim()}" created`);
      onGoalCreated?.(goalId, name.trim());
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to create goal", { description: message });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog Content */}
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <div className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Add Goal
            </div>
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Step {step + 1} of 3 · {step === 0 ? "Type" : step === 1 ? "Name" : "Target"}
            </div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 transition-colors hover:bg-[var(--surface-subtle)]"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {/* Step Content */}
        <div className="px-4 py-4" style={{ minHeight: "180px" }}>
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const isSelected = type === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setType(opt.key)}
                    className="flex flex-col items-center gap-1 rounded-xl p-3 transition-all"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "var(--surface-subtle)",
                      border: isSelected ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span
                      className="text-xs font-medium text-center"
                      style={{ color: isSelected ? "var(--primary-foreground)" : "var(--text)" }}
                    >
                      {opt.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                  Goal Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={TYPE_OPTIONS.find((t) => t.key === type)?.description || "e.g., Vacation Fund"}
                  autoFocus
                  className="w-full h-11 px-3 rounded-xl text-sm"
                  style={{
                    backgroundColor: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canContinue) handleNext();
                  }}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                  Target Amount
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="w-full h-11 pl-7 pr-3 rounded-xl text-sm"
                    style={{
                      backgroundColor: "var(--surface-subtle)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canContinue) handleSave();
                    }}
                  />
                </div>
              </div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                You can adjust this later and add contributions from the Goals page.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 h-11 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-subtle)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canContinue}
              className="flex-1 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canContinue || saving}
              className="flex-1 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {saving ? "Creating..." : "Create Goal"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
