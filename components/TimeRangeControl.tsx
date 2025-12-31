"use client";

import * as Lucide from "lucide-react";
import { useTimeRange } from "@/src/components/timeRange/useTimeRange";

export default function TimeRangeControl() {
  const { label, openPicker, isPickerOpen } = useTimeRange();

  return (
    <button
      onClick={openPicker}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--surface)",
        color: "var(--text)",
      }}
      aria-haspopup="dialog"
      aria-expanded={isPickerOpen}
    >
      <Lucide.Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      <span className="max-w-[140px] truncate">{label}</span>
      <Lucide.ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
    </button>
  );
}
