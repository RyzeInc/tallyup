"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

/** Cross-entity synchronized Safe-to-Spend data structure */
export interface SafeToSpendData {
  // Primary calculation
  safeToSpendCents: number;
  dailyAllowanceCents: number;
  daysRemaining: number;
  
  // Calculation mode
  mode: "budget" | "cash";
  
  // Budget data
  budgetTotalCents: number;
  budgetSpentCents: number;
  budgetAvailableCents: number;
  
  // Account balances
  cashBalanceCents: number;
  creditAvailableCents: number;
  debtBalanceCents: number;
  
  // Upcoming recurring
  upcomingBillsCents: number;
  upcomingBillsCount: number;
  upcomingIncomeCents: number;
  upcomingIncomeCount: number;
  
  // Goal commitments
  goalCommitmentsCents: number;
  activeGoalsCount: number;
  
  // Pending transactions
  pendingExpensesCents: number;
  pendingIncomeCents: number;
  
  // Alternative calculations
  budgetBasedCents: number;
  cashBasedCents: number;
  projectedCents: number;
  
  // Breakdown for UI
  breakdown: {
    startingBasis: number;
    startingBasisLabel: string;
    deductions: Array<{ label: string; amountCents: number; count: number }>;
    additions: Array<{ label: string; amountCents: number; count: number }>;
  };
}

