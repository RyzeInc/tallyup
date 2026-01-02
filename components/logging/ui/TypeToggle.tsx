"use client";

import * as React from "react";
import type { TxType } from "../types";

const TYPE_OPTIONS: Array<{ value: TxType; label: string }> = [
  { value: "spent", label: "Spent" },
  { value: "received", label: "Received" },
  { value: "transfer", label: "Transfer" },
];

export function TypeToggle({
  value,
  onChange,
}: {
  value: TxType;
  onChange: (v: TxType) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-xl p-1"
      style={{
        gridTemplateColumns: "1fr 1fr 1fr",
        backgroundColor: "var(--surface-2)",
      }}
    >
      {TYPE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="rounded-lg py-2.5 px-4 text-sm font-semibold transition-all"
            style={{
              backgroundColor: isActive
                ? opt.value === "spent"
                  ? "var(--primary)"
                  : opt.value === "received"
                    ? "var(--success)"
                    : "var(--accent)"
                : "transparent",
              color: isActive
                ? opt.value === "received"
                  ? "#fff"
                  : "var(--primary-foreground)"
                : "var(--text-secondary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
