"use client";

import React, { useEffect, useRef, useState } from "react";

export default function Combobox({
  value,
  onChange,
  options,
  placeholder = "",
  className = "",
  onBlur,
  allowFreeText = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  allowFreeText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value || "");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setInput(value || ""), [value]);

  const filtered = options.filter((o) => o.toLowerCase().includes((input || "").toLowerCase()));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commit(v: string) {
    onChange(v);
    setInput(v);
    setOpen(false);
    setActiveIndex(-1);
    onBlur?.();
  }

  return (
    <div ref={containerRef} className={["relative w-full", className].join(" ")}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={input}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && activeIndex >= 0 && filtered[activeIndex]) {
              commit(filtered[activeIndex]);
            } else if (allowFreeText) {
              commit(input.trim());
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border px-3 py-2.5 text-sm"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }}
      />

      {open && filtered.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-[var(--surface)]" style={{ borderColor: "var(--border)", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
          {filtered.map((opt, idx) => (
            <li
              key={opt + idx}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                // use mouseDown to avoid losing focus before click
                e.preventDefault();
                commit(opt);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`px-3 py-2 text-sm cursor-pointer ${idx === activeIndex ? "bg-[var(--surface-subtle)]" : ""}`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
