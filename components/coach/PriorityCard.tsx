"use client";

import * as Lucide from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * PriorityCard - Dynamic priority insight card
 * 
 * Shows the most important financial insight for today
 * with contextual actions and dismissal options.
 */

type PriorityLevel = "high" | "medium" | "low";
type PriorityType = "goal" | "spending" | "bill" | "opportunity" | "alert";

interface PriorityAction {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  onClick: () => void;
}

interface PriorityCardProps {
  type: PriorityType;
  priority?: PriorityLevel;
  title: string;
  description: string;
  icon?: React.ReactNode;
  progress?: {
    current: number;
    target: number;
    label?: string;
  };
  actions?: PriorityAction[];
  onDismiss?: () => void;
  className?: string;
}

const typeIcons: Record<PriorityType, React.ReactNode> = {
  goal: <Lucide.Target style={{ width: 20, height: 20 }} />,
  spending: <Lucide.TrendingUp style={{ width: 20, height: 20 }} />,
  bill: <Lucide.Calendar style={{ width: 20, height: 20 }} />,
  opportunity: <Lucide.Lightbulb style={{ width: 20, height: 20 }} />,
  alert: <Lucide.AlertTriangle style={{ width: 20, height: 20 }} />,
};

const priorityColors: Record<PriorityLevel, { bg: string; border: string; icon: string }> = {
  high: { 
    bg: "rgba(196, 88, 88, 0.08)", 
    border: "rgba(196, 88, 88, 0.3)", 
    icon: "var(--danger)" 
  },
  medium: { 
    bg: "rgba(196, 114, 74, 0.08)", 
    border: "rgba(196, 114, 74, 0.3)", 
    icon: "var(--primary)" 
  },
  low: { 
    bg: "rgba(90, 148, 116, 0.08)", 
    border: "rgba(90, 148, 116, 0.3)", 
    icon: "var(--success)" 
  },
};

export default function PriorityCard({
  type,
  priority = "medium",
  title,
  description,
  icon,
  progress,
  actions = [],
  onDismiss,
  className = "",
}: PriorityCardProps) {
  const colors = priorityColors[priority];
  const typeIcon = icon || typeIcons[type];

  const progressPct = progress 
    ? Math.min(100, Math.round((progress.current / progress.target) * 100))
    : null;

  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 40,
                height: 40,
                backgroundColor: "var(--surface)",
                color: colors.icon,
              }}
            >
              {typeIcon}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold truncate"
                style={{ 
                  fontSize: "var(--text-body)", 
                  color: "var(--text)" 
                }}
              >
                {title}
              </h3>
              <p
                className="mt-0.5"
                style={{ 
                  fontSize: "var(--text-meta)", 
                  color: "var(--text-secondary)" 
                }}
              >
                {description}
              </p>
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="shrink-0 p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Dismiss"
            >
              <Lucide.X style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {progress && progressPct !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                style={{ 
                  fontSize: "var(--text-micro)", 
                  color: "var(--text-secondary)" 
                }}
              >
                {progress.label || `${progressPct}% complete`}
              </span>
              <span
                style={{ 
                  fontSize: "var(--text-micro)", 
                  fontWeight: 600,
                  color: "var(--text)" 
                }}
              >
                {progressPct}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: colors.icon,
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? "primary" : "ghost")}
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
