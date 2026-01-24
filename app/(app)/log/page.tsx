"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { getCategoryDisplayName, yyyymmddToLocalMidnightTs } from "@/components/utils";
import { QuickLogForm } from "@/components/logging";
import {
  todayISO,
  amountToCents,
} from "@/components/logging/machine";
import type { TxDraft, AccountOption, GoalOption, CategoryOption } from "@/components/logging/types";
import { useQuickLog } from "@/components/log/QuickLogProvider";
import PageHeader from "@/components/ui/PageHeader";

/**
 * Log Page - Redesigned with QuickLogForm
 * 
 * Uses the unified QuickLogForm component that provides:
 * - Minimal first, details on demand UX
 * - Type toggle (Spent/Received/Transfer)
 * - Amount as hero input
 * - Date + Category row
 * - Progressive disclosure via Add details pills
 * - Bottom sheets for advanced metadata
 */

export default function LogPage() {
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
  // Top-level expense categories only (for the Category dropdown)
  const expenseParentCategoriesData = useQuery(api.categories.listCategories, { categoryType: "expense", topLevelOnly: true }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  // All expense categories including subcategories (for SubcategoryField)
  const allExpenseCategoriesData = useQuery(api.categories.listCategories, { categoryType: "expense" }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  // Top-level income categories only
  const incomeParentCategoriesData = useQuery(api.categories.listCategories, { categoryType: "income", topLevelOnly: true }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  // All income categories
  const allIncomeCategoriesData = useQuery(api.categories.listCategories, { categoryType: "income" }) as
    | { _id: string; name: string; slug?: string; parentId?: string }[]
    | undefined;
  // All transfer categories (including subcategories for From/To selection)
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

  // Parent categories only (for the Category dropdown) - NO SUBCATEGORIES
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
          merchant: draft.merchant?.trim() || undefined,
          title: draft.title?.trim() || undefined,
          category: draft.categoryId || undefined,
        });
        quickLog.showToast("Saved: Transfer");
        return { ok: true, txId: res.id };
      }

      // Combine context and intent into tags
      const allTags: string[] = [...draft.tags];
      if (draft.contextScope) {
        allTags.push(
          draft.contextScope.charAt(0).toUpperCase() + draft.contextScope.slice(1)
        );
      }
      draft.contextFlags.forEach((f) => {
        allTags.push(
          f
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join("-")
        );
      });
      if (draft.intent.necessity) {
        allTags.push(
          draft.intent.necessity.charAt(0).toUpperCase() +
            draft.intent.necessity.slice(1)
        );
      }
      if (draft.intent.planning) {
        allTags.push(
          draft.intent.planning.charAt(0).toUpperCase() +
            draft.intent.planning.slice(1)
        );
      }

      const entryType: "expense" | "income" = draft.type === "spent" ? "expense" : "income";

      const res = await addEntry({
        type: entryType,
        categoryId: (draft.categoryId || undefined) as Id<"categories"> | undefined,
        subcategoryId: (draft.subcategoryId || undefined) as Id<"categories"> | undefined,
        note: draft.note?.trim() || undefined,
        title: draft.title?.trim() || undefined,
        merchant: draft.merchant?.trim() || undefined,
        methodOrAccount: draft.account.method?.trim() || undefined,
        amountCents,
        date: dateTs,
        tags: allTags.length > 0 ? allTags : undefined,
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
    <>
      <SignedOut>
        <div className="p-4">
          <PageHeader title="Log" subtitle="Just the basics — review anytime" compact />
          <div
            className="mt-4 rounded-xl p-6 text-center"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign in to start logging
            </p>
            <SignInButton mode="modal">
              <button
                className="px-6 py-3 rounded-xl font-semibold"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Container with fixed height for proper scroll behavior */}
        <div 
          className="flex flex-col overflow-hidden rounded-2xl"
          style={{
            height: "calc(100dvh - 120px)", /* Account for top nav and page padding */
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <QuickLogForm
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
        </div>
      </SignedIn>
    </>
  );
}
