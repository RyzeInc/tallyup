"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import {
  centsToDollars,
  dollarsToCents,
  INCOME_SPACES,
  EXPENSE_SPACES,
} from "@/components/utils";
import { 
  CONTEXT_TAGS, 
  INTENT_TAGS, 
  type ContextTag, 
  type IntentTag 
} from "@/lib/constants";
import { useToast } from "@/components/ToastProvider";

interface Entry {
  _id: string;
  type: "expense" | "income";
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  note?: string;
  merchant?: string;
  tags?: string[];
  methodOrAccount?: string;
  needsReview?: boolean;
  // Phase 1: New fields
  goalId?: Id<"goals">;
  budgetCategoryId?: Id<"budgetCategories">;
  recurringRuleId?: Id<"recurringRules">;
  contextTags?: string[];
  intentTag?: string;
  // Gig worker fields
  hoursWorked?: number;
  platformType?: string;
  // Scoped ignore options
  excludeFromTotals?: boolean;
  excludeFromBudgets?: boolean;
  excludeFromCashFlow?: boolean;
}

interface EditEntryModalProps {
  entry: Entry;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export default function EditEntryModal({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: EditEntryModalProps) {
  const toast = useToast();
  const updateEntry = useMutation(api.entries.updateEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  // Fetch goals and budgets for linking
  const goals = useQuery(api.goals.listGoals, {});
  const budgetCategories = useQuery(api.budgets.listBudgetCategories, {});
  const recurringRules = useQuery(api.recurring.listRecurringRules, {});

  // Form state
  const [type, setType] = useState<"expense" | "income">(entry.type);
  const [amountStr, setAmountStr] = useState(() =>
    (Math.abs(entry.amountCents) / 100).toFixed(2)
  );
  const [date, setDate] = useState(() => {
    const d = new Date(entry.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [category, setCategory] = useState(entry.category ?? entry.bucket ?? "");
  const [note, setNote] = useState(entry.note ?? "");
  const [merchant, setMerchant] = useState(entry.merchant ?? "");
  const [methodOrAccount, setMethodOrAccount] = useState(entry.methodOrAccount ?? "");
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [needsReview, setNeedsReview] = useState(entry.needsReview ?? false);

  // Phase 1: New form fields
  const [contextTags, setContextTags] = useState<string[]>(entry.contextTags ?? []);
  const [intentTag, setIntentTag] = useState<string | null>(entry.intentTag ?? null);
  const [goalId, setGoalId] = useState<Id<"goals"> | null>(entry.goalId ?? null);
  const [budgetCategoryId, setBudgetCategoryId] = useState<Id<"budgetCategories"> | null>(
    entry.budgetCategoryId ?? null
  );
  const [recurringRuleId, setRecurringRuleId] = useState<Id<"recurringRules"> | null>(
    entry.recurringRuleId ?? null
  );

  // Scoped ignore options
  const [excludeFromTotals, setExcludeFromTotals] = useState(entry.excludeFromTotals ?? false);
  const [excludeFromBudgets, setExcludeFromBudgets] = useState(entry.excludeFromBudgets ?? false);
  const [excludeFromCashFlow, setExcludeFromCashFlow] = useState(entry.excludeFromCashFlow ?? false);

  // Gig worker fields
  const [hoursWorked, setHoursWorked] = useState<string>(entry.hoursWorked?.toString() ?? "");
  const [platformType, setPlatformType] = useState(entry.platformType ?? "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category options based on type
  const categoryOptions = useMemo(() => {
    return type === "income" ? [...INCOME_SPACES] : [...EXPENSE_SPACES];
  }, [type]);

  // Compute original values for dirty detection
  const originalValues = useMemo(() => {
    const d = new Date(entry.date);
    return {
      type: entry.type,
      amountStr: (Math.abs(entry.amountCents) / 100).toFixed(2),
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      category: entry.category ?? entry.bucket ?? "",
      note: entry.note ?? "",
      merchant: entry.merchant ?? "",
      methodOrAccount: entry.methodOrAccount ?? "",
      tags: entry.tags ?? [],
      needsReview: entry.needsReview ?? false,
      contextTags: entry.contextTags ?? [],
      intentTag: entry.intentTag ?? null,
      goalId: entry.goalId ?? null,
      budgetCategoryId: entry.budgetCategoryId ?? null,
      recurringRuleId: entry.recurringRuleId ?? null,
      excludeFromTotals: entry.excludeFromTotals ?? false,
      excludeFromBudgets: entry.excludeFromBudgets ?? false,
      excludeFromCashFlow: entry.excludeFromCashFlow ?? false,
    };
  }, [entry]);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (type !== originalValues.type) return true;
    if (amountStr !== originalValues.amountStr) return true;
    if (date !== originalValues.date) return true;
    if (category !== originalValues.category) return true;
    if (note !== originalValues.note) return true;
    if (merchant !== originalValues.merchant) return true;
    if (methodOrAccount !== originalValues.methodOrAccount) return true;
    if (needsReview !== originalValues.needsReview) return true;
    if (intentTag !== originalValues.intentTag) return true;
    if (goalId !== originalValues.goalId) return true;
    if (budgetCategoryId !== originalValues.budgetCategoryId) return true;
    if (recurringRuleId !== originalValues.recurringRuleId) return true;
    if (excludeFromTotals !== originalValues.excludeFromTotals) return true;
    if (excludeFromBudgets !== originalValues.excludeFromBudgets) return true;
    if (excludeFromCashFlow !== originalValues.excludeFromCashFlow) return true;
    // Array comparison for tags
    if (JSON.stringify(tags.sort()) !== JSON.stringify([...originalValues.tags].sort())) return true;
    if (JSON.stringify(contextTags.sort()) !== JSON.stringify([...originalValues.contextTags].sort())) return true;
    return false;
  }, [
    type, amountStr, date, category, note, methodOrAccount, tags, needsReview,
    contextTags, intentTag, goalId, budgetCategoryId, recurringRuleId,
    excludeFromTotals, excludeFromBudgets, excludeFromCashFlow, originalValues
  ]);

  // Validation
  const isValid = useMemo(() => {
    const cents = dollarsToCents(amountStr);
    if (!cents || cents <= 0) return false;
    if (!date) return false;
    return true;
  }, [amountStr, date]);

  // Handle close with dirty check
  const handleCloseAttempt = useCallback(() => {
    if (isDirty) {
      if (confirm("You have unsaved changes. Discard them?")) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Handle escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseAttempt();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCloseAttempt]);

  async function handleSave() {
    setError(null);
    setSaving(true);

    try {
      const amountCents = dollarsToCents(amountStr);
      if (!amountCents || amountCents <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const [y, m, d] = date.split("-").map(Number);
      const dateTs = new Date(y, m - 1, d).getTime();

      await updateEntry({
        id: entry._id as Id<"entries">,
        category: category || undefined,
        amountCents,
        date: dateTs,
        note: note.trim() || undefined,
        merchant: merchant.trim() || undefined,
        methodOrAccount: methodOrAccount.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        needsReview,
        // Phase 1: New fields
        contextTags: contextTags.length > 0 ? contextTags : [],
        intentTag: intentTag || null,
        goalId: goalId || null,
        budgetCategoryId: budgetCategoryId || null,
        recurringRuleId: recurringRuleId || null,
        // Gig worker fields
        hoursWorked: hoursWorked ? parseFloat(hoursWorked) : undefined,
        platformType: platformType || undefined,
      });

      toast.success("Entry updated");
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setError(message);
      // Keep modal open on error - don't show toast, error is inline
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await deleteEntry({ id: entry._id as Id<"entries"> });
      toast.success("Entry deleted");
      onDeleted?.();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
      toast.error("Failed to delete", { description: message });
    } finally {
      setDeleting(false);
    }
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function toggleContextTag(tag: ContextTag) {
    setContextTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function cycleIntentTag(tag: IntentTag) {
    setIntentTag((prev) => (prev === tag ? null : tag));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCloseAttempt}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit transaction"
        className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
      >
        <div
          className="rounded-2xl shadow-xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            maxHeight: "min(700px, 90vh)",
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-5 py-4 border-b shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              Edit Transaction
            </h2>
            <div className="flex items-center gap-2">
              {isDirty && (
                <span 
                  className="text-xs px-2 py-0.5 rounded-full" 
                  style={{ 
                    backgroundColor: "var(--warning-subtle)", 
                    color: "var(--warning)" 
                  }}
                >
                  Unsaved
                </span>
              )}
              <button
                onClick={handleCloseAttempt}
                className="rounded-full p-1.5 transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto px-5 py-4 flex-1">

          {/* Error message */}
          {error && (
            <div
              className="mb-4 rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}

          {/* Type toggle */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                type === "expense"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border hover:bg-[var(--surface-subtle)]"
              }`}
              style={{
                borderColor: type === "expense" ? undefined : "var(--border)",
                color: type === "expense" ? undefined : "var(--text)",
              }}
            >
              Spent
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                type === "income"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border hover:bg-[var(--surface-subtle)]"
              }`}
              style={{
                borderColor: type === "income" ? undefined : "var(--border)",
                color: type === "income" ? undefined : "var(--text)",
              }}
            >
              Received
            </button>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Amount
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full rounded-lg border px-3 py-3 pl-8 text-lg font-semibold tabular-nums"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--input)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--input)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--input)",
                color: "var(--text)",
              }}
            >
              <option value="">Select category...</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Context Tags (multi-select) */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Context (who/what)
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map((tag) => {
                const selected = contextTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleContextTag(tag as ContextTag)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-[var(--success-subtle)] text-[var(--success)]"
                        : "hover:bg-[var(--surface-subtle)]"
                    }`}
                    style={{
                      border: `1px solid ${selected ? "var(--success)" : "var(--border)"}`,
                      color: selected ? undefined : "var(--text)",
                    }}
                  >
                    {selected && <span className="mr-1">✓</span>}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intent Tag (single-select) */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Intent (why)
            </label>
            <div className="flex flex-wrap gap-2">
              {INTENT_TAGS.map((tag) => {
                const selected = intentTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => cycleIntentTag(tag as IntentTag)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--surface-subtle)]"
                    }`}
                    style={{
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      color: selected ? undefined : "var(--text)",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Associations section */}
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
            <label
              className="block text-xs font-medium mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Link to...
            </label>

            {/* Goal */}
            <div className="mb-3">
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                Goal
              </label>
              <select
                value={goalId ?? ""}
                onChange={(e) => setGoalId(e.target.value ? e.target.value as Id<"goals"> : null)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--input)",
                  color: "var(--text)",
                }}
              >
                <option value="">None</option>
                {goals?.map((goal) => (
                  <option key={goal._id} value={goal._id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget */}
            {type === "expense" && (
              <div className="mb-3">
                <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Budget Category
                </label>
                <select
                  value={budgetCategoryId ?? ""}
                  onChange={(e) => setBudgetCategoryId(e.target.value ? e.target.value as Id<"budgetCategories"> : null)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--input)",
                    color: "var(--text)",
                  }}
                >
                  <option value="">None</option>
                  {budgetCategories?.map((bc) => (
                    <option key={bc._id} value={bc._id}>
                      {bc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recurring */}
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                Recurring Series
              </label>
              <select
                value={recurringRuleId ?? ""}
                onChange={(e) => setRecurringRuleId(e.target.value ? e.target.value as Id<"recurringRules"> : null)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--input)",
                  color: "var(--text)",
                }}
              >
                <option value="">None</option>
                {recurringRules?.filter(r => r.type === type).map((rule) => (
                  <option key={rule._id} value={rule._id}>
                    {rule.displayName || rule.name || rule.category || "Unnamed"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Legacy Tags */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {["Essential", "Planned", "Unexpected", "Splurge"].map((tag) => {
                const selected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--surface-subtle)]"
                    }`}
                    style={{
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      color: selected ? undefined : "var(--text)",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional description..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--input)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Method/Account */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Merchant / Payee
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g., Amazon, Starbucks..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--input)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Payment Method / Account */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Payment Method / Account
            </label>
            <input
              type="text"
              value={methodOrAccount}
              onChange={(e) => setMethodOrAccount(e.target.value)}
              placeholder="e.g., Chase Visa, Cash..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--input)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Gig Worker Fields - Only for income */}
          {type === "income" && (
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Lucide.Clock className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Gig / Hourly Work
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Hours Worked
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    placeholder="0.0"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface)",
                      color: "var(--text)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                    Platform Type
                  </label>
                  <select
                    value={platformType}
                    onChange={(e) => setPlatformType(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="rideshare">Rideshare</option>
                    <option value="delivery">Delivery</option>
                    <option value="freelance">Freelance</option>
                    <option value="consulting">Consulting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              {hoursWorked && parseFloat(hoursWorked) > 0 && (
                <div className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Hourly rate: ${(parseFloat(amountStr) / parseFloat(hoursWorked)).toFixed(2)}/hr
                </div>
              )}
            </div>
          )}

          {/* Needs Review toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={needsReview}
                onChange={(e) => setNeedsReview(e.target.checked)}
                className="h-4 w-4 rounded"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Flag for review
              </span>
            </label>
          </div>
          </div>

          {/* Fixed Footer Actions */}
          <div 
            className="flex items-center gap-3 px-5 py-4 border-t shrink-0"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                backgroundColor: "transparent",
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleCloseAttempt}
              disabled={saving || deleting}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting || !isDirty || !isValid}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
