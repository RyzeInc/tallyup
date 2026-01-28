"use client";

import * as Lucide from "lucide-react";

/**
 * ModuleProgressPill - Learning module progress indicator
 * 
 * Shows module name with progress bar in a pill format.
 * Used in the coach dashboard to show active learning modules.
 */

interface ModuleProgressPillProps {
  name: string;
  progress: number; // 0-100
  completed?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function ModuleProgressPill({
  name,
  progress,
  completed = false,
  onClick,
  className = "",
}: ModuleProgressPillProps) {
  const isComplete = completed || progress >= 100;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl transition-all ${className}`}
      style={{
        padding: "var(--space-3) var(--space-4)",
        backgroundColor: isComplete ? "rgba(90, 148, 116, 0.1)" : "var(--surface)",
        border: `1px solid ${isComplete ? "rgba(90, 148, 116, 0.3)" : "var(--border)"}`,
        cursor: onClick ? "pointer" : "default",
        width: "100%",
        textAlign: "left",
      }}
      aria-label={`${name}: ${isComplete ? "Completed" : `${clampedProgress}% complete`}`}
    >
      {/* Module name */}
      <span
        className="flex-1 truncate font-medium"
        style={{
          fontSize: "var(--text-meta)",
          color: "var(--text)",
        }}
      >
        {name}
      </span>

      {/* Progress indicator */}
      {isComplete ? (
        <span
          className="flex items-center gap-1 shrink-0"
          style={{ color: "var(--success)" }}
        >
          <Lucide.CheckCircle2 style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: "var(--text-micro)", fontWeight: 600 }}>
            100%
          </span>
        </span>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          {/* Progress bar */}
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{
              width: 60,
              backgroundColor: "var(--border)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${clampedProgress}%`,
                backgroundColor: "var(--primary)",
              }}
            />
          </div>
          {/* Percentage */}
          <span
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              minWidth: 32,
              textAlign: "right",
            }}
          >
            {clampedProgress}%
          </span>
        </div>
      )}
    </button>
  );
}
