import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-[var(--success)]" : trend === "down" ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]";

  return (
    <div
      className={`rounded-xl border bg-[var(--card)] p-4 lg:p-5 ${className}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
          {title}
        </div>
        {icon && (
          <div className="text-[var(--text-tertiary)]">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)] text-money">
        {value}
      </div>
      {(sub || trend) && (
        <div className="mt-1 flex items-center gap-2">
          {trend && trendValue && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {trendValue}
            </span>
          )}
          {sub && (
            <span className="text-xs text-[var(--text-tertiary)]">{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}
