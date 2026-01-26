"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

export interface ReviewAlertData {
  /** Number of transactions needing review */
  count: number;
  /** Optional: total amount of unreviewed transactions */
  totalAmountCents?: number;
  /** Optional: breakdown by type */
  breakdown?: {
    uncategorized?: number;
    recurring?: number;
    duplicates?: number;
  };
}

export interface ReviewAlertCardProps {
  data: ReviewAlertData;
  isLoading?: boolean;
  onAction: () => void;
  /** Visual style variant */
  variant?: "banner" | "card" | "prominent";
}

/**
 * ReviewAlertCard - Enhanced "needs attention" treatment
 * 
 * Three variants:
 * - "banner": Compact inline alert (current style)
 * - "card": Full card with more details
 * - "prominent": Large prominent card like Copilot's action cards
 */
export function ReviewAlertCard({
  data,
  isLoading = false,
  onAction,
  variant = "prominent",
}: ReviewAlertCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4 animate-pulse"
        style={{ backgroundColor: "var(--surface-subtle)" }}
      >
        <div className="h-16" />
      </div>
    );
  }

  if (data.count === 0) {
    return null;
  }

  // Banner variant - compact inline
  if (variant === "banner") {
    return (
      <button
        onClick={onAction}
        className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-colors hover:brightness-95"
        style={{
          backgroundColor: "var(--warning-subtle)",
          border: "1px solid var(--warning)",
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--warning)" }}
        >
          <Lucide.Inbox className="h-5 w-5" style={{ color: "#fff" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-medium" style={{ color: "var(--text)" }}>
            {data.count} transaction{data.count !== 1 ? "s" : ""} to review
          </div>
          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
            Tap to categorize
          </div>
        </div>
        <Lucide.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
      </button>
    );
  }

  // Card variant - medium detail
  if (variant === "card") {
    return (
      <button
        onClick={onAction}
        className="w-full rounded-2xl p-4 text-left transition-colors hover:brightness-95"
        style={{
          backgroundColor: "var(--warning-subtle)",
          border: "1px solid var(--warning)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--warning)" }}
          >
            <Lucide.AlertCircle className="h-6 w-6" style={{ color: "#fff" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
              {data.count} need{data.count === 1 ? "s" : ""} your attention
            </div>
            <div className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              Review and categorize these transactions to keep your finances accurate
            </div>
            {data.totalAmountCents !== undefined && (
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Total: {formatMoney(data.totalAmountCents)}
              </div>
            )}
          </div>
          <Lucide.ChevronRight className="h-5 w-5 shrink-0 mt-1" style={{ color: "var(--warning)" }} />
        </div>
      </button>
    );
  }

  // Prominent variant - Copilot-style action card
  return (
    <button
      onClick={onAction}
      className="w-full rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
      style={{
        background: "linear-gradient(135deg, var(--warning) 0%, #F59E0B 100%)",
        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.25)",
      }}
    >
      {/* Top section */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {/* Badge */}
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Lucide.Bell className="h-3.5 w-3.5 text-white" />
              <span className="text-xs font-medium text-white">Action needed</span>
            </div>
            
            {/* Count */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tabular-nums">
                {data.count}
              </span>
              <span className="text-lg font-medium text-white/90">
                transaction{data.count !== 1 ? "s" : ""}
              </span>
            </div>
            
            {/* Subtitle */}
            <div className="text-sm mt-1 text-white/80">
              waiting to be reviewed
            </div>
          </div>

          {/* Icon */}
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <Lucide.Inbox className="h-7 w-7 text-white" />
          </div>
        </div>
      </div>

      {/* Breakdown section (if available) */}
      {data.breakdown && (
        <div 
          className="px-4 py-2 flex items-center gap-3"
          style={{ backgroundColor: "rgba(0,0,0,0.1)" }}
        >
          {data.breakdown.uncategorized && data.breakdown.uncategorized > 0 && (
            <div className="flex items-center gap-1.5">
              <Lucide.HelpCircle className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs text-white/80">
                {data.breakdown.uncategorized} uncategorized
              </span>
            </div>
          )}
          {data.breakdown.recurring && data.breakdown.recurring > 0 && (
            <div className="flex items-center gap-1.5">
              <Lucide.RefreshCw className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs text-white/80">
                {data.breakdown.recurring} recurring
              </span>
            </div>
          )}
          {data.breakdown.duplicates && data.breakdown.duplicates > 0 && (
            <div className="flex items-center gap-1.5">
              <Lucide.Copy className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs text-white/80">
                {data.breakdown.duplicates} possible duplicates
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action button section */}
      <div 
        className="p-4 pt-3 flex items-center justify-between"
        style={{ backgroundColor: "rgba(0,0,0,0.05)" }}
      >
        <span className="text-sm font-semibold text-white">
          Review now
        </span>
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          <Lucide.ArrowRight className="h-4 w-4 text-white" />
        </div>
      </div>
    </button>
  );
}

export default ReviewAlertCard;
