"use client";

import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

interface SummaryStripProps {
  expectedTotal: number;
  loggedTotal: number;
  leftToLog: number;
  attentionCount: number;
  progressPercent: number;
  isLoading?: boolean;
}

export default function SummaryStrip({
  expectedTotal,
  loggedTotal,
  leftToLog,
  attentionCount,
  progressPercent,
  isLoading,
}: SummaryStripProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4 animate-pulse"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="h-16 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-4 md:gap-6">
        {/* Progress Ring */}
        <ProgressRing percent={progressPercent} size={64} />

        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatItem
            icon={Lucide.CircleDashed}
            label="Left to log"
            value={formatMoney(leftToLog)}
            highlight={leftToLog > 0}
          />
          <StatItem
            icon={Lucide.CheckCircle2}
            label="Logged"
            value={formatMoney(loggedTotal)}
            positive
          />
          <StatItem
            icon={Lucide.Target}
            label="Expected"
            value={formatMoney(expectedTotal)}
          />
          <StatItem
            icon={Lucide.AlertCircle}
            label="Attention"
            value={attentionCount.toString()}
            highlight={attentionCount > 0}
            isCount
          />
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ percent, size }: { percent: number; size: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={percent >= 100 ? "var(--success)" : "var(--primary)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
        style={{ color: "var(--text)" }}
      >
        {percent}%
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  highlight,
  positive,
  isCount,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
  isCount?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: highlight
            ? "var(--warning-subtle)"
            : positive
            ? "var(--success-subtle)"
            : "var(--surface-2)",
        }}
      >
        <Icon
          className="h-4 w-4"
          style={{
            color: highlight
              ? "var(--warning)"
              : positive
              ? "var(--success)"
              : "var(--text-tertiary)",
          }}
        />
      </div>
      <div className="min-w-0">
        <div
          className="text-xs truncate"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </div>
        <div
          className={`font-semibold truncate ${isCount ? "text-lg" : "text-sm tabular-nums"}`}
          style={{
            color: highlight
              ? "var(--warning)"
              : positive
              ? "var(--success)"
              : "var(--text)",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
