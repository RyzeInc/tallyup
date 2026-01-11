"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { CategoryOption } from "../types";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export function CategoryField({
  value,
  categories,
  onChange,
  required,
  showError,
  placeholder = "Select category",
  categoryType = "expense",
}: {
  value?: string;
  categories: CategoryOption[];
  onChange: (id?: string) => void;
  required?: boolean;
  showError?: boolean;
  placeholder?: string;
  categoryType?: "expense" | "income";
}) {
  const toast = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Fetch user's custom categories
  const customCategories = useQuery(api.categories.listCategories, { categoryType }) as { _id: string; name: string }[] | undefined;
  const createCategory = useMutation(api.categories.createCategory);

  const selectedCategory = categories.find((c) => c.id === value) || 
    customCategories?.find((c) => c._id === value);
  const selectedName = selectedCategory ? ('name' in selectedCategory ? selectedCategory.name : undefined) : undefined;

  // Combine preset categories with custom categories
  const allCategories = React.useMemo(() => {
    const preset = categories;
    const custom = (customCategories ?? []).map((c) => ({
      id: c._id,
      name: c.name,
      isCustom: true,
    }));
    return [...preset, ...custom];
  }, [categories, customCategories]);

  const filteredCategories = React.useMemo(() => {
    if (!search.trim()) return allCategories;
    const s = search.toLowerCase();
    return allCategories.filter((c) => c.name.toLowerCase().includes(s));
  }, [allCategories, search]);

  // Check if search term matches exactly any existing category
  const exactMatch = React.useMemo(() => {
    if (!search.trim()) return true;
    const s = search.toLowerCase().trim();
    return allCategories.some((c) => c.name.toLowerCase() === s);
  }, [allCategories, search]);

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

  const handleCreateCategory = async () => {
    if (!search.trim() || exactMatch) return;
    setIsCreating(true);
    try {
      const newId = await createCategory({
        name: search.trim(),
        categoryType,
      });
      onChange(newId);
      setIsOpen(false);
      setSearch("");
      toast.success(`Created "${search.trim()}" category`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create category");
    } finally {
      setIsCreating(false);
    }
  };

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
          color: selectedName ? "var(--text)" : "var(--text-tertiary)",
          border: showError ? "2px solid var(--danger)" : "none",
          boxShadow: showError ? "0 0 12px 2px rgba(239, 68, 68, 0.4)" : "none",
        }}
      >
        <span className="text-sm font-medium truncate">
          {selectedName ?? placeholder}
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
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    {cat.name}
                    {'isCustom' in cat && cat.isCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-tertiary)" }}>
                        Custom
                      </span>
                    )}
                  </span>
                  {'description' in cat && cat.description && (
                    <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {cat.description}
                    </span>
                  )}
                </span>
                {value === cat.id && (
                  <Lucide.Check className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                )}
              </button>
            ))}
            
            {/* Create new category option */}
            {search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isCreating}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-subtle)] flex items-center gap-2 border-t"
                style={{ color: "var(--primary)", borderColor: "var(--border)" }}
              >
                <Lucide.Plus className="h-4 w-4" />
                {isCreating ? "Creating..." : `Create "${search.trim()}"`}
              </button>
            )}
            
            {filteredCategories.length === 0 && !search.trim() && (
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
