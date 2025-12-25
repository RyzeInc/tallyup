"use client";

import React, { useState, useMemo } from "react";
import * as Lucide from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DatePicker({ value, onChange, label }: DatePickerProps) {
  // Parse initial value
  const initialDate = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewDate, setViewDate] = useState(initialDate);
  const [mode, setMode] = useState<"calendar" | "month-year">("calendar");

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Selected date parts
  const selectedYear = initialDate.getFullYear();
  const selectedMonth = initialDate.getMonth();
  const selectedDay = initialDate.getDate();

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [year, month]);

  function selectDay(day: number) {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${year}-${m}-${d}`);
  }

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  function selectMonthYear(m: number, y: number) {
    setViewDate(new Date(y, m, 1));
    setMode("calendar");
  }

  // Years to show in picker (centered around current)
  const yearsRange = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current - 10; y <= current + 5; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDay &&
      month === selectedMonth &&
      year === selectedYear
    );
  };

  return (
    <div
      className="rounded-xl border p-3"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {label && (
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
          {label}
        </div>
      )}

      {/* Header with month/year toggle */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMode(mode === "calendar" ? "month-year" : "calendar")}
          className="text-sm font-semibold hover:underline"
          style={{ color: "var(--accent)" }}
        >
          {MONTHS[month]} {year} {mode === "calendar" ? "›" : "‹"}
        </button>

        {mode === "calendar" && (
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors"
              aria-label="Previous month"
            >
              <Lucide.ChevronLeft className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors"
              aria-label="Next month"
            >
              <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>
        )}
      </div>

      {mode === "calendar" ? (
        /* Calendar view */
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium py-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => (
              <div key={idx} className="aspect-square flex items-center justify-center">
                {day !== null ? (
                  <button
                    onClick={() => selectDay(day)}
                    className={`w-full h-full flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      isSelected(day)
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : isToday(day)
                        ? "border border-[var(--accent)]"
                        : "hover:bg-[var(--surface-subtle)]"
                    }`}
                    style={{
                      color: isSelected(day)
                        ? undefined
                        : isToday(day)
                        ? "var(--accent)"
                        : "var(--text)",
                    }}
                  >
                    {day}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Month/Year picker view */
        <div className="flex gap-4">
          {/* Months column */}
          <div
            className="flex-1 max-h-48 overflow-y-auto space-y-1 pr-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {MONTHS.map((m, idx) => (
              <button
                key={m}
                onClick={() => selectMonthYear(idx, year)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  idx === month
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "hover:bg-[var(--surface-subtle)]"
                }`}
                style={{
                  color: idx === month ? undefined : "var(--text)",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Years column */}
          <div
            className="flex-1 max-h-48 overflow-y-auto space-y-1 pr-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {yearsRange.map((y) => (
              <button
                key={y}
                onClick={() => selectMonthYear(month, y)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  y === year
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "hover:bg-[var(--surface-subtle)]"
                }`}
                style={{
                  color: y === year ? undefined : "var(--text)",
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
