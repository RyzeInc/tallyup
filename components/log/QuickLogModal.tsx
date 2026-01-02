"use client";

import React, { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { QuickLogDialog } from "@/components/logging";
import {
  todayISO,
  amountToCents,
} from "@/components/logging/machine";
import { yyyymmddToLocalMidnightTs } from "@/components/utils";
import type { TxDraft, AccountOption, GoalOption } from "@/components/logging/types";
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

  // Fetch data for pickers
  const accountsData = useQuery(api.accounts.listAccounts, {}) as
    | Doc<"accounts">[]
    | undefined;
  const goalsData = useQuery(api.goals.listGoals, {}) as
    | Doc<"goals">[]
    | undefined;

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
        category: draft.categoryId || undefined,
        note: draft.note?.trim() || undefined,
        merchant: draft.merchant?.trim() || undefined,
        methodOrAccount: draft.account.method?.trim() || undefined,
        amountCents,
        date: dateTs,
        tags: allTags.length > 0 ? allTags : undefined,
        goalId: draft.goalId ?? undefined,
        accountId: draft.account.accountId ?? undefined,
        needsReview: draft.needsReview,
      });

      // Show toast
      const typeLabel = draft.type === "spent" ? "Spent" : "Received";
      const amountStr = `$${(amountCents / 100).toFixed(2)}`;
      const recap = draft.needsReview
        ? `Saved to Review: ${typeLabel} ${amountStr}`
        : `Saved: ${typeLabel} ${amountStr}${draft.categoryId ? ` • ${draft.categoryId}` : ""}`;
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
      onSubmit={handleSubmit}
    />
  );
}
