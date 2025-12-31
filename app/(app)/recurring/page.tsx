"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import TimeRangeControl from "@/components/TimeRangeControl";
import TimeRangeBadge from "@/components/TimeRangeBadge";
import { useTimeRange } from "@/components/TimeRangeProvider";
import { toQueryArgs } from "@/src/lib/timeRange/toQueryArgs";
import { useTabs } from "@/components/PersistentTabs";
import { useToast } from "@/components/ToastProvider";
import { formatMoney, centsToDollars } from "@/components/utils";

/**
 * Recurring Page - Elevated to top-level navigation
 * 
 * New Creation Flow:
 * 1. User selects an existing transaction
 * 2. Converts it into a recurring item
 * 3. System infers range, frequency, variance
 * 4. User confirms or edits
 * 
 * No blank recurring creation - always transaction-based
 */

interface Entry {
  _id: string;
  type: "expense" | "income";
  category?: string;
  bucket?: string;
  note?: string;
  amountCents: number;
  date: number;
  merchant?: string;
  needsReview?: boolean;
}

export default function RecurringPage() {
  const { setActiveTab } = useTabs();
  const toast = useToast();
  const { resolvedRange } = useTimeRange();
  const { fromMs, toMs } = toQueryArgs(resolvedRange);
  const rules = useQuery((api as any).recurring.listRecurringRules as any) as any[] | undefined;
  const updateRule = useMutation((api as any).recurring.updateRecurringRule as any);
  const createRule = useMutation((api as any).recurring.createRecurringRule as any);

  // Recent entries for transaction-based creation
  const recentEntries = useQuery(api.entries.listEntries, { 
    startDate: fromMs,
    endDate: toMs,
    limit: 200,
  }) as Entry[] | undefined;

  // Edit modal state
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editAutolink, setEditAutolink] = useState(false);
  const [saving, setSaving] = useState(false);

  // Transaction-based creation state
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"select" | "configure">("select");
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Inferred/editable fields
  const [createName, setCreateName] = useState("");
  const [createCadence, setCreateCadence] = useState<"weekly" | "biweekly" | "monthly" | "yearly">("monthly");
  const [createAutolink, setCreateAutolink] = useState(true);
  const [creating, setCreating] = useState(false);

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

  // Filter entries for selection
  const filteredEntries = useMemo(() => {
    if (!recentEntries) return [];
    if (!searchQuery.trim()) return recentEntries;
    
    const q = searchQuery.toLowerCase();
    return recentEntries.filter((e) => {
      const name = (e.category || e.bucket || e.merchant || e.note || "").toLowerCase();
      return name.includes(q);
    });
  }, [recentEntries, searchQuery]);

  // Group entries by name for frequency detection
  const entrySuggestions = useMemo(() => {
    if (!recentEntries) return [];
    
    const groups = new Map<string, Entry[]>();
    for (const entry of recentEntries) {
      const key = (entry.category || entry.bucket || entry.merchant || "").toLowerCase().trim();
      if (!key) continue;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }
    
    // Return groups with 2+ entries (likely recurring)
    return [...groups.entries()]
      .filter(([, entries]) => entries.length >= 2)
      .map(([key, entries]) => ({
        name: entries[0].category || entries[0].bucket || entries[0].merchant || key,
        entries,
        type: entries[0].type,
        avgAmount: Math.round(entries.reduce((sum, e) => sum + e.amountCents, 0) / entries.length),
        count: entries.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [recentEntries]);

  function handleSelectEntry(entry: Entry) {
    setSelectedEntry(entry);
    setCreateName(entry.category || entry.bucket || entry.merchant || entry.note || "");
    setCreateStep("configure");
  }

  function handleSelectSuggestion(suggestion: typeof entrySuggestions[0]) {
    const entry = suggestion.entries[0];
    setSelectedEntry(entry);
    setCreateName(suggestion.name);
    
    // Infer cadence from dates
    if (suggestion.entries.length >= 2) {
      const sorted = [...suggestion.entries].sort((a, b) => b.date - a.date);
      const avgDays = (sorted[0].date - sorted[sorted.length - 1].date) / (sorted.length - 1) / (24 * 60 * 60 * 1000);
      
      if (avgDays <= 10) setCreateCadence("weekly");
      else if (avgDays <= 20) setCreateCadence("biweekly");
      else if (avgDays <= 45) setCreateCadence("monthly");
      else setCreateCadence("yearly");
    }
    
    setCreateStep("configure");
  }

  async function handleCreate() {
    if (!selectedEntry || !createName.trim()) {
      toast.error("Please select a transaction and provide a name");
      return;
    }
    
    setCreating(true);
    try {
      await createRule({
        displayName: createName.trim(),
        type: selectedEntry.type,
        category: selectedEntry.category || selectedEntry.bucket || undefined,
        cadenceType: createCadence,
        amountCents: selectedEntry.amountCents,
        autolinkEnabled: createAutolink,
        active: true,
        confidence: 80, // User-confirmed
      });
      toast.success("Pattern created");
      resetCreate();
    } catch (e: any) {
      toast.error("Failed to create", { description: e?.message });
    } finally {
      setCreating(false);
    }
  }

  function resetCreate() {
    setShowCreate(false);
    setCreateStep("select");
    setSelectedEntry(null);
    setSearchQuery("");
    setCreateName("");
    setCreateCadence("monthly");
    setCreateAutolink(true);
  }

  return (
    <div>
      <PageHeader
        title="Patterns"
        subtitle="Saved patterns you've confirmed"
        rightSlot={
          <div className="flex items-center gap-2">
            <TimeRangeBadge />
            <TimeRangeControl />
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--on-primary)",
              }}
            >
              <Lucide.Plus className="h-4 w-4" />
              Add
            </button>
          </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {r.displayName ?? r.name ?? r.category ?? "Unnamed"}
                    </span>
                    {/* Confidence indicator */}
                    {r.confidence !== undefined && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: r.confidence >= 80
                            ? "var(--success-subtle)"
                            : r.confidence >= 50
                            ? "var(--warning-subtle)"
                            : "var(--surface-2)",
                          color: r.confidence >= 80
                            ? "var(--success)"
                            : r.confidence >= 50
                            ? "var(--warning)"
                            : "var(--text-tertiary)",
                        }}
                      >
                        {r.confidence}% match
                      </span>
                    )}
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
              {/* Confidence display */}
              {editingRule.confidence !== undefined && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{
                    backgroundColor: editingRule.confidence >= 80
                      ? "var(--success-subtle)"
                      : editingRule.confidence >= 50
                      ? "var(--warning-subtle)"
                      : "var(--surface-2)",
                  }}
                >
                  <Lucide.BarChart2 className="h-4 w-4" style={{
                    color: editingRule.confidence >= 80
                      ? "var(--success)"
                      : editingRule.confidence >= 50
                      ? "var(--warning)"
                      : "var(--text-tertiary)",
                  }} />
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{
                      color: editingRule.confidence >= 80
                        ? "var(--success)"
                        : editingRule.confidence >= 50
                        ? "var(--warning)"
                        : "var(--text-secondary)",
                    }}>
                      {editingRule.confidence}% confidence
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {editingRule.confidence >= 80
                        ? "Strong pattern match"
                        : editingRule.confidence >= 50
                        ? "Moderate pattern match"
                        : "Weak pattern - review recommended"}
                    </div>
                  </div>
                </div>
              )}

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

      {/* Create Pattern Modal - Transaction-Based Flow */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={resetCreate}
          />
          <div
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {createStep === "configure" && (
                  <button 
                    onClick={() => { setCreateStep("select"); setSelectedEntry(null); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
                  >
                    <Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                  </button>
                )}
                <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  {createStep === "select" ? "Create from Transaction" : "Configure Pattern"}
                </h3>
              </div>
              <button
                onClick={resetCreate}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
              >
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>

            {createStep === "select" ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Suggested patterns (entries with 2+ occurrences) */}
                {entrySuggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
                      Likely Recurring
                    </div>
                    <div className="space-y-2">
                      {entrySuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectSuggestion(s)}
                          className="w-full text-left rounded-xl p-3 transition-colors hover:bg-[var(--surface-subtle)]"
                          style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{ backgroundColor: s.type === "income" ? "var(--success-subtle)" : "var(--accent-subtle)" }}
                            >
                              <Lucide.RefreshCw className="h-4 w-4" style={{ color: s.type === "income" ? "var(--success)" : "var(--primary)" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                                {s.name}
                              </div>
                              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                {s.count} transactions · ~{formatMoney(s.avgAmount)}
                              </div>
                            </div>
                            <Lucide.ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search for transactions */}
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
                    Or select a transaction
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <Lucide.Search className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search transactions…"
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "var(--text)" }}
                    />
                  </div>
                  
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {filteredEntries.slice(0, 15).map((entry) => (
                      <button
                        key={entry._id}
                        onClick={() => handleSelectEntry(entry)}
                        className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                              {entry.category || entry.bucket || entry.merchant || entry.note || "Unnamed"}
                            </div>
                            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                              {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                          <div
                            className="text-sm font-medium tabular-nums"
                            style={{ color: entry.type === "income" ? "var(--success)" : "var(--text)" }}
                          >
                            {entry.type === "income" ? "+" : "-"}{formatMoney(entry.amountCents)}
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredEntries.length === 0 && (
                      <div className="text-center py-4">
                        <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                          No transactions found
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected transaction preview */}
                {selectedEntry && (
                  <div
                    className="rounded-xl p-3"
                    style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: selectedEntry.type === "income" ? "var(--success-subtle)" : "var(--accent-subtle)" }}
                      >
                        <Lucide.RefreshCw className="h-5 w-5" style={{ color: selectedEntry.type === "income" ? "var(--success)" : "var(--primary)" }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Creating pattern from</div>
                        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                          {selectedEntry.category || selectedEntry.bucket || selectedEntry.merchant || "Transaction"}
                        </div>
                      </div>
                      <div className="text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
                        {formatMoney(selectedEntry.amountCents)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pattern name */}
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-tertiary)" }}>
                    Pattern Name
                  </label>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g., Netflix, Rent, Salary"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--surface-subtle)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                {/* Cadence */}
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-tertiary)" }}>
                    Frequency
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["weekly", "biweekly", "monthly", "yearly"] as const).map((cadence) => (
                      <button
                        key={cadence}
                        onClick={() => setCreateCadence(cadence)}
                        className="rounded-lg py-2 text-xs font-medium capitalize"
                        style={{
                          backgroundColor: createCadence === cadence ? "var(--accent-subtle)" : "transparent",
                          border: `1px solid ${createCadence === cadence ? "var(--primary)" : "var(--border)"}`,
                          color: createCadence === cadence ? "var(--primary)" : "var(--text)",
                        }}
                      >
                        {cadence}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-link toggle */}
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={createAutolink}
                    onChange={(e) => setCreateAutolink(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    Auto-apply to matching transactions
                  </span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={resetCreate}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !createName.trim()}
                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                  >
                    {creating ? "Creating…" : "Create Pattern"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
