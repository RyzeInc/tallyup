"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

export interface PaydayInfo {
  id: string;
  ruleId: string;
  name: string;
  expectedDate: number;
  amountCents: number;
  confidence: number; // 0-100
}

export interface PaydayCountdownProps {
  nextPayday: PaydayInfo | null;
  upcomingIncome?: PaydayInfo[];
  isLoading?: boolean;
}

/**
 * Calculate days until a date
 */
function daysUntil(timestamp: number): number {
  const now = Date.now();
  const diff = timestamp - now;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/**
 * Format date for display
 */
function formatPaydayDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get confidence label
 */
function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 80) return { label: "Expected", color: "var(--success)" };
  if (confidence >= 50) return { label: "Likely", color: "var(--warning)" };
  return { label: "Estimated", color: "var(--text-tertiary)" };
}

/**
 * PaydayCountdownModule - Shows countdown to next expected income
 * 
 * Displays days until payday with a visual countdown ring.
 * Inspired by MoneyCoach's payday widget.
 */
export function PaydayCountdownModule({
  nextPayday,
  upcomingIncome = [],
  isLoading = false,
}: PaydayCountdownProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-5 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!nextPayday) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            <Lucide.Banknote className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              No Payday Detected
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Set up recurring income to track payday
            </div>
          </div>
          <Lucide.Plus
            className="h-5 w-5"
            style={{ color: "var(--text-tertiary)" }}
          />
        </div>
      </div>
    );
  }

  const days = daysUntil(nextPayday.expectedDate);
  const confidence = getConfidenceLabel(nextPayday.confidence);
  const isToday = days <= 0;
  const isSoon = days > 0 && days <= 3;

  // Calculate ring progress (countdown from 30 days)
  const maxDays = 30;
  const progressPercent = Math.max(0, Math.min(100, ((maxDays - days) / maxDays) * 100));

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: isToday ? "var(--success-subtle)" : "var(--surface)",
        border: `1px solid ${isToday ? "var(--success)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Countdown ring */}
        <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
          <svg
            width={64}
            height={64}
            className="transform -rotate-90"
            aria-hidden="true"
          >
            {/* Background track */}
            <circle
              cx={32}
              cy={32}
              r={28}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth={5}
            />
            {/* Progress arc */}
            <circle
              cx={32}
              cy={32}
              r={28}
              fill="none"
              stroke={isToday ? "var(--success)" : isSoon ? "var(--primary)" : "var(--primary)"}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={(2 * Math.PI * 28) * (1 - progressPercent / 100)}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <span
              className="text-xl font-bold tabular-nums"
              style={{ color: isToday ? "var(--success)" : "var(--text)" }}
            >
              {isToday ? "🎉" : days}
            </span>
            {!isToday && (
              <span
                className="text-[10px] uppercase tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                days
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "var(--surface-2)", color: confidence.color }}
            >
              {confidence.label}
            </span>
          </div>
          <div
            className="text-sm font-medium truncate"
            style={{ color: "var(--text)" }}
          >
            {nextPayday.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-base font-semibold tabular-nums"
              style={{ color: "var(--success)" }}
            >
              +{formatMoney(nextPayday.amountCents)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {isToday ? "Today!" : formatPaydayDate(nextPayday.expectedDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Additional upcoming income */}
      {upcomingIncome.length > 1 && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Also coming up
          </div>
          <div className="space-y-1.5">
            {upcomingIncome.slice(1, 3).map((income) => (
              <div key={income.id} className="flex items-center justify-between">
                <span className="text-sm truncate" style={{ color: "var(--text)" }}>
                  {income.name}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {formatPaydayDate(income.expectedDate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaydayCountdownModule;
