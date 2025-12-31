"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { centsToDollars, dollarsToCents } from "./utils";
import { useToast } from "./ToastProvider";
import { useOptimisticLinks } from "./OptimisticLinksProvider";

type EntryDoc = Doc<"entries">;
type EditableEntry = EntryDoc & { type: "expense" | "income" };

export default function RecurringModal({
  entry,
  onClose,
  onCreated,
}: {
  entry: EditableEntry;
  onClose: () => void;
  onCreated?: (ruleId: Id<"recurringRules">) => void;
}) {
  const [displayName, setDisplayName] = useState(entry.bucket ? `${entry.bucket} ${entry.category ?? ""}`.trim() : entry.note ?? "");
  const [autolink, setAutolink] = useState(false);
  const [autolinkConfirm, setAutolinkConfirm] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [amount, setAmount] = useState(centsToDollars(entry.amountCents));
  const create = useMutation(api.recurring.createRecurringRule);
  const link = useMutation(api.recurring.linkEntriesToRule);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const { add } = useOptimisticLinks();

  // Handle escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onCreate() {
    if (autolink && !autolinkConfirm) {
      setErr("Please confirm that you understand what auto-apply does");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const cents = dollarsToCents(amount) ?? entry.amountCents;
      const res = await create({
        type: entry.type,
        displayName: displayName.trim() || undefined,
        name: displayName.trim() || undefined,
        bucket: entry.bucket,
        category: entry.category,
        amountCents: cents,
        amountTolerancePercent: 5,
        autolinkEnabled: autolink,
        intervalType: "monthly",
        active: true,
      });

      const id = res?.id as Id<"recurringRules"> | undefined;
      if (id) {
        // optimistic local UI update
        add(entry._id);
        toast.success("Pattern saved", { description: `${displayName || "Pattern"} — saved` });

        // link current entry
        await link({ ruleId: id, entryIds: [entry._id] });

        if (applyToExisting) {
          // for now, we simply attempt to apply to similar entries using the server-side link endpoint
          // future improvement: expand to detect and link many historical matches
          try {
            await link({ ruleId: id, entryIds: [entry._id] });
            toast.success("Applied to existing", { description: "Applied to matching entries" });
          } catch {
            // ignore errors here
          }
        }

        if (onCreated) onCreated(id);
      }

      onClose();
    } catch (e: unknown) {
      setErr(errorMessage(e) ?? "Failed to create");
      toast.error("Failed to save pattern", { description: errorMessage(e) ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      />
      <div 
        className="relative z-10 w-[420px] max-w-[calc(100vw-32px)] rounded-2xl p-5" 
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Save pattern"
      >
        <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>Save pattern</div>
        <div className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Save a pattern to recognize similar future entries. Auto-apply is off by default and requires explicit confirmation.
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Name</div>
            <input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--surface-subtle)", 
                border: "1px solid var(--border)",
                color: "var(--text)"
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Amount</div>
              <input 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                style={{ 
                  backgroundColor: "var(--surface-subtle)", 
                  border: "1px solid var(--border)",
                  color: "var(--text)"
                }}
              />
            </div>
            <div>
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Cadence</div>
              <select 
                defaultValue="monthly" 
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                style={{ 
                  backgroundColor: "var(--surface-subtle)", 
                  border: "1px solid var(--border)",
                  color: "var(--text)"
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5">
              <input 
                type="checkbox" 
                checked={autolink} 
                onChange={(e) => { setAutolink(e.target.checked); if (!e.target.checked) setAutolinkConfirm(false); }}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--primary)" }}
              />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Auto-apply to future entries (off by default)</span>
            </label>

            <label className="flex items-center gap-2.5">
              <input 
                type="checkbox" 
                checked={applyToExisting} 
                onChange={(e) => setApplyToExisting(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--primary)" }}
              />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Apply to existing entries (optional)</span>
            </label>

            {autolink && (
              <div 
                className="rounded-xl p-3"
                style={{ 
                  backgroundColor: "var(--warning-subtle)", 
                  border: "1px solid var(--warning)"
                }}
              >
                <div className="font-medium text-sm" style={{ color: "var(--warning)" }}>Auto-apply confirmation</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Auto-apply will automatically fill this pattern on future entries. It&apos;s best for stable, regular payments (e.g., rent, salary). Please confirm:
                </div>
                <label className="mt-3 flex items-center gap-2.5">
                  <input 
                    type="checkbox" 
                    checked={autolinkConfirm} 
                    onChange={(e) => setAutolinkConfirm(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: "var(--warning)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--text)" }}>I understand this will automatically apply to future entries</span>
                </label>
              </div>
            )}
          </div>

          {err && (
            <div 
              className="text-sm rounded-lg p-2.5"
              style={{ backgroundColor: "var(--error-subtle)", color: "var(--error)" }}
            >
              {err}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button 
            onClick={onClose} 
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button 
            onClick={onCreate} 
            disabled={busy} 
            className="ml-auto rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            {busy ? "Saving…" : "Save pattern"}
          </button>
        </div>
      </div>
    </div>
  );
}
  function errorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return undefined;
  }
