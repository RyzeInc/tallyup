"use client";

import React, { useState, useEffect } from "react";

export default function CurrencyInput({ valueCents, onChange, placeholder = "0.00" }: { valueCents?: number; onChange?: (cents: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (typeof valueCents === "number") setText(formatCents(valueCents));
  }, [valueCents]);

  function parseInputToCents(s: string) {
    // remove non digits and dot, keep at most one dot
    const cleaned = s.replace(/[^(0-9.)]/g, "");
    if (cleaned.trim() === "") return null;
    const asNumber = Number(cleaned.replace(/,/g, ""));
    if (Number.isNaN(asNumber)) return null;
    // multiply by 100 and round
    return Math.round(asNumber * 100);
  }

  function formatCents(n: number) {
    const nf = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
    return nf.format(n / 100);
  }

  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
      }}
      onBlur={(e) => {
        const cents = parseInputToCents(e.target.value);
        if (cents == null) {
          setText("");
          onChange?.(null);
        } else {
          setText(formatCents(cents));
          onChange?.(cents);
        }
      }}
      className="w-full rounded-md border px-3 py-2"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }}
    />
  );
}
