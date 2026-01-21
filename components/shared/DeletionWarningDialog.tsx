"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { centsToDollars } from "@/components/utils";

export interface DeletionImpact {
  itemName: string;
  itemType: "entry" | "recurring-rule" | "goal" | "budget-category" | "account";
  warnings: Array<{
    label: string;
    value: string | number;
    isCritical?: boolean;
  }>;
  confirmationText?: string;
}

interface DeletionWarningDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  impact: DeletionImpact | null;
  loading?: boolean;
  confirmLabel?: string;
}

export default function DeletionWarningDialog({
  open,
  onClose,
  onConfirm,
  impact,
  loading = false,
  confirmLabel = "Delete",
}: DeletionWarningDialogProps) {
  if (!open || !impact) return null;

  const hasCriticalWarnings = impact.warnings.some((w) => w.isCritical);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      {/* Dialog */}
      <div
        className="relative w-full max-w-md rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-black/10"
          style={{ color: "var(--text-secondary)" }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-2 rounded-full"
            style={{ backgroundColor: hasCriticalWarnings ? "var(--danger-subtle, #fef2f2)" : "var(--warning-subtle, #fffbeb)" }}
          >
            <AlertTriangle
              size={24}
              style={{ color: hasCriticalWarnings ? "var(--danger)" : "var(--warning, #f59e0b)" }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              Delete {impact.itemType === "entry" ? "Transaction" : 
                      impact.itemType === "recurring-rule" ? "Recurring Rule" :
                      impact.itemType === "goal" ? "Goal" :
                      impact.itemType === "budget-category" ? "Budget Category" : "Account"}?
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {impact.itemName}
            </p>
          </div>
        </div>

        {/* Warnings List */}
        {impact.warnings.length > 0 && (
          <div
            className="rounded-lg p-4 mb-4"
            style={{ backgroundColor: "var(--surface-subtle)" }}
          >
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
              This will affect:
            </p>
            <ul className="space-y-2">
              {impact.warnings.map((warning, idx) => (
                <li key={idx} className="flex justify-between text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>{warning.label}</span>
                  <span
                    className="font-medium"
                    style={{ color: warning.isCritical ? "var(--danger)" : "var(--text)" }}
                  >
                    {typeof warning.value === "number" && warning.label.toLowerCase().includes("amount")
                      ? `$${centsToDollars(warning.value)}`
                      : warning.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirmation text */}
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          {impact.confirmationText || "This action cannot be undone."}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--danger)", color: "white" }}
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to build impact from entry deletion query result
 */
export function buildEntryDeletionImpact(
  result: {
    hasRecurringRule: boolean;
    recurringRuleName: string | null;
    linkedEntriesInRule: number;
    hasGoal: boolean;
    goalName: string | null;
    hasBudgetCategory: boolean;
    budgetCategoryName: string | null;
    hasTransferPair: boolean;
    amountCents: number;
  } | null,
  entryTitle?: string
): DeletionImpact | null {
  if (!result) return null;

  const warnings: DeletionImpact["warnings"] = [];

  if (result.hasRecurringRule) {
    warnings.push({
      label: "Linked to recurring rule",
      value: result.recurringRuleName || "Unknown Rule",
      isCritical: true,
    });
    warnings.push({
      label: "Other transactions in rule",
      value: result.linkedEntriesInRule - 1,
    });
  }

  if (result.hasGoal) {
    warnings.push({
      label: "Contributing to goal",
      value: result.goalName || "Unknown Goal",
    });
  }

  if (result.hasBudgetCategory) {
    warnings.push({
      label: "Tracked in budget",
      value: result.budgetCategoryName || "Unknown Category",
    });
  }

  if (result.hasTransferPair) {
    warnings.push({
      label: "Transfer pair",
      value: "Will also delete paired transaction",
      isCritical: true,
    });
  }

  return {
    itemName: entryTitle || `$${centsToDollars(result.amountCents)} transaction`,
    itemType: "entry",
    warnings,
    confirmationText: result.hasTransferPair
      ? "This will delete both sides of the transfer."
      : result.hasRecurringRule
      ? "The transaction will be unlinked from the recurring rule."
      : undefined,
  };
}

/**
 * Helper to build impact from recurring rule deletion query result
 */
export function buildRecurringRuleDeletionImpact(
  result: {
    linkedEntriesCount: number;
    totalLinkedCents: number;
    upcomingChargesCount: number;
  } | null,
  ruleName?: string
): DeletionImpact | null {
  if (!result) return null;

  const warnings: DeletionImpact["warnings"] = [];

  if (result.linkedEntriesCount > 0) {
    warnings.push({
      label: "Linked transactions",
      value: result.linkedEntriesCount,
      isCritical: true,
    });
    warnings.push({
      label: "Total amount linked",
      value: result.totalLinkedCents,
    });
  }

  if (result.upcomingChargesCount > 0) {
    warnings.push({
      label: "Upcoming expected charges",
      value: result.upcomingChargesCount,
    });
  }

  return {
    itemName: ruleName || "Recurring Rule",
    itemType: "recurring-rule",
    warnings,
    confirmationText: result.linkedEntriesCount > 0
      ? "Linked transactions will be unlinked but not deleted."
      : undefined,
  };
}

/**
 * Helper to build impact from goal deletion query result
 */
export function buildGoalDeletionImpact(
  result: {
    goalName: string;
    currentAmountCents: number;
    targetAmountCents: number;
    contributionsCount: number;
    totalContributedCents: number;
    linkedEntriesCount: number;
    hasFundingAccount: boolean;
    hasFundingCategories: boolean;
  } | null
): DeletionImpact | null {
  if (!result) return null;

  const warnings: DeletionImpact["warnings"] = [];

  warnings.push({
    label: "Progress",
    value: `$${centsToDollars(result.currentAmountCents)} / $${centsToDollars(result.targetAmountCents)}`,
  });

  if (result.contributionsCount > 0) {
    warnings.push({
      label: "Contributions recorded",
      value: result.contributionsCount,
    });
  }

  if (result.linkedEntriesCount > 0) {
    warnings.push({
      label: "Linked transactions",
      value: result.linkedEntriesCount,
      isCritical: true,
    });
  }

  if (result.hasFundingAccount || result.hasFundingCategories) {
    warnings.push({
      label: "Auto-funding configured",
      value: "Will be lost",
    });
  }

  return {
    itemName: result.goalName,
    itemType: "goal",
    warnings,
    confirmationText: result.linkedEntriesCount > 0
      ? "Linked transactions will be unlinked but not deleted."
      : undefined,
  };
}

/**
 * Helper to build impact from budget category deletion query result
 */
export function buildBudgetCategoryDeletionImpact(
  result: {
    categoryName: string;
    budgetAmountCents: number;
    linkedEntriesCount: number;
    totalSpentCents: number;
    groupMembershipsCount: number;
    entryImpactsCount: number;
  } | null
): DeletionImpact | null {
  if (!result) return null;

  const warnings: DeletionImpact["warnings"] = [];

  warnings.push({
    label: "Monthly budget",
    value: result.budgetAmountCents,
  });

  if (result.linkedEntriesCount > 0) {
    warnings.push({
      label: "Transactions tracked",
      value: result.linkedEntriesCount,
      isCritical: true,
    });
    warnings.push({
      label: "Total spent",
      value: result.totalSpentCents,
    });
  }

  if (result.groupMembershipsCount > 0) {
    warnings.push({
      label: "Budget groups",
      value: result.groupMembershipsCount,
    });
  }

  return {
    itemName: result.categoryName,
    itemType: "budget-category",
    warnings,
    confirmationText: result.linkedEntriesCount > 0
      ? "Transactions will be unlinked from this budget category."
      : undefined,
  };
}
