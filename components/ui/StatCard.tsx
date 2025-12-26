import { ReactNode } from "react";
import * as Lucide from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: ReactNode;
  className?: string;
}

export default function StatCard({
  title,
  value,
  sub,
  trend,
  trendValue,
  icon,
  className = "",
}: StatCardProps) {
  const TrendIcon =
    trend === "up"
      ? Lucide.TrendingUp
      : trend === "down"
        ? Lucide.TrendingDown
        : Lucide.Minus;
  const trendColor =
    trend === "up"
      ? "var(--success)"
      : trend === "down"
        ? "var(--danger)"
        : "var(--text-tertiary)";

  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="text-micro">{title}</div>
        {icon && (
          <div style={{ color: "var(--text-tertiary)" }}>{icon}</div>
        )}
      </div>
      <div
        className="mt-2 text-kpi tabular-nums"
        style={{ color: "var(--text)" }}
      >
        {value}
      </div>
      {(sub || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && trendValue && (
            <span
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: trendColor }}
            >
              <TrendIcon className="h-4 w-4" />
              {trendValue}
            </span>
          )}
          {sub && <span className="text-meta">{sub}</span>}
        </div>
      )}
    </div>
  );
}
