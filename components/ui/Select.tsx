"use client";

import React from "react";

export default function Select({ value, onChange, options, className = "" }: { value?: string; onChange?: (v: string) => void; options: string[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange?.(e.target.value)} className={["w-full rounded-xl border px-3 py-2 text-sm", className].join(" ")} style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
