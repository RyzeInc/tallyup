"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type AccountType =
  | "credit"
  | "checking"
  | "savings"
  | "investment"
  | "loan"
  | "business"
  | "other";

const TYPE_OPTIONS: {
  key: AccountType;
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { key: "checking", title: "Checking", icon: Lucide.Landmark },
  { key: "savings", title: "Savings", icon: Lucide.PiggyBank },
  { key: "credit", title: "Credit", icon: Lucide.CreditCard },
  { key: "investment", title: "Investment", icon: Lucide.TrendingUp },
  { key: "loan", title: "Loan", icon: Lucide.Percent },
  { key: "business", title: "Business", icon: Lucide.Briefcase },
  { key: "other", title: "Other", icon: Lucide.Folder },
];

type AddAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated?: (accountId: string, accountName: string) => void;
};

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
}: AddAccountDialogProps) {
  const toast = useToast();
  const createAccount = useMutation(api.accounts.createAccount);

  const [step, setStep] = React.useState(0);
  const [type, setType] = React.useState<AccountType>("checking");
  const [name, setName] = React.useState("");
  const [startingBalance, setStartingBalance] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setType("checking");
      setName("");
      setStartingBalance("");
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
    // Step 2: Starting balance is optional - empty means 0
    if (step === 2) {
      if (!startingBalance.trim()) return true; // Empty = 0, valid
      return !Number.isNaN(parseFloat(startingBalance));
    }
    return true;
  }, [step, type, name, startingBalance]);

  const handleNext = () => {
    if (!canContinue) return;
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    // Default to 0 if empty
    const balanceCents = startingBalance.trim() 
      ? Math.round(parseFloat(startingBalance) * 100)
      : 0;
    if (!Number.isFinite(balanceCents)) {
      toast.error("Enter a valid starting balance");
      return;
    }
    setSaving(true);
    try {
      const result = await createAccount({
        name: name.trim(),
        type,
        showInTransactionSelector: true,
        initialBalance: balanceCents,
        asOf: Date.now(),
      });
      toast.success(`Account "${name.trim()}" created`);
      onAccountCreated?.(result.id, name.trim());
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to create account", { description: message });
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
              Add Account
            </div>
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Step {step + 1} of 3 · {step === 0 ? "Type" : step === 1 ? "Name" : "Balance"}
            </div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 transition-colors hover:bg-[var(--surface-subtle)]"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = type === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setType(opt.key)}
                    className="flex items-center gap-2 p-3 rounded-xl text-left transition-colors"
                    style={{
                      backgroundColor: selected ? "var(--accent-subtle)" : "var(--surface-2)",
                      border: selected ? "1px solid var(--primary)" : "1px solid var(--border)",
                    }}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: selected ? "var(--primary)" : "var(--text-tertiary)" }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: selected ? "var(--primary)" : "var(--text)" }}
                    >
                      {opt.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)" }}
              >
                Account nickname
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily Checking"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue) {
                    handleNext();
                  }
                }}
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)" }}
              >
                Starting balance <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  $
                </span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canContinue) {
                      handleSave();
                    }
                  }}
                />
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Your current balance as of today. Leave blank to start at $0.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={step === 0 ? () => onOpenChange(false) : handleBack}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--surface-2)",
              color: "var(--text)",
            }}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 2 ? (
            <button
              onClick={handleNext}
              disabled={!canContinue}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !canContinue}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {saving ? "Creating..." : "Create"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
