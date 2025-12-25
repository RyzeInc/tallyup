"use client";

import React, { useState, useEffect, useRef } from "react";

export default function CurrencyInput({
  valueCents,
  onChange,
  placeholder = "0.00",
  id,
  ariaLabel,
  currency = "USD",
}: {
  valueCents?: number;
  onChange?: (cents: number | null) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  currency?: string;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof valueCents === "number") setText(formatCents(valueCents));
    if (valueCents === undefined || valueCents === null) setText("");
  }, [valueCents]);

  function parseToCentsFromString(s: string): number | null {
    if (!s) return null;
    // accept $1,234.56 or 1,234.56 etc.
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    if (cleaned.trim() === "") return null;
    // ensure only one dot
    const parts = cleaned.split(".");
    if (parts.length > 2) return null;
    const asNumber = Number(cleaned);
    if (Number.isNaN(asNumber)) return null;
    return Math.round(asNumber * 100);
  }

  function formatCents(n: number, minFraction = 2) {
    const nf = new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: minFraction, maximumFractionDigits: minFraction });
    return nf.format(n / 100);
  }

  function formatNumberStringForTyping(raw: string) {
    // preserve user's decimals while typing (up to 2)
    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-") return cleaned;
    if (cleaned === ".") return "0.";
    const parts = cleaned.split(".");
    const intPart = parts[0] || "0";
    const decPart = parts[1] ?? "";
    const intNum = Number(intPart.replace(/^0+(?!$)/, "")) || 0;
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    const formattedInt = nf.format(intNum);
    if (decPart.length > 0) {
      return `${formattedInt}.${decPart.slice(0, 2)}`;
    }
    return formattedInt;
  }

  return (
    <input
      id={id}
      ref={inputRef}
      inputMode="decimal"
      aria-label={ariaLabel ?? "Amount"}
      value={text}
      placeholder={placeholder}
      onPaste={(e) => {
        const p = e.clipboardData.getData("text");
        const cents = parseToCentsFromString(p);
        if (cents != null) {
          e.preventDefault();
          setText(formatCents(cents));
          onChange?.(cents);
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // try to parse a numeric value
        const cents = parseToCentsFromString(raw);
        if (cents != null) {
          // if user typed decimals, preserve decimal count while typing
          const hasDot = raw.indexOf(".") >= 0;
          if (hasDot) {
            // determine number of decimals typed
            const decLen = raw.split(".")[1]?.length ?? 0;
            const display = formatCents(cents, Math.min(Math.max(decLen, 0), 2));
            setText(display);
          } else {
            // show formatted integer grouping while typing
            const display = formatNumberStringForTyping(raw);
            setText(display);
          }
          onChange?.(cents);
        } else {
          // fallback to preserving raw input
          setText(raw);
          onChange?.(null);
        }
      }}
      onBlur={(e) => {
        const cents = parseToCentsFromString(e.target.value);
        if (cents == null) {
          setText("");
          onChange?.(null);
        } else {
          setText(formatCents(cents, 2));
          onChange?.(cents);
        }
      }}
      className="w-full h-12 rounded-lg border px-3 text-lg font-semibold tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--input)",
        color: "var(--text)",
        fontFeatureSettings: "'tnum' 1",
      }}
    />
  );
}
