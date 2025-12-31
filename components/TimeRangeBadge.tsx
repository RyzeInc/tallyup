"use client";

import React from "react";
import { useTimeRange } from "@/src/components/timeRange/useTimeRange";

export default function TimeRangeBadge() {
  const { setSelection, label, isDefault } = useTimeRange();

  if (isDefault) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
    >
      <span>Viewing: {label}</span>
      <button
        onClick={() => setSelection({ kind: "preset", key: "this_month" })}
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}
      >
        Reset
      </button>
    </div>
  );
}
