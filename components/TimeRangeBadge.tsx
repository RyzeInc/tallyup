"use client";

import React from "react";
import { useTimeRange } from "@/components/TimeRangeProvider";

export default function TimeRangeBadge() {
  const { preset, setPreset, label } = useTimeRange();

  if (preset === "week") return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
    >
      <span>Viewing: {label}</span>
      <button
        onClick={() => setPreset("week")}
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}
      >
        Reset
      </button>
    </div>
  );
}
