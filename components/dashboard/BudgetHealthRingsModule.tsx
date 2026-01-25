"use client";

import * as React from "react";
import { ProgressRing } from "./ProgressRing";
import { formatMoney } from "@/components/utils";
import Link from "next/link";

export interface BudgetStatus {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  budgetedCents: number;
  spentCents: number;
  availableCents: number;
  percentUsed: number;
  paceDeltaCents: number;
  projectedEndCents: number;
  status: "on-track" | "warning" | "over";
}

export interface BudgetHealthRingsProps {
  budgets: BudgetStatus[];
  isLoading?: boolean;
  maxItems?: number;
}

/**
 * Get status color for budget
 */
function getStatusColor(status: "on-track" | "warning" | "over"): string {
  switch (status) {
    case "over":
      return "var(--danger)";
    case "warning":
      return "var(--warning)";
    default:
      return "var(--success)";
  }
}

/**
 * Default emoji icons for common budget categories
 */
const CATEGORY_ICONS: Record<string, string> = {
  "Groceries": "🛒",
  "Food": "🍽️",
  "Dining": "🍽️",
  "Restaurants": "🍽️",
  "Entertainment": "🎬",
  "Shopping": "🛍️",
  "Clothing": "👕",
  "Transportation": "🚗",
  "Car": "🚗",
  "Gas": "⛽",
  "Utilities": "💡",
  "Bills": "📄",
  "Health": "🏥",
  "Healthcare": "🏥",
  "Personal": "💆",
  "Subscriptions": "📱",
  "Travel": "✈️",
  "Education": "📚",
  "Gifts": "🎁",
  "Home": "🏠",
  "Housing": "🏠",
  "Insurance": "🛡️",
  "Pets": "🐕",
};

function getCategoryIcon(name: string, icon?: string): string {
  if (icon) return icon;
  // Try to match category name to known icons
  for (const [key, emoji] of Object.entries(CATEGORY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return emoji;
    }
  }
  return "💰"; // Default
}

/**
 * BudgetHealthRingsModule - Horizontal scroll of budget category rings
 * 
 * Shows top 5 budget categories with circular progress rings.
 * Color-coded: green (on-track), yellow (warning), red (over budget).
 * Inspired by Copilot's category budget circles.
 */
export function BudgetHealthRingsModule({
  budgets,
  isLoading = false,
  maxItems = 5,
}: BudgetHealthRingsProps) {
  const displayBudgets = budgets.slice(0, maxItems);

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-28 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="h-4 w-20 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-14 h-14 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              <div className="h-3 w-12 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (displayBudgets.length === 0) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h3 font-semibold" style={{ color: "var(--text)" }}>
            Budget Health
          </h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Create budgets to track spending
          </p>
          <Link
            href="/budgeting"
            className="inline-block mt-2 text-sm font-medium"
            style={{ color: "var(--primary)" }}
          >
            Set up budgets →
          </Link>
        </div>
      </div>
    );
  }

  // Calculate overall health
  const healthSummary = {
    onTrack: displayBudgets.filter((b) => b.status === "on-track").length,
    warning: displayBudgets.filter((b) => b.status === "warning").length,
    over: displayBudgets.filter((b) => b.status === "over").length,
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header with summary */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-h3 font-semibold" style={{ color: "var(--text)" }}>
            Budget Health
          </h3>
          {/* Mini summary */}
          <div className="flex items-center gap-2 mt-1">
            {healthSummary.onTrack > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--success)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{healthSummary.onTrack}</span>
              </span>
            )}
            {healthSummary.warning > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--warning)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{healthSummary.warning}</span>
              </span>
            )}
            {healthSummary.over > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{healthSummary.over}</span>
              </span>
            )}
          </div>
        </div>
        <Link
          href="/budgeting"
          className="text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          Details
        </Link>
      </div>

      {/* Horizontal scroll of budget rings */}
      <div
        className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {displayBudgets.map((budget) => {
          const statusColor = getStatusColor(budget.status);
          const icon = getCategoryIcon(budget.name, budget.icon);
          const isOver = budget.status === "over";

          return (
            <Link
              key={budget.id}
              href={`/budgeting?category=${encodeURIComponent(budget.id)}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-transform hover:scale-105"
              style={{ scrollSnapAlign: "start", minWidth: 72 }}
            >
              {/* Ring with icon */}
              <div className="relative">
                <ProgressRing
                  percent={budget.percentUsed}
                  size={56}
                  strokeWidth={5}
                  color={statusColor}
                  showLabel={false}
                />
                {/* Icon in center */}
                <div
                  className="absolute inset-0 flex items-center justify-center text-xl"
                >
                  {icon}
                </div>
              </div>

              {/* Amount label */}
              <div className="text-center">
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: statusColor }}
                >
                  {isOver ? (
                    <span>{formatMoney(Math.abs(budget.availableCents), { compact: true })}</span>
                  ) : (
                    <span>{formatMoney(budget.availableCents, { compact: true })}</span>
                  )}
                </div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isOver ? "over" : "left"}
                </div>
              </div>
            </Link>
          );
        })}

        {/* "See all" button if more budgets exist */}
        {budgets.length > maxItems && (
          <Link
            href="/budgeting"
            className="flex flex-col items-center justify-center gap-1 flex-shrink-0"
            style={{ scrollSnapAlign: "start", minWidth: 60 }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--surface-2)" }}
            >
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                +{budgets.length - maxItems}
              </span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              more
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default BudgetHealthRingsModule;
