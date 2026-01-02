"use client";

import * as React from "react";

export const AmountInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onEnterNext: () => void;
    showError?: boolean;
    autoFocus?: boolean;
  }
>(function AmountInput(
  { value, onChange, onEnterNext, showError, autoFocus },
  ref
) {
  return (
    <div>
      <div
        className="text-[11px] font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        Amount
      </div>
      <div className="relative">
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold"
          style={{ color: value ? "var(--text)" : "var(--text-tertiary)" }}
        >
          $
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnterNext();
            }
          }}
          autoFocus={autoFocus}
          className="w-full h-14 pl-10 pr-4 text-2xl font-semibold rounded-xl transition-all focus:outline-none focus:ring-2"
          style={{
            backgroundColor: "var(--surface-subtle)",
            color: "var(--text)",
            border: showError ? "2px solid var(--danger)" : "none",
            boxShadow: showError ? "0 0 12px 2px rgba(239, 68, 68, 0.4)" : "none",
          }}
        />
      </div>
    </div>
  );
});
