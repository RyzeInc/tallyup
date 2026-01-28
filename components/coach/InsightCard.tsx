"use client";

import * as Lucide from "lucide-react";
import Button from "@/components/ui/Button";

/**
 * InsightCard - Proactive financial insight card
 * 
 * Used for AI-generated insights and recommendations.
 */

type InsightPriority = "high" | "medium" | "low";
type InsightType = "anomaly" | "opportunity" | "habit" | "warning" | "celebration";

interface InsightAction {
  label: string;
  onClick: () => void;
}

interface InsightCardProps {
  type: InsightType;
  priority?: InsightPriority;
  title: string;
  description: string;
  detail?: string;
  actions?: InsightAction[];
  onDismiss?: () => void;
  onSave?: () => void;
  isNew?: boolean;
  className?: string;
}

const typeConfig: Record<InsightType, { icon: React.ReactNode; color: string }> = {
  anomaly: { 
    icon: <Lucide.AlertTriangle style={{ width: 18, height: 18 }} />, 
    color: "var(--danger)" 
  },
  opportunity: { 
    icon: <Lucide.Lightbulb style={{ width: 18, height: 18 }} />, 
    color: "var(--primary)" 
  },
  habit: { 
    icon: <Lucide.TrendingUp style={{ width: 18, height: 18 }} />, 
    color: "var(--sea-green)" 
  },
  warning: { 
    icon: <Lucide.AlertCircle style={{ width: 18, height: 18 }} />, 
    color: "var(--danger)" 
  },
  celebration: { 
    icon: <Lucide.PartyPopper style={{ width: 18, height: 18 }} />, 
    color: "var(--success)" 
  },
};

export default function InsightCard({
  type,
  priority = "medium",
  title,
  description,
  detail,
  actions = [],
  onDismiss,
  onSave,
  isNew = false,
  className = "",
}: InsightCardProps) {
  const config = typeConfig[type];

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        backgroundColor: "var(--surface)",
        border: `1px solid ${isNew ? config.color : "var(--border)"}`,
        borderLeftWidth: 4,
        borderLeftColor: config.color,
      }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="shrink-0 flex items-center justify-center rounded-lg"
              style={{
                width: 36,
                height: 36,
                backgroundColor: `${config.color}15`,
                color: config.color,
              }}
            >
              {config.icon}
            </div>

            {/* Title & description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4
                  className="font-semibold"
                  style={{ 
                    fontSize: "var(--text-body)", 
                    color: "var(--text)" 
                  }}
                >
                  {title}
                </h4>
                {isNew && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: config.color,
                      color: "#FFFFFF",
                    }}
                  >
                    New
                  </span>
                )}
              </div>
              <p
                className="mt-1"
                style={{ 
                  fontSize: "var(--text-meta)", 
                  color: "var(--text-secondary)" 
                }}
              >
                {description}
              </p>
            </div>
          </div>

          {/* Actions menu */}
          <div className="flex items-center gap-1 shrink-0">
            {onSave && (
              <button
                onClick={onSave}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Save insight"
              >
                <Lucide.Bookmark style={{ width: 16, height: 16 }} />
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Dismiss"
              >
                <Lucide.X style={{ width: 16, height: 16 }} />
              </button>
            )}
          </div>
        </div>

        {/* Detail text */}
        {detail && (
          <div
            className="px-3 py-2 rounded-lg"
            style={{
              backgroundColor: "var(--surface-2)",
              fontSize: "var(--text-meta)",
              color: "var(--text)",
            }}
          >
            {detail}
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions.map((action, index) => (
              <Button
                key={index}
                size="sm"
                variant={index === 0 ? "primary" : "ghost"}
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
