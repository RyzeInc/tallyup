"use client";

import React, { useMemo, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { QuickLogDialog } from "@/components/logging";
import {
  todayISO,
  amountToCents,
} from "@/components/logging/machine";
import { getCategoryDisplayName, yyyymmddToLocalMidnightTs } from "@/components/utils";
import type { TxDraft, AccountOption, GoalOption, CategoryOption } from "@/components/logging/types";
import { useQuickLog } from "./QuickLogProvider";

export default function QuickLogModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const quickLog = useQuickLog();
  const addEntry = useMutation(api.entries.addEntry);
  const createTransfer = useMutation(api.transfers.createTransfer);
  const ensureSystemCategories = useMutation(api.categories.ensureSystemCategories);

  // Fetch data for pickers
  const accountsData = useQuery(api.accounts.listAccounts, {}) as
    | Doc<"accounts">[]
    | undefined;
  const goalsData = useQuery(api.goals.listGoals, {}) as
    | Doc<"goals">[]
    | undefined;
  
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
  
  // Fetch user preferences for hidden categories/tags
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});
  
  useEffect(() => {
    ensureSystemCategories().catch(() => {});
  }, [ensureSystemCategories]);

  // Build account options
  const accounts: AccountOption[] = useMemo(() => {
    if (!accountsData) return [];
    return accountsData.map((a) => ({
      id: a._id,
      name: a.name,
      kind: a.type ?? undefined,
    }));
  }, [accountsData]);

  // Build goal options
  const goals: GoalOption[] = useMemo(() => {
    if (!goalsData) return [];
    return goalsData.map((g) => ({
      id: g._id,
      name: g.name,
    }));
  }, [goalsData]);

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

  // All categories including subcategories
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

  const allCategories = useMemo(
    () => [...(allExpenseCategoriesData ?? []), ...(allIncomeCategoriesData ?? [])],
    [allExpenseCategoriesData, allIncomeCategoriesData]
  );

  // Build tags catalog
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

  // Submit handler
  const handleSubmit = async (
    draft: TxDraft
  ): Promise<{ ok: true; txId: string } | { ok: false; error: string }> => {
    try {
      const amountCents = amountToCents(draft.amount);
      if (!amountCents || amountCents <= 0) {
        return { ok: false, error: "Invalid amount" };
      }

      const dateTs = yyyymmddToLocalMidnightTs(draft.dateISO);

      if (draft.type === "transfer") {
        const res = await createTransfer({
          amountCents,
          date: dateTs,
          fromAccountId: draft.account.fromAccountId ?? undefined,
          toAccountId: draft.account.toAccountId ?? undefined,
          transferType: "internal",
          note: draft.note?.trim() || undefined,
        });
        quickLog.showToast("Saved: Transfer");
        return { ok: true, txId: res.id };
      }

      // Build contextTags from contextScope and contextFlags
      const contextTags: string[] = [];
      if (draft.contextScope) {
        contextTags.push(
          draft.contextScope.charAt(0).toUpperCase() + draft.contextScope.slice(1)
        );
      }
      draft.contextFlags.forEach((f) => {
        contextTags.push(
          f
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join("-")
        );
      });

      // Build intentTags from intent object
      const intentTags: string[] = [];
      if (draft.intent.necessity) {
        intentTags.push(
          draft.intent.necessity.charAt(0).toUpperCase() +
            draft.intent.necessity.slice(1)
        );
      }
      if (draft.intent.planning) {
        intentTags.push(
          draft.intent.planning.charAt(0).toUpperCase() +
            draft.intent.planning.slice(1)
        );
      }

      const entryType: "expense" | "income" = draft.type === "spent" ? "expense" : "income";

      const res = await addEntry({
        type: entryType,
        categoryId: (draft.categoryId || undefined) as Id<"categories"> | undefined,
        subcategoryId: (draft.subcategoryId || undefined) as Id<"categories"> | undefined,
        title: draft.title?.trim() || undefined,
        note: draft.note?.trim() || undefined,
        merchant: draft.merchant?.trim() || undefined,
        methodOrAccount: draft.account.method?.trim() || undefined,
        amountCents,
        date: dateTs,
        // Keep regular tags separate
        tags: draft.tags.length > 0 ? draft.tags : undefined,
        // Pass context and intent as separate fields
        contextTags: contextTags.length > 0 ? contextTags : undefined,
        intentTags: intentTags.length > 0 ? intentTags : undefined,
        goalId: draft.goalId ?? undefined,
        accountId: draft.account.accountId ?? undefined,
        needsReview: draft.needsReview,
        // Pass recurring if set (will auto-create recurring rule)
        recurring: draft.recurring?.cadence ? {
          cadence: draft.recurring.cadence,
          anchorDate: draft.recurring.anchorDate,
        } : undefined,
      });

      // Show toast
      const typeLabel = draft.type === "spent" ? "Spent" : "Received";
      const amountStr = `$${(amountCents / 100).toFixed(2)}`;
      const recap = draft.needsReview
        ? `Saved to Review: ${typeLabel} ${amountStr}`
        : `Saved: ${typeLabel} ${amountStr}${
            draft.categoryId ? ` • ${getCategoryDisplayName(draft.categoryId, allCategories)}` : ""
          }`;
      quickLog.showToast(recap);

      return { ok: true, txId: res.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      return { ok: false, error: message };
    }
  };

  return (
    <QuickLogDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      mode="create"
      nowDateISO={todayISO()}
      accounts={accounts}
      tagsCatalog={tagsCatalog}
      goals={goals}
      expenseCategories={expenseCategories}
      incomeCategories={incomeCategories}
      allExpenseCategories={allExpenseCategories}
      allIncomeCategories={allIncomeCategories}
      transferCategories={transferCategories}
      onSubmit={handleSubmit}
      hiddenExpenseCategories={userPrefs?.hiddenExpenseCategories ?? []}
      hiddenIncomeCategories={userPrefs?.hiddenIncomeCategories ?? []}
      hiddenContextTags={userPrefs?.hiddenContextTags ?? []}
    />
  );
}
