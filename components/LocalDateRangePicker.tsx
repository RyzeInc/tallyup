"use client";

import React, { useState } from "react";
import * as Lucide from "lucide-react";
import { DateRangePreset } from "@/components/utils";

export default function LocalDateRangePicker({
  preset,
  label,
  options,
  onChange,
}: {
  preset: DateRangePreset;
  label: string;
  options: { value: DateRangePreset; label: string }[];
  onChange: (value: DateRangePreset) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
        style={{
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        <Lucide.Calendar className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
        <span>{label}</span>
        <Lucide.ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-xl p-2 shadow-lg min-w-[170px]"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: preset === option.value ? "var(--accent-subtle)" : "transparent",
                  color: preset === option.value ? "var(--primary)" : "var(--text)",
                  fontWeight: preset === option.value ? 600 : 400,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
