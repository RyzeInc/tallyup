"use client";

import { useEffect, useRef, useState } from "react";
import * as Lucide from "lucide-react";
import { todayYYYYMMDD } from "@/components/utils";

export type DateRangeMode = "today" | "week" | "month" | "custom";

interface DateRangeChipProps {
  mode: DateRangeMode;
  onModeChange: (mode: DateRangeMode) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
}

const modeLabels: Record<DateRangeMode, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
};

export default function DateRangeChip({
  mode,
  onModeChange,
  customFrom,
  customTo,
  onCustomChange,
}: DateRangeChipProps) {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(customFrom ?? todayYYYYMMDD());
  const [tempTo, setTempTo] = useState(customTo ?? todayYYYYMMDD());
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

  function openSheet() {
    setTempFrom(customFrom ?? todayYYYYMMDD());
    setTempTo(customTo ?? todayYYYYMMDD());
    setOpen(true);
  }

  function selectMode(m: DateRangeMode) {
    if (m === "custom") {
      // Don't close yet, show date pickers
      onModeChange(m);
    } else {
      onModeChange(m);
      setOpen(false);
    }
  }

  function applyCustom() {
    onCustomChange?.(tempFrom, tempTo);
    setOpen(false);
  }

  const displayLabel = mode === "custom" && customFrom && customTo
    ? `${customFrom} – ${customTo}`
    : modeLabels[mode];

  return (
    <>
      {/* Chip trigger */}
      <button
        onClick={openSheet}
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
              className="rounded-t-2xl border-t border-x p-4 pb-8"
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
                <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
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

              {/* Options */}
              <div className="space-y-1 mb-4">
                {(["today", "week", "month", "custom"] as DateRangeMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => selectMode(m)}
                    className={`w-full text-left rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      mode === m ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--surface-subtle)]"
                    }`}
                    style={{
                      color: mode === m ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    {modeLabels[m]}
                  </button>
                ))}
              </div>

              {/* Custom date pickers */}
              {mode === "custom" && (
                <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        className="block text-xs font-medium mb-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        From
                      </label>
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
                    </div>
                    <div>
                      <label
                        className="block text-xs font-medium mb-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        To
                      </label>
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
                    </div>
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
