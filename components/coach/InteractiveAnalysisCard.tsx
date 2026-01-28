"use client";

import * as Lucide from "lucide-react";
import Card from "@/components/ui/Card";
import ActionButton from "./ActionButton";
import { formatMoney } from "@/components/utils";

/**
 * InteractiveAnalysisCard - Rich analysis card with actions
 * 
 * Used within coach responses to show financial analysis
 * with interactive elements and action buttons.
 */

type AnalysisType = "affordability" | "comparison" | "timeline" | "breakdown" | "custom";

interface AnalysisDataPoint {
  label: string;
  value: string | number;
  type?: "money" | "percent" | "text" | "delta";
  highlight?: boolean;
}

interface AnalysisAction {
  label: string;
  type?: "goal" | "budget" | "transfer" | "review" | "schedule" | "learn" | "custom";
  onClick: () => void;
}

interface InteractiveAnalysisCardProps {
  title: string;
  subtitle?: string;
  type?: AnalysisType;
  dataPoints: AnalysisDataPoint[];
  summary?: string;
  actions?: AnalysisAction[];
  className?: string;
}

const typeIcons: Record<AnalysisType, React.ReactNode> = {
  affordability: <Lucide.Calculator style={{ width: 18, height: 18 }} />,
  comparison: <Lucide.GitCompare style={{ width: 18, height: 18 }} />,
  timeline: <Lucide.Calendar style={{ width: 18, height: 18 }} />,
  breakdown: <Lucide.PieChart style={{ width: 18, height: 18 }} />,
  custom: <Lucide.BarChart3 style={{ width: 18, height: 18 }} />,
};

function formatValue(value: string | number, type?: string): string {
  if (type === "money" && typeof value === "number") {
    return formatMoney(value);
  }
  if (type === "percent" && typeof value === "number") {
    return `${value}%`;
  }
  if (type === "delta" && typeof value === "number") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${formatMoney(value)}`;
  }
  return String(value);
}

export default function InteractiveAnalysisCard({
  title,
  subtitle,
  type = "custom",
  dataPoints,
  summary,
  actions = [],
  className = "",
}: InteractiveAnalysisCardProps) {
  return (
    <Card className={className} padding="none">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "var(--primary)",
              color: "#FFFFFF",
            }}
          >
            {typeIcons[type]}
          </div>
          <div className="flex-1 min-w-0">
            <h4
              className="font-semibold"
              style={{ 
                fontSize: "var(--text-body)", 
                color: "var(--text)" 
              }}
            >
              {title}
            </h4>
            {subtitle && (
              <p
                className="mt-0.5"
                style={{ 
                  fontSize: "var(--text-meta)", 
                  color: "var(--text-secondary)" 
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Data points */}
        {dataPoints.length > 0 && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ backgroundColor: "var(--surface-2)" }}
          >
            {dataPoints.map((point, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3"
                style={{
                  paddingBottom: index < dataPoints.length - 1 ? 8 : 0,
                  borderBottom:
                    index < dataPoints.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {point.label}
                </span>
                <span
                  className="font-semibold"
                  style={{
                    fontSize: "var(--text-body)",
                    color: point.highlight ? "var(--primary)" : "var(--text)",
                  }}
                >
                  {formatValue(point.value, point.type)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <p
            style={{
              fontSize: "var(--text-meta)",
              color: "var(--text)",
              lineHeight: 1.5,
            }}
          >
            {summary}
          </p>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {actions.map((action, index) => (
              <ActionButton
                key={index}
                type={action.type}
                label={action.label}
                onClick={action.onClick}
                variant={index === 0 ? "filled" : "outlined"}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
