"use client";

import * as React from "react";

export const MerchantInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onEnterSubmit: () => void;
  }
>(function MerchantInput({ value, onChange, onEnterSubmit }, ref) {
  return (
    <div>
      <div
        className="text-[11px] font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        Merchant or title
      </div>
      <input
        ref={ref}
        type="text"
        placeholder="Optional..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnterSubmit();
          }
        }}
        className="w-full h-12 px-4 text-base rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        style={{
          backgroundColor: "var(--surface-subtle)",
          color: "var(--text)",
          border: "none",
        }}
      />
    </div>
  );
});
