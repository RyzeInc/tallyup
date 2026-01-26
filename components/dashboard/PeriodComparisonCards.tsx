"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

export interface PeriodComparisonData {
  current: {
    income: number;
    expense: number;
    net: number;
  };
  previous: {
    income: number;
    expense: number;
    net: number;
  };
}

export interface PeriodDelta {
  value: number;
  percent: number;
  direction: "up" | "down" | "flat";
  isPositive: boolean; // Whether this direction is good (up income = good, up expense = bad)
}

export interface PeriodComparisonCardProps {
  label: string; // e.g., "This Month"
  previousLabel?: string; // e.g., "vs Last Month"
  income: number;
  expense: number;
  previousIncome?: number;
  previousExpense?: number;
  isLoading?: boolean;
}

/**
 * Calculate period-over-period delta
 */
function calculateDelta(current: number, previous: number | undefined, isExpense = false): PeriodDelta | null {
  if (previous === undefined || previous === 0) {
    return null;
  }
  
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  
  // For expenses, down is positive (good). For income, up is positive (good).
  const isPositive = isExpense ? direction === "down" : direction === "up";
  
  return {
    value: diff,
    percent: Math.abs(percent),
    direction,
    isPositive,
  };
}

/**
 * DeltaBadge - Shows period comparison change
 */
function DeltaBadge({ 
  delta, 
  compact = false 
}: { 
  delta: PeriodDelta | null; 
  compact?: boolean;
}) {
  if (!delta || delta.direction === "flat") {
    return null;
  }

  const Icon = delta.direction === "up" ? Lucide.TrendingUp : Lucide.TrendingDown;
  const color = delta.isPositive ? "var(--success)" : "var(--danger)";
  const bgColor = delta.isPositive ? "var(--success-subtle)" : "var(--danger-subtle)";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full ${compact ? "px-1.5 py-0.5" : "px-2 py-1"}`}
      style={{ backgroundColor: bgColor }}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} style={{ color }} />
      <span 
        className={`${compact ? "text-[10px]" : "text-xs"} font-medium tabular-nums`}
        style={{ color }}
      >
        {delta.percent}%
      </span>
    </div>
  );
}

/**
 * PeriodComparisonCards - Income/Expense cards with "vs last period" delta
 * 
 * Shows current period totals with comparison badges.
 * Inspired by Copilot's "vs last month" treatment.
 */
export function PeriodComparisonCards({
  label,
  previousLabel = "vs last period",
  income,
  expense,
  previousIncome,
  previousExpense,
  isLoading = false,
}: PeriodComparisonCardProps) {
  const incomeDelta = calculateDelta(income, previousIncome, false);
  const expenseDelta = calculateDelta(expense, previousExpense, true);
  const net = income - expense;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Net */}
        <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
        {/* Income/Expense grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
          <div className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hero: Net Amount */}
      <div className="mb-1">
        <div className="text-micro mb-1" style={{ color: "var(--text-secondary)" }}>
          {label} Net
        </div>
        <div
          className="text-kpi tabular-nums"
          style={{ color: net >= 0 ? "var(--net)" : "var(--danger)" }}
        >
          {formatMoney(net, { signMode: "always" })}
        </div>
      </div>

      {/* Income / Expense Grid with deltas */}
      <div className="grid grid-cols-2 gap-3">
        {/* Income card */}
        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: "var(--success-subtle)" }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
              <span className="text-micro font-medium" style={{ color: "var(--success)" }}>
                Income
              </span>
            </div>
            {incomeDelta && <DeltaBadge delta={incomeDelta} compact />}
          </div>
          <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {formatMoney(income)}
          </div>
          {incomeDelta && previousIncome !== undefined && (
            <div className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              {previousLabel}: {formatMoney(previousIncome)}
            </div>
          )}
        </div>

        {/* Expense card */}
        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: "var(--danger-subtle)" }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--danger)" }} />
              <span className="text-micro font-medium" style={{ color: "var(--danger)" }}>
                Expenses
              </span>
            </div>
            {expenseDelta && <DeltaBadge delta={expenseDelta} compact />}
          </div>
          <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {formatMoney(expense)}
          </div>
          {expenseDelta && previousExpense !== undefined && (
            <div className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              {previousLabel}: {formatMoney(previousExpense)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PeriodComparisonCards;
