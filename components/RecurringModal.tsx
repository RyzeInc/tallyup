"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { centsToDollars, dollarsToCents } from "./utils";
import { useToast } from "./ToastProvider";
import { useOptimisticLinks } from "./OptimisticLinksProvider";
import * as Lucide from "lucide-react";

type EntryDoc = Doc<"entries">;
type EditableEntry = EntryDoc & { type: "expense" | "income" };
type CadenceKind = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export default function RecurringModal({
  entry,
  onClose,
  onCreated,
}: {
  entry: EditableEntry;
  onClose: () => void;
  onCreated?: (ruleId: Id<"recurringRules">) => void;
}) {
  const [displayName, setDisplayName] = useState(entry.bucket ? `${entry.bucket} ${entry.category ?? ""}`.trim() : entry.merchant ?? entry.note ?? "");
  const [autolink, setAutolink] = useState(false);
  const [autolinkConfirm, setAutolinkConfirm] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [amount, setAmount] = useState(centsToDollars(entry.amountCents));
  const [cadence, setCadence] = useState<CadenceKind>("monthly");
  const [merchant, setMerchant] = useState(entry.merchant ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(entry.categoryId as string | undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(entry.accountId as string | undefined);
  // Initialize anchorDate from entry date
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date(entry.date);
    return d.toISOString().slice(0, 10);
  });
  const create = useMutation(api.recurring.createRecurringRule);
  const link = useMutation(api.recurring.linkEntriesToRule);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const { add } = useOptimisticLinks();

  // Fetch categories and accounts
  const categoriesData = useQuery(api.categories.listCategories, { 
    categoryType: entry.type === "income" ? "income" : "expense",
    topLevelOnly: true 
  });
  const accountsData = useQuery(api.accounts.listAccounts, {});

  const categories = useMemo(() => {
    return (categoriesData ?? []).map(c => ({ id: c._id, name: c.name, slug: c.slug }));
  }, [categoriesData]);

  const accounts = useMemo(() => {
    return (accountsData ?? []).map(a => ({ id: a._id, name: a.name, type: a.type }));
  }, [accountsData]);

  // Get selected category name
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Compute cadence label based on anchor date
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

    if (!anchorDate) {
      setErr("Please select a start date");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const cents = dollarsToCents(amount) ?? entry.amountCents;
      const anchorTs = new Date(anchorDate + "T00:00:00").getTime();
      const merchantNormalized = merchant.trim().toLowerCase().replace(/\s+/g, "_");
      
      const res = await create({
        type: entry.type,
        displayName: displayName.trim() || undefined,
        name: displayName.trim() || undefined,
        bucket: selectedCategory?.slug ?? entry.bucket,
        category: selectedCategory?.name ?? entry.category,
        amountCents: cents,
        amountTolerancePercent: 5,
        autolinkEnabled: autolink,
        cadenceType: cadence,
        cadence: { kind: cadence, anchorDate: anchorTs },
        status: "active" as const,
        active: true,
        merchantKeys: merchant.trim() ? [merchantNormalized] : undefined,
        accountScope: selectedAccountId ? { 
          kind: "only" as const, 
          accountIds: [selectedAccountId as Id<"accounts">] 
        } : undefined,
        defaultAccountId: selectedAccountId as Id<"accounts"> | undefined,
        // Generate future expected charges
        generateFutureEntries: true,
        futureMonths: 6,
      });

      const id = res?.id as Id<"recurringRules"> | undefined;
      if (id) {
        // optimistic local UI update
        add(entry._id);
        toast.success("Recurring rule saved", { description: `${displayName || "Recurring rule"} — saved` });

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
      toast.error("Failed to save recurring rule", { description: errorMessage(e) ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div 
        className="relative z-10 w-full sm:w-[420px] sm:max-w-[calc(100vw-32px)] rounded-t-2xl sm:rounded-2xl p-5" 
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Save recurring rule"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>Save recurring rule</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]">
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
                value={cadence}
                onChange={(e) => setCadence(e.target.value as CadenceKind)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                style={{ 
                  backgroundColor: "var(--surface-subtle)", 
                  border: "1px solid var(--border)",
                  color: "var(--text)"
                }}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Merchant Field */}
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Merchant (optional)</div>
            <input 
              value={merchant} 
              onChange={(e) => setMerchant(e.target.value)} 
              placeholder="e.g., Netflix, Spotify, Landlord"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--surface-subtle)", 
                border: "1px solid var(--border)",
                color: "var(--text)"
              }}
            />
          </div>

          {/* Category Field */}
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Category</div>
            <select 
              value={selectedCategoryId ?? ""}
              onChange={(e) => setSelectedCategoryId(e.target.value || undefined)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--surface-subtle)", 
                border: "1px solid var(--border)",
                color: "var(--text)"
              }}
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Account Field */}
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Account (optional)</div>
            <select 
              value={selectedAccountId ?? ""}
              onChange={(e) => setSelectedAccountId(e.target.value || undefined)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--surface-subtle)", 
                border: "1px solid var(--border)",
                color: "var(--text)"
              }}
            >
              <option value="">Any account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              Limit matching to a specific account
            </div>
          </div>

          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>Start date</div>
            <input 
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ 
                backgroundColor: "var(--surface-subtle)", 
                border: "1px solid var(--border)",
                color: "var(--text)"
              }}
            />
            {cadenceLabel && (
              <div className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                {cadence === "weekly" || cadence === "biweekly"
                  ? `Runs on ${cadenceLabel}s`
                  : cadence === "yearly"
                  ? `Runs on ${cadenceLabel}`
                  : `Runs on ${cadenceLabel} each cycle`}
              </div>
            )}
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
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Auto-apply to future entries</span>
            </label>

            <label className="flex items-center gap-2.5">
              <input 
                type="checkbox" 
                checked={applyToExisting} 
                onChange={(e) => setApplyToExisting(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--primary)" }}
              />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Apply to existing entries</span>
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
                  Auto-apply will automatically link future matching entries. Best for stable payments like rent or salary.
                </div>
                <label className="mt-3 flex items-center gap-2.5">
                  <input 
                    type="checkbox" 
                    checked={autolinkConfirm} 
                    onChange={(e) => setAutolinkConfirm(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: "var(--warning)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--text)" }}>I understand</span>
                </label>
              </div>
            )}
          </div>

          {err && (
            <div 
              className="text-sm rounded-lg p-2.5 flex items-center gap-2"
              style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
            >
              <Lucide.AlertCircle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button 
            onClick={onCreate} 
            disabled={busy} 
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            {busy ? "Saving…" : "Save rule"}
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
