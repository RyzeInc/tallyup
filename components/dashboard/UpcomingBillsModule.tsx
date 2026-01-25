"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";
import Link from "next/link";

export interface UpcomingBill {
  id: string;
  ruleId: string;
  name: string;
  expectedDate: number;
  amountCents: number;
  type: "expense" | "income";
  category?: string;
  state: string; // "upcoming" | "due" | "matched" | "missed" | "skipped"
}

export interface UpcomingBillsModuleProps {
  bills: UpcomingBill[];
  isLoading?: boolean;
  maxItems?: number;
}

/**
 * Format relative date for upcoming bills
 */
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));

  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `in ${days} days`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * UpcomingBillsModule - Shows next 3-5 recurring charges
 * 
 * Horizontal scrollable cards showing upcoming bills with dates and amounts.
 * Inspired by Copilot and MoneyCoach upcoming sections.
 */
export function UpcomingBillsModule({
  bills,
  isLoading = false,
  maxItems = 5,
}: UpcomingBillsModuleProps) {
  const displayBills = bills.slice(0, maxItems);

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[140px] h-[80px] rounded-xl animate-pulse"
              style={{ backgroundColor: "var(--surface-2)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (displayBills.length === 0) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-h3 font-semibold" style={{ color: "var(--text)" }}>
            Upcoming Bills
          </h3>
        </div>
        <div className="flex items-center gap-3 py-4">
          <Lucide.CalendarCheck className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No upcoming bills scheduled
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-h3 font-semibold" style={{ color: "var(--text)" }}>
          Upcoming Bills
        </h3>
        <Link
          href="/recurring"
          className="text-sm font-medium"
          style={{ color: "var(--primary)" }}
        >
          View all
        </Link>
      </div>

      {/* Horizontal scrollable cards */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {displayBills.map((bill) => {
          const isDue = bill.state === "due";
          const isToday = formatRelativeDate(bill.expectedDate) === "Today";

          return (
            <Link
              key={bill.id}
              href={`/recurring?ruleId=${bill.ruleId}`}
              className="flex-shrink-0 rounded-xl p-3 transition-all hover:scale-[1.02]"
              style={{
                scrollSnapAlign: "start",
                width: 140,
                backgroundColor: isDue || isToday ? "var(--warning-subtle)" : "var(--surface-2)",
                border: `1px solid ${isDue || isToday ? "var(--warning)" : "var(--border)"}`,
              }}
            >
              {/* Date badge */}
              <div
                className="text-xs font-medium mb-2"
                style={{
                  color: isDue || isToday ? "var(--warning)" : "var(--text-secondary)",
                }}
              >
                {formatRelativeDate(bill.expectedDate)}
              </div>

              {/* Bill name */}
              <div
                className="text-sm font-medium truncate mb-1"
                style={{ color: "var(--text)" }}
              >
                {bill.name}
              </div>

              {/* Amount */}
              <div
                className="text-base font-semibold tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {formatMoney(bill.amountCents)}
              </div>
            </Link>
          );
        })}

        {/* "See more" card if there are more bills */}
        {bills.length > maxItems && (
          <Link
            href="/recurring"
            className="flex-shrink-0 rounded-xl p-3 flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
            style={{
              scrollSnapAlign: "start",
              width: 100,
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <Lucide.ChevronRight
              className="h-5 w-5 mb-1"
              style={{ color: "var(--text-tertiary)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              +{bills.length - maxItems} more
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default UpcomingBillsModule;
