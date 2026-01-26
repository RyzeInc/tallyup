"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

// Types matching the Convex query output
type AlertSeverity = "critical" | "warning" | "info";
type AlertActionType = "add_transaction" | "adjust_budget" | "add_income" | "link_account" | "review_goal" | "dismiss";

interface AlertSuggestion {
  action: string;
  actionType: AlertActionType;
  label: string;
}

interface RelatedEntity {
  type: "budget" | "goal" | "account" | "recurring" | "transaction";
  id: string;
  name: string;
}

export interface AccountabilityAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  expectedCents?: number;
  actualCents?: number;
  gapCents?: number;
  suggestions: AlertSuggestion[];
  relatedEntities?: RelatedEntity[];
}

export interface AccountabilitySummary {
  projectedMonthlyIncomeCents: number;
  actualMonthlyIncomeCents: number;
  incomeGapCents: number;
  totalBudgetedCents: number;
  budgetCoveragePercent: number;
  totalCashBalanceCents: number;
  cashRunwayDays: number;
  totalCommitmentsCents: number;
  commitmentToIncomeRatio: number;
}

export interface AccountabilityData {
  healthScore: number;
  summary: AccountabilitySummary;
  alerts: AccountabilityAlert[];
  alertCounts: {
    critical: number;
    warning: number;
    info: number;
  };
  checkedAt: number;
}

export interface AccountabilityCardProps {
  data: AccountabilityData | null;
  isLoading?: boolean;
  onAction?: (actionType: AlertActionType, alertId: string, relatedEntity?: RelatedEntity) => void;
  onDismiss?: (alertId: string) => void;
  /** Maximum number of alerts to show before "show more" */
  maxAlerts?: number;
}

/** Alert type icon mapping - defined outside component to prevent recreation */
const ALERT_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  budget_exceeds_income: Lucide.TrendingDown,
  budget_exceeds_balance: Lucide.Wallet,
  income_gap: Lucide.AlertCircle,
  commitment_overload: Lucide.Scale,
  missing_income_tracking: Lucide.CircleDollarSign,
  cash_runway_short: Lucide.Clock,
  goal_unrealistic: Lucide.Target,
  spending_exceeds_plan: Lucide.TrendingUp,
};

/** Action type icon mapping - defined outside component to prevent recreation */
const ACTION_ICON_MAP: Record<AlertActionType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  add_transaction: Lucide.Plus,
  adjust_budget: Lucide.Sliders,
  add_income: Lucide.DollarSign,
  link_account: Lucide.Link,
  review_goal: Lucide.Target,
  dismiss: Lucide.X,
};

/** Severity colors */
const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: "var(--danger-subtle)",
    border: "var(--danger)",
    text: "var(--danger)",
    icon: "var(--danger)",
  },
  warning: {
    bg: "var(--warning-subtle)",
    border: "var(--warning)",
    text: "var(--warning)",
    icon: "var(--warning)",
  },
  info: {
    bg: "var(--primary-subtle)",
    border: "var(--primary)",
    text: "var(--primary)",
    icon: "var(--primary)",
  },
};

/**
 * Health Score Ring - Visual indicator of financial health
 */
function HealthScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  
  // Color based on score
  let color = "var(--success)";
  if (score < 50) color = "var(--danger)";
  else if (score < 75) color = "var(--warning)";
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Health
        </span>
      </div>
    </div>
  );
}

/**
 * Single Alert Card
 */
