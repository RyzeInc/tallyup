"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type Rule = Doc<"recurringRules">;
type CadenceKind = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

function centsToDollars(cents?: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return undefined;
  return Math.round(num * 100);
}

// Separate form component that gets recreated when rule changes (via key prop)
function RuleEditorForm({
  rule,
  onClose,
}: {
  rule?: Rule;
  onClose: () => void;
}) {
  const toast = useToast();
  const createRule = useMutation(api.recurring.createRecurringRule);
  const updateRule = useMutation(api.recurring.updateRecurringRule);
  const refreshExpectedCharges = useMutation(api.recurring.refreshExpectedCharges);

  const isEditing = !!rule;
  
  // Calculate initial values - these only run once when component mounts
  const anchorTs = rule?.cadence?.anchorDate ?? (rule?.cadenceAnchor ? Date.parse(rule.cadenceAnchor) : undefined);
  
  const [name, setName] = useState(rule?.displayName ?? rule?.name ?? "");
  const [type, setType] = useState<"expense" | "income">(rule?.type ?? "expense");
  const [amount, setAmount] = useState(centsToDollars(rule?.amountPolicy?.amountCents ?? rule?.amountCents));
  const [cadence, setCadence] = useState<CadenceKind>((rule?.cadence?.kind ?? rule?.cadenceType ?? "monthly") as CadenceKind);
  const [anchorDate, setAnchorDate] = useState(anchorTs ? new Date(anchorTs).toISOString().slice(0, 10) : "");
  const [category, setCategory] = useState(rule?.category ?? "");

  const cadenceLabel = useMemo(() => {
    if (!anchorDate) return "";
    const d = new Date(anchorDate + "T00:00:00");
    if (cadence === "weekly" || cadence === "biweekly") {
      return d.toLocaleDateString(undefined, { weekday: "long" });
    }
    if (cadence === "yearly") {
      return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
    }
    return `Day ${d.getDate()}`;
  }, [anchorDate, cadence]);

  async function handleSave() {
    const cents = dollarsToCents(amount);
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!anchorDate) {
      toast.error("Start date is required");
      return;
    }
    const anchorTs = new Date(anchorDate + "T00:00:00").getTime();
    const payload = {
      displayName: name.trim(),
      name: name.trim(),
      type,
      category: category.trim() || undefined,
      amountCents: cents,
      amountPolicy: cents
        ? { kind: "fixed" as const, amountCents: cents, toleranceBps: 300 }
        : undefined,
      cadence: { kind: cadence, anchorDate: anchorTs },
      cadenceType: cadence,
      status: "active" as const,
      active: true,
    };

    try {
      if (isEditing && rule) {
        await updateRule({ id: rule._id, ...payload });
        await refreshExpectedCharges({ ruleId: rule._id, monthsAhead: 6 });
      } else {
        const res = await createRule(payload);
        if (res?.id) {
          await refreshExpectedCharges({ ruleId: res.id, monthsAhead: 6 });
        }
      }
      toast.success("Recurring rule saved");
      onClose();
    } catch {
      toast.error("Failed to save recurring rule");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {isEditing ? "Edit recurring rule" : "New recurring rule"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]">
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </Field>

          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "expense" | "income")}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </Field>

          <Field label="Amount">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </Field>

          <Field label="Cadence">
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as CadenceKind)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>

          <Field label="Start date">
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            {cadenceLabel && (
              <div className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                {cadence === "weekly" || cadence === "biweekly"
                  ? `Runs on ${cadenceLabel}`
                  : cadence === "yearly"
                  ? `Runs on ${cadenceLabel}`
                  : `Runs on ${cadenceLabel} each cycle`}
              </div>
            )}
          </Field>

          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            Save rule
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// Wrapper component that handles open/close and uses key to reset form state
export default function RuleEditorDialog({
  open,
  onClose,
  rule,
}: {
  open: boolean;
  onClose: () => void;
  rule?: Rule;
}) {
  if (!open) return null;
  
  // Key forces form to remount when rule changes, resetting all state
  return <RuleEditorForm key={rule?._id ?? "new"} rule={rule} onClose={onClose} />;
}
