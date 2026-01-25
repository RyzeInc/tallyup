"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { QuickLogForm } from "@/components/logging";
import type { TxDraft, AccountOption, GoalOption, ContextFlag, CategoryOption } from "@/components/logging/types";
import { amountToCents, todayISO } from "@/components/logging/machine";
import { yyyymmddToLocalMidnightTs, centsToDollars } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import DeletionWarningDialog, { buildEntryDeletionImpact, RecurringEntryDeleteDialog, type DeleteScope } from "@/components/shared/DeletionWarningDialog";

interface Entry {
  _id: string;
  type: "expense" | "income";
  amountCents: number;
  date: number;
  category?: string;
  categoryId?: Id<"categories">;
  subcategoryId?: Id<"categories">;
  title?: string;
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
  const ensureSystemCategories = useMutation(api.categories.ensureSystemCategories);
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});

  // Fetch goals for linking
  const goals = useQuery(api.goals.listGoals, {}) as { _id: string; name: string }[] | undefined;
  
  // Top-level categories only (for the Category dropdown)
  const expenseParentCategoriesData = useQuery(api.categories.listCategories, { categoryType: "expense", topLevelOnly: true }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  const incomeParentCategoriesData = useQuery(api.categories.listCategories, { categoryType: "income", topLevelOnly: true }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  
  // All categories including subcategories (for SubcategoryField)
  const allExpenseCategoriesData = useQuery(api.categories.listCategories, { categoryType: "expense" }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  const allIncomeCategoriesData = useQuery(api.categories.listCategories, { categoryType: "income" }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  const transferCategoriesData = useQuery(api.categories.listCategories, { categoryType: "transfer" }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  const entryDeletionImpact = useQuery(api.entries.getEntryDeletionImpact, { id: entry._id as Id<"entries"> });

  useEffect(() => {
    ensureSystemCategories().catch(() => {});
  }, [ensureSystemCategories]);

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

  // Parent categories only (for the Category dropdown)
  const expenseCategories: CategoryOption[] = useMemo(() => {
    if (!expenseParentCategoriesData) return [];
    return expenseParentCategoriesData.map((c) => ({ 
      id: c._id, 
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
    }));
  }, [expenseParentCategoriesData]);

  const incomeCategories: CategoryOption[] = useMemo(() => {
    if (!incomeParentCategoriesData) return [];
    return incomeParentCategoriesData.map((c) => ({ 
      id: c._id, 
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
    }));
  }, [incomeParentCategoriesData]);

  // All categories including subcategories (for SubcategoryField)
  const allExpenseCategories: CategoryOption[] = useMemo(() => {
    if (!allExpenseCategoriesData) return [];
    return allExpenseCategoriesData.map((c) => ({ 
      id: c._id, 
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
    }));
  }, [allExpenseCategoriesData]);

  const allIncomeCategories: CategoryOption[] = useMemo(() => {
    if (!allIncomeCategoriesData) return [];
    return allIncomeCategoriesData.map((c) => ({ 
      id: c._id, 
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
    }));
  }, [allIncomeCategoriesData]);

  const transferCategories: CategoryOption[] = useMemo(() => {
    if (!transferCategoriesData) return [];
    return transferCategoriesData.map((c) => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
    }));
  }, [transferCategoriesData]);

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

  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  async function handleDelete() {
    console.log("[EditEntryModal] Delete button clicked");
    // Always show warning dialog for entries with relationships or recurring entries
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
    console.log("[EditEntryModal] Confirming delete for entry:", entry._id, "scope:", scope);
    setShowDeleteWarning(false);
    setDeleting(true);
    try {
      await deleteEntry({ id: entry._id as Id<"entries">, deleteScope: scope });
      console.log("[EditEntryModal] Delete successful");
      const message = scope === "entire_series" 
        ? "Series deleted" 
        : scope === "this_and_future" 
        ? "Future transactions deleted" 
        : "Entry deleted";
      toast.success(message);
      onDeleted?.();
      onClose();
    } catch (e: unknown) {
      console.error("[EditEntryModal] Delete failed:", e);
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
      toast.error("Failed to delete", { description: message });
    } finally {
      setDeleting(false);
    }
  }

  // Build entry title for the warning dialog
  const entryTitle = useMemo(() => {
    const amount = `$${centsToDollars(entry.amountCents)}`;
    if (entry.merchant) return `${entry.merchant} - ${amount}`;
    if (entry.category) return `${entry.category} - ${amount}`;
    return `${amount} ${entry.type}`;
  }, [entry]);

  // Map the existing entry into the QuickLog TxDraft shape - memoized to avoid re-creating on every render
  const existingDraft = useMemo<TxDraft>(() => {
    // Debug: log the raw entry data being mapped
    console.log("[EditEntryModal] Mapping entry to draft:", {
      id: entry._id,
      title: entry.title,
      merchant: entry.merchant,
      subcategoryId: entry.subcategoryId,
      categoryId: entry.categoryId,
    });
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
      title: entry.title ?? undefined,
      merchant: entry.merchant ?? undefined,
      note: entry.note ?? undefined,
      categoryId: entry.categoryId ?? undefined,
      subcategoryId: entry.subcategoryId ?? undefined,
      contextScope,
      contextFlags: flags,
      intent,
      tags: entry.tags ?? [],
      account,
      goalId: entry.goalId ?? undefined,
      recurring: undefined,
      needsReview: entry.needsReview ?? false,
    };
  }, [entry._id, entry.type, entry.amountCents, entry.date, entry.title, entry.merchant, entry.note, entry.category, entry.bucket, entry.tags, entry.methodOrAccount, entry.needsReview, entry.accountId, entry.goalId, entry.contextTags, entry.intentTags, entry.categoryId, entry.subcategoryId]);

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
        categoryId: (draft.categoryId || undefined) as Id<"categories"> | undefined,
        subcategoryId: (draft.subcategoryId || undefined) as Id<"categories"> | undefined,
        title: draft.title?.trim() || undefined,
        merchant: draft.merchant?.trim() || undefined,
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
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/40" 
        onClick={onClose}
        aria-hidden="true"
      />
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
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            allExpenseCategories={allExpenseCategories}
            allIncomeCategories={allIncomeCategories}
            transferCategories={transferCategories}
            onSubmit={handleResolveSubmit}
            onClose={onClose}
            hiddenExpenseCategories={userPrefs?.hiddenExpenseCategories ?? []}
            hiddenIncomeCategories={userPrefs?.hiddenIncomeCategories ?? []}
            hiddenContextTags={userPrefs?.hiddenContextTags ?? []}
          />
        </div>
      </div>

      {/* Entry Delete Warning Dialog - uses RecurringEntryDeleteDialog for recurring entries */}
      {entryDeletionImpact?.hasRecurringRule ? (
        <RecurringEntryDeleteDialog
          open={showDeleteWarning}
          onClose={() => setShowDeleteWarning(false)}
          onConfirm={confirmDelete}
          impact={entryDeletionImpact}
          loading={deleting}
          entryTitle={entryTitle}
        />
      ) : (
        <DeletionWarningDialog
          open={showDeleteWarning}
          onClose={() => setShowDeleteWarning(false)}
          onConfirm={() => confirmDelete("this_only")}
          impact={buildEntryDeletionImpact(entryDeletionImpact ?? null, entryTitle)}
          loading={deleting}
          confirmLabel="Delete"
        />
      )}
    </div>
  );
}