function AlertCard({
  alert,
  onAction,
  onDismiss,
  expanded = false,
  onToggleExpand,
}: {
  alert: AccountabilityAlert;
  onAction?: (actionType: AlertActionType, relatedEntity?: RelatedEntity) => void;
  onDismiss?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const colors = SEVERITY_COLORS[alert.severity];
  const AlertIcon = ALERT_ICON_MAP[alert.type] ?? Lucide.AlertTriangle;
  
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full p-3 text-left flex items-start gap-3"
        disabled={!onToggleExpand}
      >
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.border }}
        >
          <AlertIcon className="h-4 w-4 text-white" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {alert.title}
              </div>
              {!expanded && (
                <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-secondary)" }}>
                  {alert.description}
                </div>
              )}
            </div>
            
            {/* Severity badge */}
            <span
              className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                backgroundColor: colors.border,
                color: "white",
              }}
            >
              {alert.severity}
            </span>
          </div>
        </div>
        
        {/* Expand indicator */}
        {onToggleExpand && (
          <Lucide.ChevronDown
            className={`h-4 w-4 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--text-tertiary)" }}
          />
        )}
      </button>
      
      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Full description */}
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {alert.description}
          </p>
          
          {/* Gap visualization */}
          {alert.expectedCents !== undefined && alert.actualCents !== undefined && (
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Expected
                  </div>
                  <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {formatMoney(alert.expectedCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Actual
                  </div>
                  <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {formatMoney(alert.actualCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Gap
                  </div>
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: colors.text }}
                  >
                    {formatMoney(Math.abs(alert.gapCents ?? 0))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Related entities */}
          {alert.relatedEntities && alert.relatedEntities.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-medium" style={{ color: "var(--text-tertiary)" }}>
                Related
              </div>
              <div className="flex flex-wrap gap-1.5">
                {alert.relatedEntities.map((entity) => (
                  <button
                    key={`${entity.type}-${entity.id}`}
                    onClick={() => onAction?.("adjust_budget", entity)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors hover:brightness-95"
                    style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {entity.type === "budget" && <Lucide.Wallet className="h-3 w-3" />}
                    {entity.type === "goal" && <Lucide.Target className="h-3 w-3" />}
                    {entity.type === "account" && <Lucide.Landmark className="h-3 w-3" />}
                    {entity.type === "recurring" && <Lucide.RefreshCw className="h-3 w-3" />}
                    <span className="truncate max-w-[100px]">{entity.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {alert.suggestions.map((suggestion, idx) => {
              const ActionIcon = ACTION_ICON_MAP[suggestion.actionType] ?? Lucide.ArrowRight;
              const isPrimary = idx === 0;
              
              return (
                <button
                  key={suggestion.action}
                  onClick={() => onAction?.(suggestion.actionType)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isPrimary ? "hover:brightness-110" : "hover:bg-[var(--surface-subtle)]"
                  }`}
                  style={{
                    backgroundColor: isPrimary ? colors.border : "var(--surface)",
                    color: isPrimary ? "white" : "var(--text)",
                  }}
                >
                  <ActionIcon className="h-3.5 w-3.5" />
                  {suggestion.label}
                </button>
              );
            })}
            
            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Lucide.X className="h-3.5 w-3.5" />
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AccountabilityCard - Main dashboard component for financial accountability
 * 
 * Shows:
 * 1. Overall financial health score
 * 2. Key summary metrics
 * 3. Expandable alerts with actions
 */
export function AccountabilityCard({
  data,
  isLoading = false,
  onAction,
  onDismiss,
  maxAlerts = 3,
}: AccountabilityCardProps) {
  const [expandedAlertId, setExpandedAlertId] = React.useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = React.useState(false);
  
  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-3 w-48 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return null;
  }
  
  const { healthScore, summary, alerts, alertCounts } = data;
  const totalAlerts = alerts.length;
  const hasAlerts = totalAlerts > 0;
  const displayedAlerts = showAllAlerts ? alerts : alerts.slice(0, maxAlerts);
  const hiddenCount = totalAlerts - maxAlerts;
  
  // Determine overall status
  const isHealthy = healthScore >= 75;
  const isWarning = healthScore >= 50 && healthScore < 75;
  const isCritical = healthScore < 50;
  
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header with health score */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Health score ring */}
          <HealthScoreRing score={healthScore} />
          
          {/* Summary text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Financial Health Check
              </span>
              {!hasAlerts && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "var(--success-subtle)", color: "var(--success)" }}
                >
                  <Lucide.Check className="h-3 w-3" />
                  All good
                </span>
              )}
            </div>
            
            {hasAlerts ? (
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                {alertCounts.critical > 0 && (
                  <span className="flex items-center gap-1" style={{ color: "var(--danger)" }}>
                    <Lucide.AlertCircle className="h-3.5 w-3.5" />
                    {alertCounts.critical} critical
                  </span>
                )}
                {alertCounts.warning > 0 && (
                  <span className="flex items-center gap-1" style={{ color: "var(--warning)" }}>
                    <Lucide.AlertTriangle className="h-3.5 w-3.5" />
                    {alertCounts.warning} warning
                  </span>
                )}
                {alertCounts.info > 0 && (
                  <span className="flex items-center gap-1" style={{ color: "var(--primary)" }}>
                    <Lucide.Info className="h-3.5 w-3.5" />
                    {alertCounts.info} info
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Your budgets, income, and accounts are in sync
              </div>
            )}
            
            {/* Quick stats */}
            <div className="flex items-center gap-4 mt-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              <span>
                <strong style={{ color: "var(--text-secondary)" }}>{summary.cashRunwayDays}d</strong> cash runway
              </span>
              <span>
                <strong style={{ color: "var(--text-secondary)" }}>{summary.budgetCoveragePercent}%</strong> budget coverage
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Alerts list */}
      {hasAlerts && (
        <div className="px-4 pb-4 space-y-2">
          {displayedAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              expanded={expandedAlertId === alert.id}
              onToggleExpand={() => setExpandedAlertId(
                expandedAlertId === alert.id ? null : alert.id
              )}
              onAction={(actionType, entity) => onAction?.(actionType, alert.id, entity)}
              onDismiss={() => onDismiss?.(alert.id)}
            />
          ))}
          
          {/* Show more/less button */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="w-full py-2 text-xs font-medium text-center transition-colors hover:bg-[var(--surface-subtle)] rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              {showAllAlerts ? (
                <>
                  <Lucide.ChevronUp className="h-3.5 w-3.5 inline mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <Lucide.ChevronDown className="h-3.5 w-3.5 inline mr-1" />
                  Show {hiddenCount} more alert{hiddenCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountabilityCard;
