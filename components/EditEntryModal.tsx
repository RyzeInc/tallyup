"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { QuickLogForm } from "@/components/logging";
import type { TxDraft, AccountOption, GoalOption, ContextFlag } from "@/components/logging/types";
import { amountToCents, todayISO } from "@/components/logging/machine";
import { yyyymmddToLocalMidnightTs } from "@/components/utils";
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
  accountId?: Id<"accounts">;
  // Phase 1: New fields
  goalId?: Id<"goals">;
  budgetCategoryId?: Id<"budgetCategories">;
  recurringRuleId?: Id<"recurringRules">;
  contextTags?: string[];
  intentTags?: string[];
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

  // Fetch goals for linking
  const goals = useQuery(api.goals.listGoals, {}) as { _id: string; name: string }[] | undefined;

  // Only keep state needed for deletion and errors; editing is handled by QuickLogForm
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountsData = useQuery(api.accounts.listAccounts, {}) as
    | { _id: string; name: string; type?: string }[]
    | undefined;

  // Build account options for QuickLogForm
  const accounts: AccountOption[] = useMemo(() => {
    if (!accountsData) return [];
    return accountsData.map((a) => ({ id: a._id as Id<"accounts">, name: a.name, kind: a.type ?? undefined }));
  }, [accountsData]);

  // Build goals list for QuickLogForm
  const goalsList: GoalOption[] = useMemo(() => {
    return (goals || []).map((g) => ({ id: g._id as Id<"goals">, name: g.name }));
  }, [goals]);

  // Tags catalog (kept small and consistent with QuickLogModal)
  const tagsCatalog = useMemo(() => {
    return [
      "Personal",
      "Shared",
      "Household",
      "Partner",
      "Dependent",
      "Business",
      "Client",
      "Reimbursable",
      "Tax-Deductible",
      "Essential",
      "Discretionary",
      "Planned",
      "Unexpected",
      "One-time",
      "Recurring",
    ];
  }, []);
  // Previously the modal allowed inline editing; we now use QuickLogForm.

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

  // Map the existing entry into the QuickLog TxDraft shape - memoized to avoid re-creating on every render
  const existingDraft = useMemo<TxDraft>(() => {
    const d = new Date(entry.date);
    const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

    // type mapping
    const type: TxDraft["type"] = entry.type === "income" ? "received" : entry.type === "expense" ? "spent" : "spent";

    // intent mapping
    const intent: TxDraft["intent"] = {};
    if ((entry.intentTags ?? []).map((t) => t.toLowerCase()).includes("essential")) intent.necessity = "essential";
    if ((entry.intentTags ?? []).map((t) => t.toLowerCase()).includes("discretionary")) intent.necessity = "discretionary";
    if ((entry.intentTags ?? []).map((t) => t.toLowerCase()).includes("planned")) intent.planning = "planned";
    if ((entry.intentTags ?? []).map((t) => t.toLowerCase()).includes("unexpected")) intent.planning = "unexpected";

    // context mapping - pick scope if present, and flags
    let contextScope: TxDraft["contextScope"] | undefined;
    const flags: TxDraft["contextFlags"] = [];
    (entry.contextTags ?? []).forEach((t) => {
      const tl = t.toLowerCase();
      if (["personal", "shared", "household", "partner"].includes(tl)) {
        contextScope = tl as TxDraft["contextScope"];
      } else if (["dependent", "business", "client", "reimbursable", "tax-deductible", "tax_deductible"].includes(tl)) {
        flags.push(tl.replace("-", "_") as ContextFlag);
      }
    });

    const account: TxDraft["account"] = {};
    // prefer explicit accountId if present on entry
    if (entry.accountId) account.accountId = entry.accountId;
    if (entry.methodOrAccount) account.method = entry.methodOrAccount;

    return {
      id: entry._id as Id<"entries">,
      type,
      amount: (Math.abs(entry.amountCents) / 100).toFixed(2),
      dateISO,
      merchant: entry.merchant ?? undefined,
      note: entry.note ?? undefined,
      categoryId: entry.category ?? entry.bucket ?? undefined,
      contextScope,
      contextFlags: flags,
      intent,
      tags: entry.tags ?? [],
      account,
      goalId: entry.goalId ?? undefined,
      recurring: undefined,
      needsReview: entry.needsReview ?? false,
    };
  }, [entry._id, entry.type, entry.amountCents, entry.date, entry.merchant, entry.note, entry.category, entry.bucket, entry.tags, entry.methodOrAccount, entry.needsReview, entry.accountId, entry.goalId, entry.contextTags, entry.intentTags]);

  // Memoize the date for QuickLogForm to avoid triggering re-renders
  const nowDateISO = useMemo(() => todayISO(), []);

  // Handler used by QuickLogForm to save updates - memoized to prevent re-renders
  const handleResolveSubmit = useCallback(async (draft: TxDraft): Promise<{ ok: true; txId: string } | { ok: false; error: string }> => {
    try {
      const amountCents = amountToCents(draft.amount);
      if (!amountCents || amountCents <= 0) return { ok: false, error: "Invalid amount" };

      const dateTs = yyyymmddToLocalMidnightTs(draft.dateISO);

      // Build contextTags from contextScope and contextFlags
      const contextTags: string[] = [];
      if (draft.contextScope) {
        contextTags.push(draft.contextScope.charAt(0).toUpperCase() + draft.contextScope.slice(1));
      }
      (draft.contextFlags || []).forEach((f) => {
        contextTags.push(
          f
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join("-")
        );
      });

      // Build intentTags from intent object
      const intentTags: string[] = [];
      if (draft.intent.necessity) intentTags.push(draft.intent.necessity.charAt(0).toUpperCase() + draft.intent.necessity.slice(1));
      if (draft.intent.planning) intentTags.push(draft.intent.planning.charAt(0).toUpperCase() + draft.intent.planning.slice(1));

      await updateEntry({
        id: entry._id as Id<"entries">,
        category: draft.categoryId || undefined,
        amountCents,
        date: dateTs,
        note: draft.note?.trim() || undefined,
        methodOrAccount: draft.account?.method?.trim() || undefined,
        // Keep regular tags separate
        tags: draft.tags.length > 0 ? draft.tags : undefined,
        // Pass context and intent as separate fields
        contextTags: contextTags.length > 0 ? contextTags : [],
        intentTags: intentTags.length > 0 ? intentTags : [],
        needsReview: draft.needsReview,
        // Keep shape consistent with entries update signature
        goalId: draft.goalId ?? null,
        recurringRuleId: null,
        // set accountId if provided
        accountId: draft.account?.accountId ?? undefined,
      });

      toast.success("Entry updated");
      onSaved?.();
      return { ok: true, txId: entry._id };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save";
      return { ok: false, error: message };
    }
  }, [entry._id, updateEntry, toast, onSaved]);

  // Old tag/context/intent helpers removed in favor of QuickLogForm handlers

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          {/* Delete control + keep the original close UX */}
          <div className="flex items-center justify-end px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md px-3 py-1 text-sm font-medium text-danger hover:bg-[var(--surface-subtle)] disabled:opacity-50"
              style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>

          {/* Use the QuickLogForm in resolve mode to provide parity with QuickLog UX */}
          {/* Show inline errors from delete/update operations */}
          {error && (
            <div
              className="mb-4 rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
            >
              {error}
            </div>
          )}
          <QuickLogForm
            mode="resolve"
            nowDateISO={nowDateISO}
            existing={existingDraft}
            accounts={accounts}
            tagsCatalog={tagsCatalog}
            goals={goalsList}
            onSubmit={handleResolveSubmit}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
