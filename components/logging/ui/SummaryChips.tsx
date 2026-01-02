"use client";

import * as React from "react";
import type { TxDraft, CategoryOption, AccountOption, GoalOption } from "../types";

type SummaryChipsProps = {
  draft: TxDraft;
  categories: CategoryOption[];
  accounts: AccountOption[];
  goals: GoalOption[];
};

export function SummaryChips({
  draft,
  categories: _categories,
  accounts,
  goals,
}: SummaryChipsProps) {
  // Note: categories is available but not currently used in summary
  void _categories;
  const parts: string[] = [];

  // Context summary
  if (draft.contextScope || draft.contextFlags.length > 0) {
    const contextParts: string[] = [];
    if (draft.contextScope) {
      contextParts.push(
        draft.contextScope.charAt(0).toUpperCase() + draft.contextScope.slice(1)
      );
    }
    draft.contextFlags.forEach((f) => {
      contextParts.push(
        f
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("-")
      );
    });
    if (contextParts.length > 0) {
      parts.push(`Context: ${contextParts.join(" • ")}`);
    }
  }

  // Intent summary
  const intentParts: string[] = [];
  if (draft.intent.necessity) {
    intentParts.push(
      draft.intent.necessity.charAt(0).toUpperCase() +
        draft.intent.necessity.slice(1)
    );
  }
  if (draft.intent.planning) {
    intentParts.push(
      draft.intent.planning.charAt(0).toUpperCase() +
        draft.intent.planning.slice(1)
    );
  }
  if (intentParts.length > 0) {
    parts.push(`Intent: ${intentParts.join(" • ")}`);
  }

  // Account summary
  if (draft.type === "transfer") {
    const from = accounts.find((a) => a.id === draft.account.fromAccountId);
    const to = accounts.find((a) => a.id === draft.account.toAccountId);
    if (from || to) {
      parts.push(`Transfer: ${from?.name ?? "?"} → ${to?.name ?? "?"}`);
    }
  } else if (draft.account.accountId) {
    const acc = accounts.find((a) => a.id === draft.account.accountId);
    if (acc) {
      parts.push(`Account: ${acc.name}`);
    }
  }
  if (draft.account.method) {
    parts.push(`Method: ${draft.account.method}`);
  }

  // Tags summary
  if (draft.tags.length > 0) {
    if (draft.tags.length === 1) {
      parts.push(`Tags: ${draft.tags[0]}`);
    } else {
      parts.push(`Tags: ${draft.tags[0]} +${draft.tags.length - 1}`);
    }
  }

  // Recurring summary
  if (draft.recurring?.cadence) {
    parts.push(`Recurring: ${draft.recurring.cadence}`);
  }

  // Goal summary
  if (draft.goalId) {
    const goal = goals.find((g) => g.id === draft.goalId);
    if (goal) {
      parts.push(`Goal: ${goal.name}`);
    }
  }

  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {parts.map((part, i) => (
        <span
          key={i}
          className="inline-flex items-center h-6 px-2 rounded text-[11px] font-medium"
          style={{
            backgroundColor: "var(--surface-2)",
            color: "var(--text-secondary)",
          }}
        >
          {part}
        </span>
      ))}
    </div>
  );
}
