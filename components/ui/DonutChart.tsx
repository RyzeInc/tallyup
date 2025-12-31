"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
// @ts-expect-error - Sector is available but not in types
import { Sector } from "recharts";
import { formatMoney } from "@/components/utils";

/**
 * DonutChart - Interactive donut chart with center content
 * 
 * Rules:
 * - Center space displays: Total, Net, or Selected slice summary
 * - Tapping a slice highlights it and updates center content
 * - Supports partial datasets (filtered views)
 * - No decorative-only charts - always has explanatory content
 */

export interface DonutSlice {
  name: string;
  value: number; // in cents
  color?: string;
  icon?: string;
}

interface DonutChartProps {
  /** Data slices to render */
  data: DonutSlice[];
  /** What to show in center when no slice is selected */
  centerLabel?: string;
  /** Total value to show in center (optional, computed from data if not provided) */
  centerValue?: number;
  /** Chart height in pixels */
  height?: number;
  /** Inner radius as percentage of outer (0-1) */
  innerRadiusRatio?: number;
  /** Color palette (falls back to defaults) */
  colors?: string[];
  /** Called when a slice is selected */
  onSliceSelect?: (slice: DonutSlice | null, index: number | null) => void;
  /** Show legend below chart */
  showLegend?: boolean;
  /** Format values as currency */
  formatAsCurrency?: boolean;
  /** Show percentages in legend */
  showPercentages?: boolean;
}

// Default color palette
const DEFAULT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "#6B7280", // gray fallback
];

// Active slice shape (expanded when selected)
type ActiveShapeProps = {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
};

const renderActiveShape = (props: ActiveShapeProps) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
      />
    </g>
  );
};

export function DonutChart({
  data,
  centerLabel = "Total",
  centerValue,
  height = 200,
  innerRadiusRatio = 0.65,
  colors = DEFAULT_COLORS,
  onSliceSelect,
  showLegend = true,
  formatAsCurrency = true,
  showPercentages = true,
}: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Compute total if not provided
  const total = useMemo(() => {
    if (centerValue !== undefined) return centerValue;
    return data.reduce((sum, slice) => sum + slice.value, 0);
  }, [data, centerValue]);

  // Get the selected slice info
  const selectedSlice = activeIndex !== null ? data[activeIndex] : null;

  // Handle slice click/tap
  const handleSliceClick = useCallback((_entry: unknown, index: number) => {
    const newIndex = activeIndex === index ? null : index;
    setActiveIndex(newIndex);
    
    if (onSliceSelect) {
      onSliceSelect(newIndex !== null ? data[index] : null, newIndex);
    }
  }, [activeIndex, data, onSliceSelect]);

  // Handle click outside (deselect)
  // Format value for display
  const formatValue = (value: number) => {
    if (formatAsCurrency) {
      return formatMoney(value);
    }
    return value.toLocaleString();
  };

  // Calculate percentage
  const getPercentage = (value: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // Don't render if no data
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
            No data to display
          </div>
        </div>
      </div>
    );
  }

  const outerRadius = Math.min(height / 2 - 10, 100);
  const innerRadius = outerRadius * innerRadiusRatio;

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div style={{ height, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={data.length > 1 ? 2 : 0}
              dataKey="value"
              activeIndex={activeIndex ?? undefined}
              activeShape={renderActiveShape}
              onClick={handleSliceClick}
              style={{ cursor: "pointer" }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || colors[index % colors.length]}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Content */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div className="text-center">
            {selectedSlice ? (
              <>
                <div
                  className="text-micro font-medium mb-0.5 truncate max-w-[80px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {selectedSlice.name}
                </div>
                <div
                  className="text-body font-bold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {formatValue(selectedSlice.value)}
                </div>
                {showPercentages && (
                  <div
                    className="text-micro"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {getPercentage(selectedSlice.value)}%
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className="text-micro font-medium mb-0.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {centerLabel}
                </div>
                <div
                  className="text-h2 font-bold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {formatValue(total)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {data.map((slice, index) => {
            const isActive = activeIndex === index;
            const color = slice.color || colors[index % colors.length];
            const percentage = getPercentage(slice.value);

            return (
              <button
                key={slice.name}
                onClick={() => handleSliceClick(slice, index)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--surface-2)" : "transparent",
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span
                  className="text-meta font-medium"
                  style={{ color: isActive ? "var(--text)" : "var(--text-secondary)" }}
                >
                  {slice.name}
                </span>
                {showPercentages && (
                  <span
                    className="text-meta"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {percentage}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * MiniDonutChart - Compact version for cards and lists
 */
interface MiniDonutChartProps {
  data: DonutSlice[];
  size?: number;
  centerText?: string;
  colors?: string[];
}

export function MiniDonutChart({
  data,
  size = 48,
  centerText,
  colors = DEFAULT_COLORS,
}: MiniDonutChartProps) {
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.7;

  if (data.length === 0) {
    return (
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          backgroundColor: "var(--surface-2)",
        }}
      >
        <span className="text-micro" style={{ color: "var(--text-tertiary)" }}>
          —
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={data.length > 1 ? 1 : 0}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
                stroke="none"
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center text */}
      {centerText && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: size * 0.2 }}
        >
          <span
            className="font-bold"
            style={{ color: "var(--text)" }}
          >
            {centerText}
          </span>
        </div>
      )}
    </div>
  );
}
