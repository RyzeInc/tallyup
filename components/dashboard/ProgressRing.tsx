"use client";

import * as React from "react";

export interface ProgressRingProps {
  /** Percentage complete (0-100) */
  percent: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Color of the progress arc. Defaults to auto-color based on percent */
  color?: string;
  /** Background track color */
  trackColor?: string;
  /** Whether to show the percentage label in the center */
  showLabel?: boolean;
  /** Custom label to show instead of percentage */
  label?: React.ReactNode;
  /** Whether to animate the progress */
  animated?: boolean;
}

/**
 * ProgressRing - A circular progress indicator
 * 
 * Used for budget health visualization, goal progress, etc.
 * Supports customizable colors and auto-coloring based on status.
 */
export function ProgressRing({
  percent,
  size = 48,
  strokeWidth = 4,
  color,
  trackColor = "var(--surface-2)",
  showLabel = true,
  label,
  animated = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (clampedPercent / 100) * circumference;

  // Auto-determine color based on percentage if not specified
  const progressColor = color ?? (
    clampedPercent >= 100 ? "var(--danger)" :
    clampedPercent >= 80 ? "var(--warning)" :
    "var(--success)"
  );

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: animated ? "stroke-dashoffset 0.5s ease, stroke 0.3s ease" : "none",
          }}
        />
      </svg>
      {showLabel && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: size * 0.22, fontWeight: 600, color: "var(--text)" }}
        >
          {label ?? `${Math.round(clampedPercent)}%`}
        </div>
      )}
    </div>
  );
}

export default ProgressRing;
