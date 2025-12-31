"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { PresetSelectionKey, TimeRangeSelection } from "@/src/lib/timeRange/types";

interface TimeRangePickerModalProps {
  open: boolean;
  selection: TimeRangeSelection;
  onSelect: (next: TimeRangeSelection) => void;
  onClose: () => void;
}

const PRESET_GRID: { key: PresetSelectionKey; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_year", label: "This Year" },
  { key: "last_year", label: "Last Year" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
];

function todayYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function TimeRangePickerModal({
  open,
  selection,
  onSelect,
  onClose,
}: TimeRangePickerModalProps) {
  const [showCustom, setShowCustom] = useState(false);
  const defaultDate = useMemo(() => todayYYYYMMDD(), []);

  const [tempFrom, setTempFrom] = useState(
    selection.kind === "custom" ? selection.from : defaultDate
  );
  const [tempTo, setTempTo] = useState(
    selection.kind === "custom" ? selection.to : defaultDate
  );

  useEffect(() => {
    if (!open) return;
    setShowCustom(false);
    setTempFrom(selection.kind === "custom" ? selection.from : defaultDate);
    setTempTo(selection.kind === "custom" ? selection.to : defaultDate);
  }, [open, selection, defaultDate]);

  if (!open) return null;

  const isCustomSelected = selection.kind === "custom";

  function applyCustom() {
    if (!isValidDateString(tempFrom) || !isValidDateString(tempTo)) return;
    if (tempFrom > tempTo) return;
    onSelect({ kind: "custom", from: tempFrom, to: tempTo });
  }

  function selectPreset(key: PresetSelectionKey) {
    onSelect({ kind: "preset", key });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select time range"
        className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-150"
      >
        <div
          className="rounded-2xl border p-5 shadow-xl"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              {showCustom ? "Custom Range" : "Select Time Range"}
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 transition-colors hover:bg-[var(--surface-subtle)]"
              aria-label="Close"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>

          {!showCustom ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowCustom(true)}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  border: `1px solid ${
                    isCustomSelected ? "var(--accent)" : "var(--border)"
                  }`,
                  backgroundColor: isCustomSelected
                    ? "var(--accent-subtle)"
                    : "var(--surface)",
                  color: isCustomSelected ? "var(--accent)" : "var(--text)",
                }}
              >
                <span>Custom Range</span>
                <Lucide.ChevronRight
                  className="h-4 w-4"
                  style={{ color: "var(--text-tertiary)" }}
                />
              </button>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_GRID.map((preset) => {
                  const selected =
                    selection.kind === "preset" && selection.key === preset.key;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => selectPreset(preset.key)}
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors"
                      style={{
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        backgroundColor: selected
                          ? "var(--accent-subtle)"
                          : "var(--surface)",
                        color: selected ? "var(--accent)" : "var(--text)",
                      }}
                    >
                      <span>{preset.label}</span>
                      {selected && (
                        <Lucide.Check className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setShowCustom(false)}
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--accent)" }}
              >
                <Lucide.ChevronLeft className="h-4 w-4" />
                Back
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Start date
                  </label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--input)",
                      color: "var(--text)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    End date
                  </label>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--input)",
                      color: "var(--text)",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelect({ kind: "preset", key: "this_month" })}
                  className="flex-1 rounded-lg py-3 text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text)",
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={applyCustom}
                  className="flex-1 rounded-lg py-3 text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-foreground)",
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
