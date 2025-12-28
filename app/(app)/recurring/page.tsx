"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { useTabs } from "@/components/PersistentTabs";
import { useToast } from "@/components/ToastProvider";

export default function RecurringPage() {
  const { setActiveTab } = useTabs();
  const toast = useToast();
  const rules = useQuery((api as any).recurring.listRecurringRules as any) as any[] | undefined;
  const updateRule = useMutation((api as any).recurring.updateRecurringRule as any);

  // Edit modal state
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editAutolink, setEditAutolink] = useState(false);
  const [saving, setSaving] = useState(false);

  function openEdit(rule: any) {
    setEditingRule(rule);
    setEditName(rule.displayName ?? rule.name ?? rule.category ?? "");
    setEditAutolink(rule.autolinkEnabled ?? false);
  }

  async function handleSaveEdit() {
    if (!editingRule) return;
    setSaving(true);
    try {
      await updateRule({
        id: editingRule._id,
        displayName: editName.trim() || undefined,
        autolinkEnabled: editAutolink,
      });
      toast.success("Pattern updated");
      setEditingRule(null);
    } catch (e: any) {
      toast.error("Failed to update", { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Patterns"
        subtitle="Saved patterns you've confirmed"
        rightSlot={
          <button
            onClick={() => setActiveTab("activity")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--on-primary)",
            }}
          >
            <Lucide.Plus className="h-4 w-4" />
            Add
          </button>
        }
      />

      {!rules ? (
        <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Lucide.Repeat className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="No patterns yet"
          subtitle="Create patterns from your transactions to track recurring expenses and income automatically."
          action={
            <button
              onClick={() => setActiveTab("activity")}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
            >
              View Transactions
            </button>
          }
        />
      ) : (
        <div className="space-y-3 mt-4">
          {rules.map((r) => (
            <button
              key={r._id}
              onClick={() => openEdit(r)}
              className="w-full text-left rounded-xl border p-4 transition-colors hover:bg-[var(--surface-subtle)]"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: r.type === "income" ? "var(--success-subtle)" : "var(--surface-2)" }}
                >
                  <Lucide.Repeat className="h-5 w-5" style={{ color: r.type === "income" ? "var(--success)" : "var(--text-tertiary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {r.displayName ?? r.name ?? r.category ?? "Unnamed"}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {r.cadenceType ?? r.intervalType ?? "Monthly"} · {r.autolinkEnabled ? "Auto-applied" : "Manual"}
                  </div>
                </div>
                {r.amountCents && (
                  <div className="text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
                    ${(r.amountCents / 100).toFixed(2)}
                  </div>
                )}
                <Lucide.ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Edit Pattern Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setEditingRule(null)}
          />
          <div
            className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                Edit Pattern
              </h3>
              <button
                onClick={() => setEditingRule(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
              >
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-tertiary)" }}>
                  Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editAutolink}
                  onChange={(e) => setEditAutolink(e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--primary)" }}
                />
                <span className="text-sm" style={{ color: "var(--text)" }}>
                  Auto-apply to future entries
                </span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingRule(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--text)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
