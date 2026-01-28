"use client";

import * as Lucide from "lucide-react";
import { centsToDollars } from "@/components/utils";

/**
 * DataInsightCard - Visual data cards for coach insights
 * 
 * Replaces wall-of-text data with scannable visual cards.
 * Follows the principle: Data → Visual card
 * 
 * Different from InsightCard which is for proactive insights -
 * this is specifically for displaying financial data in chat.
 */

export type DataCardType = 
  | "cashflow" 
  | "savings" 
  | "expense" 
  | "income"
  | "debt"
  | "goal"
  | "alert"
  | "tip"
  | "summary";

interface DataInsightCardProps {
  type: DataCardType;
  title: string;
  /** Primary value to highlight (e.g., "$4,730" or "-$300") */
  primaryValue?: string;
  /** Whether primary value is positive (green), negative (red), or neutral */
  sentiment?: "positive" | "negative" | "neutral";
  /** Key-value data rows */
  data?: Array<{ label: string; value: string; highlight?: boolean }>;
  /** Short insight message (max ~60 chars) */
  insight?: string;
  /** Optional footer text */
  footer?: string;
  /** Card position in sequence (e.g., "1/3") */
  position?: string;
  className?: string;
}

const TYPE_CONFIG: Record<DataCardType, { icon: React.ReactNode; color: string; bg: string }> = {
  cashflow: {
    icon: <Lucide.TrendingUp style={{ width: 18, height: 18 }} />,
    color: "var(--primary)",
    bg: "rgba(183, 101, 77, 0.1)",
  },
  savings: {
    icon: <Lucide.PiggyBank style={{ width: 18, height: 18 }} />,
    color: "var(--success)",
    bg: "rgba(90, 148, 116, 0.1)",
  },
  expense: {
    icon: <Lucide.Receipt style={{ width: 18, height: 18 }} />,
    color: "var(--warning)",
    bg: "rgba(219, 165, 82, 0.1)",
  },
  income: {
    icon: <Lucide.Wallet style={{ width: 18, height: 18 }} />,
    color: "var(--success)",
    bg: "rgba(90, 148, 116, 0.1)",
  },
  debt: {
    icon: <Lucide.CreditCard style={{ width: 18, height: 18 }} />,
    color: "var(--error)",
    bg: "rgba(198, 93, 93, 0.1)",
  },
  goal: {
    icon: <Lucide.Target style={{ width: 18, height: 18 }} />,
    color: "var(--primary)",
    bg: "rgba(183, 101, 77, 0.1)",
  },
  alert: {
    icon: <Lucide.AlertTriangle style={{ width: 18, height: 18 }} />,
    color: "var(--warning)",
    bg: "rgba(219, 165, 82, 0.1)",
  },
  tip: {
    icon: <Lucide.Lightbulb style={{ width: 18, height: 18 }} />,
    color: "var(--primary)",
    bg: "rgba(183, 101, 77, 0.1)",
  },
  summary: {
    icon: <Lucide.BarChart3 style={{ width: 18, height: 18 }} />,
    color: "var(--primary)",
    bg: "rgba(183, 101, 77, 0.1)",
  },
};

export default function DataInsightCard({
  type,
  title,
  primaryValue,
  sentiment = "neutral",
  data = [],
  insight,
  footer,
  position,
  className = "",
}: DataInsightCardProps) {
  const config = TYPE_CONFIG[type];
  
  const sentimentColor = {
    positive: "var(--success)",
    negative: "var(--error)",
    neutral: "var(--text)",
  }[sentiment];

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: config.bg,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: config.color }}>{config.icon}</div>
          <span
            className="font-semibold uppercase tracking-wide"
            style={{ fontSize: "var(--text-micro)", color: config.color }}
          >
            {title}
          </span>
        </div>
        {position && (
          <span
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--text-secondary)",
            }}
          >
            {position}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Primary value */}
        {primaryValue && (
          <div
            className="text-center mb-3"
            style={{
              fontSize: "var(--text-h1)",
              fontWeight: 700,
              color: sentimentColor,
            }}
          >
            {primaryValue}
          </div>
        )}

        {/* Data rows */}
        {data.length > 0 && (
          <div className="space-y-1 mb-3">
            {data.map((row, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center"
                style={{ fontSize: "var(--text-body)" }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span
                  style={{
                    color: row.highlight ? "var(--primary)" : "var(--text)",
                    fontWeight: row.highlight ? 600 : 400,
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Insight quote */}
        {insight && (
          <div
            className="mt-3 pt-3 border-t"
            style={{
              borderColor: "var(--border)",
              fontSize: "var(--text-meta)",
              color: "var(--text-secondary)",
              fontStyle: "italic",
            }}
          >
            &ldquo;{insight}&rdquo;
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div
            className="mt-2 text-center"
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--text-secondary)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper to format cents as currency
 */
export function formatMoney(cents: number): string {
  const dollars = parseFloat(centsToDollars(cents));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Helper to create a cashflow card from data
 */
export function createCashflowCard(
  incomeCents: number,
  expenseCents: number,
  monthLabel: string,
  position?: string
): React.ReactElement {
  const netCents = incomeCents - expenseCents;
  const isPositive = netCents >= 0;
  
  return (
    <DataInsightCard
      type="cashflow"
      title={`${monthLabel} Cash Flow`}
      primaryValue={`${isPositive ? "+" : ""}${formatMoney(netCents)}`}
      sentiment={isPositive ? "positive" : "negative"}
      position={position}
      data={[
        { label: "Income", value: formatMoney(incomeCents) },
        { label: "Expenses", value: formatMoney(expenseCents) },
      ]}
      insight={
        isPositive
          ? `You're earning ${formatMoney(netCents)} more than you spend`
          : `You're spending ${formatMoney(Math.abs(netCents))} more than you earn`
      }
    />
  );
}

/**
 * Helper to create a savings safety net card
 */
export function createSavingsCard(
  checkingCents: number,
  savingsCents: number,
  monthlyGapCents?: number,
  position?: string
): React.ReactElement {
  const totalCents = checkingCents + savingsCents;
  const monthsCovered = monthlyGapCents && monthlyGapCents > 0
    ? Math.floor(totalCents / monthlyGapCents)
    : null;

  return (
    <DataInsightCard
      type="savings"
      title="Savings Safety Net"
      primaryValue={formatMoney(totalCents)}
      sentiment={totalCents > 0 ? "positive" : "neutral"}
      position={position}
      data={[
        { label: "Checking", value: formatMoney(checkingCents) },
        { label: "Savings", value: formatMoney(savingsCents), highlight: true },
      ]}
      insight={
        monthsCovered
          ? `This covers ${monthsCovered} month${monthsCovered !== 1 ? "s" : ""} at your current pace`
          : "A healthy cushion for emergencies"
      }
    />
  );
}

/**
 * Helper to create an expense card
 */
export function createExpenseCard(
  name: string,
  amountCents: number,
  percentOfTotal?: number,
  context?: string,
  position?: string
): React.ReactElement {
  return (
    <DataInsightCard
      type="expense"
      title={`Top Expense: ${name}`}
      primaryValue={`${formatMoney(amountCents)}/mo`}
      sentiment="neutral"
      position={position}
      data={percentOfTotal ? [{ label: "% of spending", value: `${percentOfTotal}%` }] : []}
      insight={context || "Your largest recurring expense"}
    />
  );
}
