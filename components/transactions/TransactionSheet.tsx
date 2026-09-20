"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import {
  centsToDollars,
  dollarsToCents,
  todayYYYYMMDD,
  yyyymmddToLocalMidnightTs,
  INCOME_SPACES,
  EXPENSE_SPACES,
} from "@/components/utils";
import { CONTEXT_TAGS, INTENT_TAGS, getReviewReason } from "@/lib/constants";
import { useToast } from "@/components/ToastProvider";
import DeletionWarningDialog, { buildEntryDeletionImpact, RecurringEntryDeleteDialog, type DeleteScope } from "@/components/shared/DeletionWarningDialog";

type TransactionMode = "new" | "edit";
type TransactionType = "expense" | "income" | "transfer";

interface TransactionEntry {
  _id: Id<"entries">;
  type: TransactionType;
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  note?: string;
  merchant?: string;
  methodOrAccount?: string;
  accountId?: Id<"accounts">;
  contextTags?: string[];
  intentTags?: string[];
  transferId?: Id<"transfers">;
  isTransferSource?: boolean;
  reviewReason?: string;
  needsReview?: boolean;
  createdAt?: number;
}

export default function TransactionSheet({
  open = true,
  mode = "new",
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  open?: boolean;
  mode?: TransactionMode;
  entry?: TransactionEntry | null;
  onClose: () => void;
  onSaved?: (id?: string) => void;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const isEdit = mode === "edit";

  const addEntry = useMutation(api.entries.addEntry);
  const updateEntry = useMutation(api.entries.updateEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);
  const createTransfer = useMutation(api.transfers.createTransfer);
  const logEvent = useMutation(api.analytics.logEvent);
  const accounts = useQuery(api.accounts.listAccounts, {}) as Doc<"accounts">[] | undefined;
  const recentEntries = useQuery(api.entries.listEntries, { limit: 80 }) as
    | Doc<"entries">[]
    | undefined;
  
  // Query deletion impact when in edit mode
  const entryDeletionImpact = useQuery(
    api.entries.getEntryDeletionImpact,
    entry ? { id: entry._id } : "skip"
  );
  
  // Fetch user preferences for hidden categories/tags
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});
  
  // Get filtered context tags based on user preferences
  const filteredContextTags = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenContextTags ?? []).map(t => t.toLowerCase()));
    return CONTEXT_TAGS.filter(tag => !hiddenSet.has(tag.toLowerCase()));
  }, [userPrefs?.hiddenContextTags]);
  
  // Get filtered expense/income categories
  const filteredExpenseCategories = useMemo(() => {
    const hiddenSet = new Set(userPrefs?.hiddenExpenseCategories ?? []);
    return EXPENSE_SPACES.filter(cat => !hiddenSet.has(cat));
  }, [userPrefs?.hiddenExpenseCategories]);
  
  const filteredIncomeCategories = useMemo(() => {
    const hiddenSet = new Set(userPrefs?.hiddenIncomeCategories ?? []);
    return INCOME_SPACES.filter(cat => !hiddenSet.has(cat));
  }, [userPrefs?.hiddenIncomeCategories]);

  const [type, setType] = useState<TransactionType>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(todayYYYYMMDD());
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [contextTags, setContextTags] = useState<string[]>([]);
  const [intentTags, setIntentTags] = useState<string[]>([]);
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [accountId, setAccountId] = useState<Id<"accounts"> | "">("");
  const [fromAccountId, setFromAccountId] = useState<Id<"accounts"> | "">("");
  const [toAccountId, setToAccountId] = useState<Id<"accounts"> | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const logStartRef = useRef<number | null>(null);
  const usedSuggestionRef = useRef(false);

  useEffect(() => {
    if (!entry) {
      setType("expense");
      setAmountStr("");
      setDate(todayYYYYMMDD());
      setTitle("");
      setNote("");
      setCategory("");
      setContextTags([]);
      setIntentTags([]);
      setMethodOrAccount("");
      setAccountId("");
      setFromAccountId("");
      setToAccountId("");
      return;
    }

    const d = new Date(entry.date);
    setType(entry.type);
    setAmountStr((Math.abs(entry.amountCents) / 100).toFixed(2));
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setTitle(entry.merchant ?? entry.note ?? "");
    setNote(entry.note ?? "");
    setCategory(entry.category ?? entry.bucket ?? "");
    setContextTags(entry.contextTags ?? []);
    setIntentTags(entry.intentTags ?? []);
    setMethodOrAccount(entry.methodOrAccount ?? "");
    setAccountId(entry.accountId ?? "");
  }, [entry]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    logStartRef.current = Date.now();
    usedSuggestionRef.current = false;
  }, [open]);

  const categoryOptions = useMemo(() => {
    const base = type === "income" ? filteredIncomeCategories : filteredExpenseCategories;
    return [...base];
  }, [type, filteredExpenseCategories, filteredIncomeCategories]);

  const categorySuggestions = useMemo(() => {
    const suggestions: string[] = [];
    const seen = new Set<string>();
    for (const entry of recentEntries ?? []) {
      if (entry.type !== type || !entry.category) continue;
      const cat = entry.category;
      const key = cat.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(cat);
      if (suggestions.length >= 5) break;
    }
    return suggestions;
  }, [recentEntries, type]);

  const accountOptions = useMemo(() => {
    return (accounts ?? []).map((acc) => ({ id: acc._id, name: acc.name }));
  }, [accounts]);

  const amountCents = dollarsToCents(amountStr);
  const reviewReason = type === "transfer" ? null : getReviewReason({
    category: category || null,
    contextTags,
    intentTags,
    amountCents: Math.abs(amountCents || 0),
    methodOrAccount,
    accountId,
  });
  const isResolved = !reviewReason;
  const headerLabel = isResolved ? "Reviewed" : "Needs meaning";

  const impactHint = useMemo(() => {
    if (!amountCents) return "";
    const amountText = `$${centsToDollars(Math.abs(amountCents))}`;
    if (type === "income") return `Net increases by ${amountText}`;
    if (type === "transfer") return "No net impact";
    return `Net decreases by ${amountText}`;
  }, [amountCents, type]);

  async function handleSave() {
    setError(null);

    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!date) {
      setError("Choose a date.");
      return;
    }

    setSaving(true);
    try {
      const dateTs = yyyymmddToLocalMidnightTs(date);
      const durationMs = logStartRef.current ? Date.now() - logStartRef.current : undefined;

      if (type === "transfer") {
        const transferRes = await createTransfer({
          amountCents: Math.abs(amountCents),
          date: dateTs,
          fromAccountId: fromAccountId || undefined,
          toAccountId: toAccountId || undefined,
          transferType: "internal",
          note: note.trim() || undefined,
        });
        toast.success("Saved: Transfer");
        try {
          await logEvent({
            event: "transfer_logged",
            data: {
              durationMs,
              amountCents: Math.abs(amountCents),
              hasFromAccount: Boolean(fromAccountId),
              hasToAccount: Boolean(toAccountId),
            },
          });
        } catch {}
        onSaved?.(transferRes.id);
        onClose();
        return;
      }

      if (isEdit && entry) {
        const wasUnresolved = Boolean(entry.reviewReason ?? entry.needsReview);
        await updateEntry({
          id: entry._id,
          category: category.trim() || undefined,
          amountCents: Math.abs(amountCents),
          date: dateTs,
          note: note.trim() || undefined,
          merchant: title.trim() || undefined,
          methodOrAccount: methodOrAccount.trim() || undefined,
          accountId: accountId || null,
          contextTags,
          intentTags,
          needsReview: !isResolved,
        });
        if (wasUnresolved && isResolved) {
          try {
            await logEvent({
              event: "review_resolved",
              data: {
                durationMs: entry.createdAt ? Date.now() - entry.createdAt : undefined,
                amountCents: Math.abs(amountCents),
                category: category.trim() || undefined,
                contextTags,
                intentTags,
              },
            });
          } catch {}
        }
        if (!isResolved) {
          toast.success(`Saved to Review: ${reviewReason?.replace("NEEDS_", "Needs ").toLowerCase()}`);
        } else {
          toast.success("Transaction updated");
        }
        try {
          await logEvent({
            event: "entry_updated",
            data: {
              durationMs,
              resolved: isResolved,
              reviewReason: reviewReason ?? null,
              amountCents: Math.abs(amountCents),
              type,
              usedCategorySuggestion: usedSuggestionRef.current,
            },
          });
        } catch {}
        onSaved?.(entry._id);
        onClose();
        return;
      }

      const res = await addEntry({
        type,
        category: category.trim() || undefined,
        note: note.trim() || undefined,
        merchant: title.trim() || undefined,
        methodOrAccount: methodOrAccount.trim() || undefined,
        amountCents: Math.abs(amountCents),
        date: dateTs,
        contextTags,
        intentTags,
        accountId: accountId || undefined,
        needsReview: !isResolved,
      });

      const recapParts = [
        type === "income" ? "Received" : "Spent",
        `$${centsToDollars(Math.abs(amountCents))}`,
      ];
      if (category) recapParts.push(category);
      if (contextTags[0]) recapParts.push(contextTags[0]);

      if (!isResolved) {
        toast.success(`Saved to Review: ${reviewReason?.replace("NEEDS_", "Needs ").toLowerCase()}`);
      } else {
        toast.success(`Saved: ${recapParts.join(" • ")}`);
      }
      try {
        await logEvent({
          event: "entry_logged",
          data: {
            durationMs,
            resolved: isResolved,
            reviewReason: reviewReason ?? null,
            amountCents: Math.abs(amountCents),
            type,
            category: category.trim() || undefined,
            contextTags,
            intentTags,
            usedCategorySuggestion: usedSuggestionRef.current,
          },
        });
      } catch {}

      onSaved?.(res.id);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    console.log("[TransactionSheet] Delete button clicked");
    // Show warning dialog if entry has relationships
    if (entryDeletionImpact && (
      entryDeletionImpact.hasRecurringRule ||
      entryDeletionImpact.hasGoal ||
      entryDeletionImpact.hasBudgetCategory ||
      entryDeletionImpact.hasTransferPair
    )) {
      setShowDeleteWarning(true);
      return;
    }
    await confirmDelete("this_only");
  }

  async function confirmDelete(scope: DeleteScope) {
    if (!entry) return;
    console.log("[TransactionSheet] Confirming delete for entry:", entry._id, "scope:", scope);
    setShowDeleteWarning(false);
    setSaving(true);
    try {
      await deleteEntry({ id: entry._id, deleteScope: scope });
      console.log("[TransactionSheet] Delete successful");
      const message = scope === "entire_series" 
        ? "Series deleted" 
        : scope === "this_and_future" 
        ? "Future transactions deleted" 
        : "Transaction deleted";
      toast.success(message);
      onDeleted?.();
      onClose();
    } catch (e: unknown) {
      console.error("[TransactionSheet] Delete failed:", e);
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  // Build entry title for the warning dialog
  const entryTitle = useMemo(() => {
    if (!entry) return "";
    const amount = `$${centsToDollars(entry.amountCents)}`;
    if (entry.merchant) return `${entry.merchant} - ${amount}`;
    if (entry.category) return `${entry.category} - ${amount}`;
    return `${amount} ${entry.type}`;
  }, [entry]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <div
          className="rounded-t-2xl sm:rounded-2xl border p-4 pb-20"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {headerLabel}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {new Date(yyyymmddToLocalMidnightTs(date)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-[var(--surface-subtle)]">
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>

          <div className="text-center mb-5">
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { key: "expense", label: "Spent" },
                { key: "income", label: "Received" },
                { key: "transfer", label: "Transfer" },
              ].map((opt) => {
                const active = type === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setType(opt.key as TransactionType)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{
                      backgroundColor: active ? "var(--accent)" : "var(--surface-2)",
                      color: active ? "var(--accent-foreground)" : "var(--text-secondary)",
                      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Merchant or title"
              className="w-full bg-transparent text-center text-lg font-semibold outline-none"
              style={{ color: "var(--text)" }}
            />
            <div className="mt-2">
              <input
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                ref={amountInputRef}
                className="w-full bg-transparent text-center text-2xl font-semibold outline-none tabular-nums"
                style={{ color: "var(--text)" }}
              />
            </div>
            {impactHint && (
              <div className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                {impactHint}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <div className="mb-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>

          <div className="mb-4">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add note"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>

          <div className="mb-5">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Category</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="transaction-category-list"
              placeholder="Choose category"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            <datalist id="transaction-category-list">
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {categorySuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {categorySuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setCategory(suggestion);
                      usedSuggestionRef.current = true;
                    }}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-5">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Context</div>
            <div className="flex flex-wrap gap-2">
              {filteredContextTags.map((tag) => {
                const selected = contextTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      setContextTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: selected ? "var(--success-subtle)" : "transparent",
                      color: selected ? "var(--success)" : "var(--text)",
                      border: `1px solid ${selected ? "var(--success)" : "var(--border)"}`,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Intent</div>
            <div className="flex flex-wrap gap-2">
              {INTENT_TAGS.filter((tag) => tag !== "Unknown").map((tag) => {
                const selected = intentTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      setIntentTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: selected ? "var(--accent-subtle)" : "transparent",
                      color: selected ? "var(--accent)" : "var(--text)",
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Account / Method</div>
            {type === "transfer" ? (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value as Id<"accounts">)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  <option value="">From</option>
                  {accountOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value as Id<"accounts">)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  <option value="">To</option>
                  {accountOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={accountId}
                  onChange={(e) => {
                    const value = e.target.value as Id<"accounts">;
                    setAccountId(value);
                    const match = accountOptions.find((acc) => acc.id === value);
                    if (match) setMethodOrAccount(match.name);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  <option value="">Select account</option>
                  {accountOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                <input
                  value={methodOrAccount}
                  onChange={(e) => setMethodOrAccount(e.target.value)}
                  placeholder="Method"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div
            className="fixed left-0 right-0 bottom-0 px-4 pb-4 pt-3"
            style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)" }}
          >
            <div className="mx-auto max-w-md flex items-center gap-2">
              <button className="rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>
                Split
              </button>
              <button className="rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>
                Recurring
              </button>
              <button className="rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>
                Tags
              </button>
              <button className="rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>
                Goal
              </button>
              {isEdit && (
                <button
                  onClick={handleDelete}
                  className="rounded-full px-3 py-2 text-xs font-semibold"
                  style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="ml-auto rounded-full px-4 py-2 text-xs font-semibold"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {isResolved ? "Done" : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Entry Delete Warning Dialog - uses RecurringEntryDeleteDialog for recurring entries */}
      {entryDeletionImpact?.hasRecurringRule ? (
        <RecurringEntryDeleteDialog
          open={showDeleteWarning}
          onClose={() => setShowDeleteWarning(false)}
          onConfirm={confirmDelete}
          impact={entryDeletionImpact}
          loading={saving}
          entryTitle={entryTitle}
        />
      ) : (
        <DeletionWarningDialog
          open={showDeleteWarning}
          onClose={() => setShowDeleteWarning(false)}
          onConfirm={() => confirmDelete("this_only")}
          impact={buildEntryDeletionImpact(entryDeletionImpact ?? null, entryTitle)}
          loading={saving}
          confirmLabel="Delete"
        />
      )}
    </div>
  );
}
