"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";
import { ProgressRing } from "./ProgressRing";

export interface GoalPreview {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  remainingCents: number;
  monthlyContributionCents: number;
  periodContributionCents: number;
  icon?: string;
  color?: string;
}

export interface GoalsPreviewModuleProps {
  goals: GoalPreview[];
  isLoading?: boolean;
  maxItems?: number;
  onViewAll?: () => void;
  onGoalClick?: (goalId: string) => void;
}

/** Icon mapping for goals */
const GOAL_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  piggyBank: Lucide.PiggyBank,
  target: Lucide.Target,
  home: Lucide.Home,
  car: Lucide.Car,
  plane: Lucide.Plane,
  gift: Lucide.Gift,
  heart: Lucide.Heart,
  star: Lucide.Star,
  umbrella: Lucide.Umbrella,
  shield: Lucide.Shield,
  graduationCap: Lucide.GraduationCap,
  briefcase: Lucide.Briefcase,
  wallet: Lucide.Wallet,
  banknote: Lucide.Banknote,
  dollarSign: Lucide.DollarSign,
  trendingUp: Lucide.TrendingUp,
  creditCard: Lucide.CreditCard,
};

/**
 * GoalsPreviewModule - Shows top 1-2 active goals with progress bars
 * 
 * Displays goal progress, amount saved, and monthly contribution needed.
 * Inspired by MoneyCoach and Copilot goal tracking UIs.
 */
export function GoalsPreviewModule({
  goals,
  isLoading = false,
  maxItems = 2,
  onViewAll,
  onGoalClick,
}: GoalsPreviewModuleProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-20 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
                <div className="h-2 w-full rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Lucide.Target className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Set up goals to track your savings progress
          </span>
        </div>
      </div>
    );
  }

  const displayGoals = goals.slice(0, maxItems);
  const hasMore = goals.length > maxItems;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Lucide.Target className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Goals
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--primary)" }}
          >
            View all
          </button>
        )}
      </div>

      {/* Goals list */}
      <div className="px-4 pb-4 space-y-3">
        {displayGoals.map((goal) => {
          const percent = goal.targetCents > 0 
            ? Math.round((goal.currentCents / goal.targetCents) * 100) 
            : 0;
          const IconComponent = GOAL_ICONS[goal.icon ?? "target"] ?? Lucide.Target;
          const goalColor = goal.color || "var(--primary)";

          return (
            <button
              key={goal.id}
              onClick={() => onGoalClick?.(goal.id)}
              className="w-full text-left transition-colors hover:bg-[var(--surface-subtle)] rounded-xl p-3 -mx-1"
              disabled={!onGoalClick}
            >
              <div className="flex items-center gap-3">
                {/* Progress ring with icon */}
                <div className="relative flex-shrink-0">
                  <ProgressRing
                    percent={percent}
                    size={48}
                    strokeWidth={4}
                    color={goalColor}
                    trackColor="var(--surface-2)"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <IconComponent 
                      className="h-4 w-4" 
                      style={{ color: goalColor }} 
                    />
                  </div>
                </div>

                {/* Goal details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className="text-sm font-medium truncate" 
                      style={{ color: "var(--text)" }}
                    >
                      {goal.name}
                    </span>
                    <span 
                      className="text-xs tabular-nums" 
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {percent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div 
                    className="h-1.5 w-full rounded-full mb-1.5"
                    style={{ backgroundColor: "var(--surface-2)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: goalColor 
                      }}
                    />
                  </div>

                  {/* Amount info */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="tabular-nums" style={{ color: "var(--text)" }}>
                      {formatMoney(goal.currentCents, { compact: true })}
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {" "}/ {formatMoney(goal.targetCents, { compact: true })}
                      </span>
                    </span>
                    {goal.remainingCents > 0 && (
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {formatMoney(goal.remainingCents, { compact: true })} to go
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {/* Show more indicator */}
        {hasMore && onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full py-2 text-xs text-center transition-colors hover:bg-[var(--surface-subtle)] rounded-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            +{goals.length - maxItems} more goal{goals.length - maxItems !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    </div>
  );
}

export default GoalsPreviewModule;