export interface SafeToSpendModuleProps {
  data: SafeToSpendData | null;
  isLoading?: boolean;
  /** If true, shows expanded breakdown */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * SafeToSpendModule - Shows daily safe spending allowance with cross-entity synchronization
 * 
 * Synchronized with: budgets, goals, recurring expenses, recurring income, 
 * account balances, and pending transactions.
 * 
 * Calculation: Starting basis - Bills - Goals - Pending expenses + Pending income
 * Inspired by MoneyCoach's "Daily Limit" and "Remaining for Period" cards.
 */
export function SafeToSpendModule({
  data,
  isLoading = false,
  expanded = false,
  onToggleExpand,
}: SafeToSpendModuleProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-7 w-28 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Lucide.Calculator className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Set up budgets or link accounts to see your safe-to-spend
          </span>
        </div>
      </div>
    );
  }

  const { dailyAllowanceCents, safeToSpendCents, daysRemaining, mode, breakdown } = data;

  // Determine status color based on daily allowance
  const isWarning = dailyAllowanceCents >= 1000 && dailyAllowanceCents < 5000; // $10-50/day
  const isDanger = dailyAllowanceCents < 1000; // <$10/day

  const statusColor = isDanger ? "var(--danger)" : isWarning ? "var(--warning)" : "var(--success)";
  const statusBg = isDanger ? "var(--danger-subtle)" : isWarning ? "var(--warning-subtle)" : "var(--success-subtle)";

  // Icon mapping for breakdown items
  const getBreakdownIcon = (label: string) => {
    const normalizedLabel = label.toLowerCase();
    if (normalizedLabel.includes("budget")) return Lucide.Wallet;
    if (normalizedLabel.includes("cash") || normalizedLabel.includes("balance")) return Lucide.Landmark;
    if (normalizedLabel.includes("bill")) return Lucide.CalendarMinus;
    if (normalizedLabel.includes("goal")) return Lucide.Target;
    if (normalizedLabel.includes("pending") && normalizedLabel.includes("expense")) return Lucide.Clock;
    if (normalizedLabel.includes("pending") && normalizedLabel.includes("income")) return Lucide.Clock;
    if (normalizedLabel.includes("income")) return Lucide.TrendingUp;
    return Lucide.Circle;
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Main section - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
        disabled={!onToggleExpand}
      >
        <div className="flex items-center gap-4">
          {/* Daily allowance circle */}
          <div
            className="w-14 h-14 rounded-full flex flex-col items-center justify-center flex-shrink-0"
            style={{ backgroundColor: statusBg }}
          >
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: statusColor }}
            >
              {formatMoney(dailyAllowanceCents, { compact: true })}
            </span>
            <span
              className="text-[9px] uppercase tracking-wide"
              style={{ color: statusColor }}
            >
              /day
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              <span>Safe to Spend</span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium"
                style={{ 
                  backgroundColor: mode === "budget" ? "var(--primary-subtle)" : "var(--surface-2)",
                  color: mode === "budget" ? "var(--primary)" : "var(--text-tertiary)"
                }}
              >
                {mode === "budget" ? "Budget" : "Cash"}
              </span>
            </div>
            <div
              className="text-xl font-bold tabular-nums"
              style={{ color: "var(--text)" }}
            >
              {formatMoney(safeToSpendCents)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining in period
            </div>
          </div>

          {/* Expand indicator */}
          {onToggleExpand && (
            <Lucide.ChevronDown
              className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
              style={{ color: "var(--text-tertiary)" }}
            />
          )}
        </div>
      </button>

      {/* Expanded breakdown - Cross-entity synchronization details */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="pt-3 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            How this is calculated
          </div>

          {/* Starting basis (budget or cash) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === "budget" ? (
                <Lucide.Wallet className="h-4 w-4" style={{ color: "var(--primary)" }} />
              ) : (
                <Lucide.Landmark className="h-4 w-4" style={{ color: "var(--primary)" }} />
              )}
              <span className="text-sm" style={{ color: "var(--text)" }}>
                {breakdown.startingBasisLabel}
              </span>
            </div>
            <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
              {formatMoney(breakdown.startingBasis)}
            </span>
          </div>

          {/* Deductions */}
          {breakdown.deductions.map((deduction, idx) => {
            const Icon = getBreakdownIcon(deduction.label);
            return (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: "var(--warning)" }} />
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    {deduction.label}
                    {deduction.count > 0 && (
                      <span style={{ color: "var(--text-tertiary)" }}> ({deduction.count})</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-medium tabular-nums" style={{ color: "var(--warning)" }}>
                  -{formatMoney(deduction.amountCents)}
                </span>
              </div>
            );
          })}

          {/* Additions */}
          {breakdown.additions.map((addition, idx) => {
            const Icon = getBreakdownIcon(addition.label);
            return (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: "var(--success)" }} />
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    {addition.label}
                    {addition.count > 0 && (
                      <span style={{ color: "var(--text-tertiary)" }}> ({addition.count})</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-medium tabular-nums" style={{ color: "var(--success)" }}>
                  +{formatMoney(addition.amountCents)}
                </span>
              </div>
            );
          })}

          {/* Divider */}
          <div className="border-t" style={{ borderColor: "var(--border)" }} />

          {/* Result */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lucide.PiggyBank className="h-4 w-4" style={{ color: statusColor }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Safe to spend
              </span>
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color: statusColor }}>
              {formatMoney(safeToSpendCents)}
            </span>
          </div>

          {/* Daily math */}
          <div className="text-xs text-center pt-1" style={{ color: "var(--text-tertiary)" }}>
            {formatMoney(safeToSpendCents)} ÷ {daysRemaining} days = {formatMoney(dailyAllowanceCents)}/day
          </div>

          {/* Alternative calculation modes (collapsed by default) */}
          {data.budgetBasedCents !== data.cashBasedCents && (
            <AlternativeCalculations data={data} currentMode={mode} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Shows alternative calculation modes for transparency
 */
function AlternativeCalculations({ 
  data, 
  currentMode 
}: { 
  data: SafeToSpendData; 
  currentMode: "budget" | "cash";
}) {
  const [showAlternatives, setShowAlternatives] = React.useState(false);

  return (
    <div className="pt-2">
      <button
        onClick={() => setShowAlternatives(!showAlternatives)}
        className="w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded transition-colors"
        style={{ 
          color: "var(--text-tertiary)",
          backgroundColor: showAlternatives ? "var(--surface-2)" : "transparent"
        }}
      >
        <Lucide.Info className="h-3 w-3" />
        <span>Alternative calculations</span>
        <Lucide.ChevronDown
          className={`h-3 w-3 transition-transform ${showAlternatives ? "rotate-180" : ""}`}
        />
      </button>

      {showAlternatives && (
        <div className="mt-2 space-y-2 p-2 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }}>
          {currentMode !== "budget" && data.budgetTotalCents > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-secondary)" }}>Budget-based</span>
              <span className="font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {formatMoney(data.budgetBasedCents)}
              </span>
            </div>
          )}
          {currentMode !== "cash" && data.cashBalanceCents > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-secondary)" }}>Cash-based</span>
              <span className="font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {formatMoney(data.cashBasedCents)}
              </span>
            </div>
          )}
          {data.upcomingIncomeCents > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-secondary)" }}>
                With expected income (+{formatMoney(data.upcomingIncomeCents)})
              </span>
              <span className="font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {formatMoney(data.projectedCents)}
              </span>
            </div>
          )}
          <div className="text-[10px] pt-1" style={{ color: "var(--text-tertiary)" }}>
            These are alternative ways to calculate your safe-to-spend based on different data sources.
          </div>
        </div>
      )}
    </div>
  );
}

export default SafeToSpendModule;
