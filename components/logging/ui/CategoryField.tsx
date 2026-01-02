"use client";

import * as React from "react";
import type { CategoryOption } from "../types";
import * as Lucide from "lucide-react";

export function CategoryField({
  value,
  categories,
  onChange,
  required,
  showError,
  placeholder = "Optional...",
}: {
  value?: string;
  categories: CategoryOption[];
  onChange: (id?: string) => void;
  required?: boolean;
  showError?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find((c) => c.id === value);

  const filteredCategories = React.useMemo(() => {
    if (!search.trim()) return categories;
    const s = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(s));
  }, [categories, search]);

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Category
        </div>
        {required && (
          <div
            className="text-[10px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            Required
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-4 text-left rounded-xl transition-all flex items-center justify-between"
        style={{
          backgroundColor: "var(--surface-subtle)",
          color: selectedCategory ? "var(--text)" : "var(--text-tertiary)",
          border: showError ? "2px solid var(--danger)" : "none",
          boxShadow: showError ? "0 0 12px 2px rgba(239, 68, 68, 0.4)" : "none",
        }}
      >
        <span className="text-sm font-medium truncate">
          {selectedCategory?.name ?? placeholder}
        </span>
        <Lucide.ChevronDown
          className="h-4 w-4 shrink-0 transition-transform"
          style={{
            color: "var(--text-tertiary)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl shadow-lg border max-h-60 overflow-hidden flex flex-col"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{
                backgroundColor: "var(--surface-subtle)",
                color: "var(--text)",
                border: "none",
                outline: "none",
              }}
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-subtle)] flex items-center gap-2"
                style={{ color: "var(--text-secondary)" }}
              >
                <Lucide.X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onChange(cat.id);
                  setIsOpen(false);
                  setSearch("");
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-subtle)] flex items-center justify-between"
                style={{
                  color: "var(--text)",
                  backgroundColor:
                    value === cat.id ? "var(--accent-subtle)" : "transparent",
                }}
              >
                <span>{cat.name}</span>
                {value === cat.id && (
                  <Lucide.Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
                )}
              </button>
            ))}
            {filteredCategories.length === 0 && (
              <div
                className="px-4 py-3 text-sm text-center"
                style={{ color: "var(--text-tertiary)" }}
              >
                No categories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
