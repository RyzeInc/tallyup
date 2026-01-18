"use client";

import * as React from "react";

export const TitleInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onEnterNext?: () => void;
  }
>(function TitleInput({ value, onChange, onEnterNext }, ref) {
  return (
    <div className="flex-1">
      <div
        className="text-[10px] font-medium uppercase tracking-wider mb-1.5"
        style={{ color: "var(--text-tertiary)" }}
      >
        Title
      </div>
      <input
        ref={ref}
        type="text"
        placeholder="What is this?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnterNext?.();
          }
        }}
        className="w-full h-11 px-3 text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        style={{
          backgroundColor: "var(--surface-subtle)",
          color: "var(--text)",
          border: "none",
        }}
      />
    </div>
  );
});
