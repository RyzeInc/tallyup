"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string; description?: string };

function normalize(s: string) {
  return s.trim().toLowerCase();
}

type CategoryComboboxProps = {
  options: Option[];
  valueId: string | null;
  onChangeId: (id: string | null) => void;

  // If you want "pending new value" (free text) support:
  valueText: string;
  onChangeText: (text: string) => void;

  // Optional: immediate create when user selects "Create …"
  onCreate?: (label: string) => Promise<Option> | Option;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function CategoryCombobox({
  options,
  valueId,
  onChangeId,
  valueText,
  onChangeText,
  onCreate,
  placeholder = "Category",
  disabled,
  className,
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => options.find((o) => o.id === valueId) ?? null,
    [options, valueId]
  );

  // What the input shows:
  // - if user is typing/free-text: valueText
  // - else show selected label
  const inputValue = open ? valueText : (valueText || selected?.label || "");

  const filtered = React.useMemo(() => {
    const q = normalize(valueText);
    if (!q) return options;
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, valueText]);

  const hasExactMatch = React.useMemo(() => {
    const q = normalize(valueText);
    if (!q) return false;
    return options.some((o) => normalize(o.label) === q);
  }, [options, valueText]);

  const canCreate = !!onCreate;
  const showCreateOption = canCreate && !hasExactMatch && valueText.trim().length > 0;
  // Total items including "Create" option
  const totalItems = filtered.length + (showCreateOption ? 1 : 0);

  // Reset highlighted index when filtered list changes
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered.length, hasExactMatch, valueText]);

  async function handleSelectExisting(opt: Option) {
    onChangeId(opt.id);
    onChangeText(opt.label); // keep text aligned with selection
    setOpen(false);
  }

  async function handleCreate(label: string) {
    const clean = label.trim();
    if (!clean) return;

    // If you want "create immediately on selection"
    if (onCreate) {
      const created = await onCreate(clean);
      onChangeId(created.id);
      onChangeText(created.label);
      setOpen(false);
      return;
    }

    // If you DON'T want to create immediately:
    // keep it as free-text, and create on form submit instead
    onChangeId(null);
    onChangeText(clean);
    setOpen(false);
  }

  // Enter key: pick exact match if exists; otherwise create
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, totalItems - 1));
      return;
    }
    
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    
    if (e.key !== "Enter") return;
    e.preventDefault();

    // If nothing typed, do nothing
    const q = valueText.trim();
    if (!q && filtered.length === 0) return;

    // If highlighted is the "Create" option (last item when no exact match)
    const isCreateOption = showCreateOption && highlightedIndex === filtered.length;
    if (isCreateOption) {
      void handleCreate(q);
      return;
    }

    // Select highlighted existing option
    if (filtered[highlightedIndex]) {
      void handleSelectExisting(filtered[highlightedIndex]);
      return;
    }

    // Fallback: exact match or create
    const exact = options.find((o) => normalize(o.label) === normalize(q));
    if (exact) {
      void handleSelectExisting(exact);
    } else if (q && canCreate) {
      void handleCreate(q);
    }
  }

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-combobox-item]");
    const item = items[highlightedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls="category-combobox-listbox"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          placeholder={placeholder}
          value={inputValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChangeText(e.target.value);
            onChangeId(null); // typed text = not guaranteed to be an existing id
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="w-full h-12 px-4 pr-9 text-sm font-medium rounded-xl transition-all"
          style={{
            backgroundColor: "var(--surface-subtle)",
            color: inputValue ? "var(--text)" : "var(--text-tertiary)",
            border: "none",
            outline: "none",
          }}
        />
        <Lucide.ChevronDown 
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" 
          style={{ color: "var(--text-tertiary)" }}
        />
      </div>

      {open && (
        <div
          id="category-combobox-listbox"
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl shadow-lg border max-h-64 overflow-y-auto"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
          role="listbox"
        >
          {filtered.length === 0 && !valueText.trim() && (
            <div
              className="px-4 py-3 text-sm text-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              No categories found
            </div>
          )}

          {filtered.map((opt, idx) => {
            const isSelected = opt.id === valueId;
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={opt.id}
                data-combobox-item
                role="option"
                aria-selected={isSelected}
                onClick={() => void handleSelectExisting(opt)}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm cursor-pointer flex items-center justify-between transition-colors",
                  isHighlighted && "bg-[var(--surface-subtle)]"
                )}
                style={{
                  color: "var(--text)",
                  backgroundColor: isSelected ? "var(--accent-subtle)" : isHighlighted ? "var(--surface-subtle)" : "transparent",
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <span className="flex-1 min-w-0">
                  <span className="block">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {opt.description}
                    </span>
                  )}
                </span>
                <Lucide.Check 
                  className={cn("h-4 w-4 shrink-0 ml-2", isSelected ? "opacity-100" : "opacity-0")} 
                  style={{ color: "var(--primary)" }}
                />
              </div>
            );
          })}

          {showCreateOption && (
            <div
              data-combobox-item
              role="option"
              aria-selected={false}
              onClick={() => void handleCreate(valueText)}
              className={cn(
                "w-full px-4 py-2.5 text-left text-sm cursor-pointer flex items-center gap-2 border-t transition-colors",
                highlightedIndex === filtered.length && "bg-[var(--surface-subtle)]"
              )}
              style={{ 
                color: "var(--primary)", 
                borderColor: "var(--border)",
              }}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
            >
              <Lucide.Plus className="h-4 w-4" />
              Create &ldquo;{valueText.trim()}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
