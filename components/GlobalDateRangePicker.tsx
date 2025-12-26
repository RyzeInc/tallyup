"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Lucide from "lucide-react";
import { useTimeRange } from "./TimeRangeProvider";
import { DateRangePreset } from "./utils";

// Grouped presets for the new 5-row layout
const PRESET_ROWS: { label?: string; presets: { key: DateRangePreset; label: string }[] }[] = [
  { presets: [{ key: "custom", label: "Custom Range" }] },
  { label: "Month", presets: [{ key: "month", label: "This Month" }, { key: "last-month", label: "Last Month" }] },
  { label: "Week", presets: [{ key: "week", label: "This Week" }, { key: "last-week", label: "Last Week" }] },
  { label: "Year", presets: [{ key: "year", label: "This Year" }, { key: "last-year", label: "Last Year" }] },
  { presets: [{ key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" }] },
];

// Quick presets for inline display (if needed)
const QUICK_PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "week", label: "This Week" },
  { key: "custom", label: "Custom Range" },
];

interface GlobalDateRangePickerProps {
  showAllPresets?: boolean;
}

export default function GlobalDateRangePicker({
  showAllPresets = false,
}: GlobalDateRangePickerProps) {
  const { preset, setPreset, customFrom, customTo, setCustomRange, label } = useTimeRange();
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(customFrom);
  const [tempTo, setTempTo] = useState(customTo);
  const [showCustom, setShowCustom] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowCustom(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open]);

  useEffect(() => {
    setTempFrom(customFrom);
    setTempTo(customTo);
  }, [customFrom, customTo]);

  function selectPreset(p: DateRangePreset) {
    if (p === "custom") {
      setShowCustom(true);
    } else {
      setPreset(p);
      setOpen(false);
      setShowCustom(false);
    }
  }

  function applyCustom() {
    setCustomRange(tempFrom, tempTo);
    setOpen(false);
    setShowCustom(false);
  }

  const displayLabel = label;

  return (
    <>
      {/* Compact chip trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--text)",
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Lucide.Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
        <span className="max-w-[120px] truncate">{displayLabel}</span>
        <Lucide.ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      </button>

      {/* Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setOpen(false);
              setShowCustom(false);
            }}
            aria-hidden="true"
          />

          {/* Dialog box */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Select date range"
            className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-150"
          >
            <div
              className="rounded-2xl border p-5 shadow-lg"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  {showCustom ? "Custom Date Range" : "Select Time Range"}
                </h2>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowCustom(false);
                  }}
                  className="rounded-full p-1.5 transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                </button>
              </div>

              {!showCustom ? (
                /* Preset rows - 5 row layout */
                <div className="space-y-3">
                  {PRESET_ROWS.map((row, rowIdx) => (
                    <div key={rowIdx}>
                      {row.presets.length === 1 ? (
                        /* Single button row (Custom) */
                        <button
                          onClick={() => selectPreset(row.presets[0].key)}
                          className={`w-full flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                            preset === row.presets[0].key && row.presets[0].key !== "custom"
                              ? "bg-[var(--accent-subtle)]"
                              : "hover:bg-[var(--surface-subtle)]"
                          }`}
                          style={{
                            border: `1px solid ${
                              preset === row.presets[0].key && row.presets[0].key !== "custom"
                                ? "var(--accent)"
                                : "var(--border)"
                            }`,
                            color:
                              preset === row.presets[0].key && row.presets[0].key !== "custom"
                                ? "var(--accent)"
                                : "var(--text)",
                          }}
                        >
                          <span>{row.presets[0].label}</span>
                          {preset === row.presets[0].key && row.presets[0].key !== "custom" && (
                            <Lucide.Check className="h-4 w-4" style={{ color: "var(--accent)" }} />
                          )}
                          {row.presets[0].key === "custom" && (
                            <Lucide.ChevronRight
                              className="h-4 w-4"
                              style={{ color: "var(--text-tertiary)" }}
                            />
                          )}
                        </button>
                      ) : (
                        /* Two-button row */
                        <div className="grid grid-cols-2 gap-2">
                          {row.presets.map((p) => (
                            <button
                              key={p.key}
                              onClick={() => selectPreset(p.key)}
                              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                                preset === p.key
                                  ? "bg-[var(--accent-subtle)]"
                                  : "hover:bg-[var(--surface-subtle)]"
                              }`}
                              style={{
                                border: `1px solid ${
                                  preset === p.key ? "var(--accent)" : "var(--border)"
                                }`,
                                color: preset === p.key ? "var(--accent)" : "var(--text)",
                              }}
                            >
                              <span>{p.label}</span>
                              {preset === p.key && (
                                <Lucide.Check className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Custom date picker */
                <div className="space-y-4">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="flex items-center gap-2 text-sm font-medium mb-2"
                    style={{ color: "var(--accent)" }}
                  >
                    <Lucide.ChevronLeft className="h-4 w-4" />
                    Back to presets
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        From
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
                        To
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

                  <button
                    onClick={applyCustom}
                    className="w-full rounded-lg py-3 text-sm font-semibold transition-colors"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-foreground)",
                    }}
                  >
                    Apply Custom Range
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
