"use client";

import * as React from "react";
import { isoToDate } from "../machine";
import * as Lucide from "lucide-react";

export function DateButton({
  dateISO,
  onChange,
  showError,
}: {
  dateISO: string;
  onChange: (iso: string) => void;
  showError?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Format display date
  const displayDate = React.useMemo(() => {
    const d = isoToDate(dateISO);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [dateISO]);

  return (
    <div>
      <div
        className="text-[11px] font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        Date
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.showPicker()}
        className="relative w-full h-12 px-4 text-left rounded-xl transition-all flex items-center justify-between"
        style={{
          backgroundColor: "var(--surface-subtle)",
          color: "var(--text)",
          border: showError ? "2px solid var(--danger)" : "none",
          boxShadow: showError ? "0 0 12px 2px rgba(239, 68, 68, 0.4)" : "none",
        }}
      >
        <span className="text-sm font-medium">{displayDate}</span>
        <Lucide.Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
        <input
          ref={inputRef}
          type="date"
          value={dateISO}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ colorScheme: "dark" }}
        />
      </button>
    </div>
  );
}
