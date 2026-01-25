"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

export interface SafeToSpendData {
  totalAvailableCents: number;
  upcomingBillsCents: number;
  upcomingBillsCount: number;
  safeToSpendCents: number;
  dailyAllowanceCents: number;
  daysRemaining: number;
}

export interface SafeToSpendModuleProps {
  data: SafeToSpendData | null;
  isLoading?: boolean;
  /** If true, shows expanded breakdown */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * SafeToSpendModule - Shows daily safe spending allowance
 * 
 * Calculates: (Budget remaining - Upcoming bills) / Days left in period
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
            Set up budgets to see your safe-to-spend
          </span>
        </div>
      </div>
    );
  }

  const { dailyAllowanceCents, safeToSpendCents, daysRemaining, upcomingBillsCents, upcomingBillsCount, totalAvailableCents } = data;

  // Determine status color based on daily allowance
  const isWarning = dailyAllowanceCents >= 1000 && dailyAllowanceCents < 5000; // $10-50/day
  const isDanger = dailyAllowanceCents < 1000; // <$10/day

  const statusColor = isDanger ? "var(--danger)" : isWarning ? "var(--warning)" : "var(--success)";
  const statusBg = isDanger ? "var(--danger-subtle)" : isWarning ? "var(--warning-subtle)" : "var(--success-subtle)";

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
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              Safe to Spend
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

      {/* Expanded breakdown */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="pt-3 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            How this is calculated
          </div>

          {/* Budget available */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lucide.Wallet className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
              <span className="text-sm" style={{ color: "var(--text)" }}>Budget available</span>
            </div>
            <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
              {formatMoney(totalAvailableCents)}
            </span>
          </div>

          {/* Upcoming bills */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lucide.CalendarMinus className="h-4 w-4" style={{ color: "var(--warning)" }} />
              <span className="text-sm" style={{ color: "var(--text)" }}>
                Upcoming bills ({upcomingBillsCount})
              </span>
            </div>
            <span className="text-sm font-medium tabular-nums" style={{ color: "var(--warning)" }}>
              -{formatMoney(upcomingBillsCents)}
            </span>
          </div>

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
        </div>
      )}
    </div>
  );
}

export default SafeToSpendModule;
