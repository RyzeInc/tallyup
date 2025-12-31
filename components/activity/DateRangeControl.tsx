"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Lucide from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";

// All available date range presets
export type DateRangePreset =
  | "THIS_MONTH"
  | "LAST_30"
  | "CUSTOM";

const presetLabels: Record<DateRangePreset, string> = {
  THIS_MONTH: "This Month",
  LAST_30: "Last 30 Days",
  CUSTOM: "Custom",
};

export default function DateRangeControl({
  range,
  setRange,
  from,
  to,
  setFrom,
  setTo,
}: {
  range: string;
  setRange: (r: string) => void;
  from: string;
  to: string;
  setFrom: (s: string) => void;
  setTo: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(from);
  const [tempTo, setTempTo] = useState(to);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open]);

  useEffect(() => {
    setTempFrom(from);
    setTempTo(to);
  }, [from, to]);

  const presets: DateRangePreset[] = ["THIS_MONTH", "LAST_30", "CUSTOM"];

  function selectMode(m: DateRangePreset) {
    setRange(m);
    if (m !== "CUSTOM") {
      setOpen(false);
    }
  }

  function applyCustom() {
    setFrom(tempFrom);
    setTo(tempTo);
    setOpen(false);
  }

  const displayLabel =
    range === "CUSTOM" && from && to
      ? `${from} – ${to}`
      : presetLabels[range as DateRangePreset] || presetLabels.THIS_MONTH;

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
        <span>{displayLabel}</span>
        <Lucide.ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Select date range"
            className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-200"
          >
            <div
              className="rounded-t-2xl border-t border-x p-4 pb-8 max-h-[85vh] overflow-y-auto"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center mb-3">
                <div
                  className="h-1 w-10 rounded-full"
                  style={{ backgroundColor: "var(--border)" }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-h2" style={{ color: "var(--text)" }}>
                  Date Range
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 hover:bg-[var(--surface-subtle)] transition-colors"
                  aria-label="Close"
                >
                  <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              {/* Preset options - grid layout for more items */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {presets.map((m) => (
                  <button
                    key={m}
                    onClick={() => selectMode(m)}
                    className={`text-left rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      range === m ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--surface-subtle)]"
                    }`}
                    style={{
                      color: range === m ? "var(--accent)" : "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {presetLabels[m]}
                  </button>
                ))}
              </div>

              {/* Custom date pickers */}
              {range === "custom" && (
                <div
                  className="space-y-4 border-t pt-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* From date */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        className="text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        From
                      </label>
                      <button
                        onClick={() => setShowFromPicker(!showFromPicker)}
                        className="text-xs font-medium"
                        style={{ color: "var(--accent)" }}
                      >
                        {showFromPicker ? "Hide calendar" : "Show calendar"}
                      </button>
                    </div>
                    <input
                      type="date"
                      value={tempFrom}
                      onChange={(e) => setTempFrom(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--input)",
                        color: "var(--text)",
                      }}
                    />
                    {showFromPicker && (
                      <div className="mt-2">
                        <DatePicker value={tempFrom} onChange={setTempFrom} />
                      </div>
                    )}
                  </div>

                  {/* To date */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        className="text-xs font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        To
                      </label>
                      <button
                        onClick={() => setShowToPicker(!showToPicker)}
                        className="text-xs font-medium"
                        style={{ color: "var(--accent)" }}
                      >
                        {showToPicker ? "Hide calendar" : "Show calendar"}
                      </button>
                    </div>
                    <input
                      type="date"
                      value={tempTo}
                      onChange={(e) => setTempTo(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--input)",
                        color: "var(--text)",
                      }}
                    />
                    {showToPicker && (
                      <div className="mt-2">
                        <DatePicker value={tempTo} onChange={setTempTo} />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={applyCustom}
                    className="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-foreground)",
                    }}
                  >
                    Apply
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
