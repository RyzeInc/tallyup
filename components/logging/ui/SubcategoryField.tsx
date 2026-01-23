"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

interface SubcategoryFieldProps {
  categories: Category[];
  parentCategoryId: string | null;
  parentSlug?: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
  // Transfer-specific
  transferFromValue?: string | null;
  transferToValue?: string | null;
  onTransferFromChange?: (id: string | null) => void;
  onTransferToChange?: (id: string | null) => void;
}

function DropdownSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  options: Category[];
  placeholder: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o._id === value);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, search]);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(id: string | null) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            if (!open) {
              setTimeout(() => inputRef.current?.focus(), 10);
            }
          }}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm",
            "transition-colors"
          )}
          style={{
            backgroundColor: "var(--input)",
            borderColor: open ? "var(--primary)" : "var(--border)",
            color: selected ? "var(--text)" : "var(--text-tertiary)",
          }}
        >
          <span className="truncate">{selected?.name || placeholder}</span>
          <Lucide.ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            style={{ color: "var(--text-tertiary)" }}
          />
        </button>

        {open && (
          <div
            className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              maxHeight: "240px",
            }}
          >
            {/* Search input */}
            <div className="border-b p-2" style={{ borderColor: "var(--border)" }}>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded border-0 bg-transparent px-2 py-1.5 text-sm outline-none"
                style={{ color: "var(--text)" }}
              />
            </div>

            {/* Options list */}
            <div className="overflow-y-auto" style={{ maxHeight: "180px" }}>
              {/* None / Clear option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-sm",
                  "hover:bg-[var(--surface-hover)] transition-colors"
                )}
                style={{ color: "var(--text-tertiary)" }}
              >
                <span>None</span>
                {!value && (
                  <Lucide.Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
                )}
              </button>

              {filtered.length === 0 ? (
                <div
                  className="px-3 py-4 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No options found
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt._id}
                    type="button"
                    onClick={() => handleSelect(opt._id)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm",
                      "hover:bg-[var(--surface-hover)] transition-colors"
                    )}
                    style={{ color: "var(--text)" }}
                  >
                    <span>{opt.name}</span>
                    {value === opt._id && (
                      <Lucide.Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SubcategoryField({
  categories,
  parentCategoryId,
  parentSlug,
  value,
  onChange,
  transferFromValue,
  transferToValue,
  onTransferFromChange,
  onTransferToChange,
}: SubcategoryFieldProps) {
  // Check if this is a Transfer type (transfer_in or transfer_out)
  const isTransfer = parentSlug === "transfer_in" || parentSlug === "transfer_out";

  // Get subcategories for the selected parent
  const subcategories = React.useMemo(() => {
    if (!parentCategoryId) return [];
    return categories.filter((c) => c.parentId === parentCategoryId);
  }, [categories, parentCategoryId]);

  // For transfers, get transfer_in and transfer_out children
  const transferCategories = React.useMemo(() => {
    if (!isTransfer) return { from: [], to: [] };

    const transferInParent = categories.find((c) => c.slug === "transfer_in" && !c.parentId);
    const transferOutParent = categories.find((c) => c.slug === "transfer_out" && !c.parentId);

    return {
      from: transferInParent
        ? categories.filter((c) => c.parentId === transferInParent._id)
        : [],
      to: transferOutParent
        ? categories.filter((c) => c.parentId === transferOutParent._id)
        : [],
    };
  }, [categories, isTransfer]);

  // Don't render if no parent selected
  if (!parentCategoryId) return null;

  // Render Transfer UI (From / To dropdowns)
  if (isTransfer) {
    const hasTransferOptions =
      transferCategories.from.length > 0 || transferCategories.to.length > 0;
    if (!hasTransferOptions) return null;

    return (
      <div className="space-y-3">
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          <Lucide.ArrowRightLeft className="h-3 w-3" />
          <span>Transfer Details</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DropdownSelect
            label="From"
            value={transferFromValue ?? null}
            onChange={(id) => onTransferFromChange?.(id)}
            options={transferCategories.from}
            placeholder="Select source..."
          />
          <DropdownSelect
            label="To"
            value={transferToValue ?? null}
            onChange={(id) => onTransferToChange?.(id)}
            options={transferCategories.to}
            placeholder="Select destination..."
          />
        </div>
      </div>
    );
  }

  // Regular subcategory dropdown for expense/income
  // Show the field when a category is selected, even if no subcategories exist yet
  return (
    <DropdownSelect
      label="Subcategory (optional)"
      value={value}
      onChange={onChange}
      options={subcategories}
      placeholder={subcategories.length === 0 ? "No subcategories available" : "Select subcategory..."}
    />
  );
}
