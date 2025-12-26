"use client";

import React, { useState, useEffect, useRef } from "react";

export default function CurrencyInput({
  valueCents,
  onChange,
  placeholder = "0.00",
  id,
  ariaLabel,
  currency = "USD",
  invalid,
  onBlur,
}: {
  valueCents?: number;
  onChange?: (cents: number | null) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  currency?: string;
  invalid?: boolean;
  onBlur?: () => void;
}) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Only update from external valueCents when not focused
  useEffect(() => {
    if (isFocused) return;
    if (typeof valueCents === "number") {
      setText((valueCents / 100).toFixed(2));
    } else if (valueCents === undefined || valueCents === null) {
      setText("");
    }
  }, [valueCents, isFocused]);

  function parseToCentsFromString(s: string): number | null {
    if (!s || s.trim() === "") return null;
    // Remove everything except digits, dots, and minus
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    
    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) return null;
    
    const asNumber = parseFloat(cleaned);
    if (isNaN(asNumber)) return null;
    
    return Math.round(asNumber * 100);
  }

  function formatCents(n: number): string {
    return (n / 100).toFixed(2);
  }

  function sanitizeInput(raw: string): string {
    // Remove everything except digits, dots, and minus
    let cleaned = raw.replace(/[^0-9.\-]/g, "");
    
    // Only allow minus at the start
    if (cleaned.indexOf("-") > 0) {
      cleaned = cleaned.replace(/-/g, "");
    }
    
    // Ensure only one decimal point
    const firstDotIndex = cleaned.indexOf(".");
    if (firstDotIndex >= 0) {
      const beforeDot = cleaned.substring(0, firstDotIndex + 1);
      const afterDot = cleaned.substring(firstDotIndex + 1).replace(/\./g, "");
      cleaned = beforeDot + afterDot.slice(0, 2); // Limit to 2 decimal places
    }
    
    return cleaned;
  }

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel ?? "Amount"}
      value={text}
      placeholder={placeholder}
      onFocus={() => setIsFocused(true)}
      onPaste={(e) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text");
        const sanitized = sanitizeInput(pastedText);
        setText(sanitized);
        const cents = parseToCentsFromString(sanitized);
        onChange?.(cents);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const sanitized = sanitizeInput(raw);
        setText(sanitized);
        
        // Parse and notify parent
        const cents = parseToCentsFromString(sanitized);
        onChange?.(cents);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        const cents = parseToCentsFromString(e.target.value);
        if (cents == null || cents === 0) {
          setText("");
          onChange?.(null);
        } else {
          setText(formatCents(cents));
          onChange?.(cents);
        }
        onBlur?.();
      }}
      className="w-full h-12 rounded-lg border px-3 text-lg font-semibold tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
      style={{
        borderColor: invalid ? "var(--danger)" : "var(--border)",
        backgroundColor: "var(--input)",
        color: "var(--text)",
        fontFeatureSettings: "'tnum' 1",
      }}
    />
  );
}
