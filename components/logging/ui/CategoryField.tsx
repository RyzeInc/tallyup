"use client";

import * as React from "react";
import type { CategoryOption } from "../types";
import { CategoryCombobox } from "@/components/ui/CategoryCombobox";

export function CategoryField({
  value,
  categories,
  onChange,
  required,
  showError,
  placeholder = "Category",
}: {
  value?: string;
  categories: CategoryOption[];
  onChange: (id?: string) => void;
  required?: boolean;
  showError?: boolean;
  placeholder?: string;
}) {
  const [searchText, setSearchText] = React.useState("");

  // Find selected category name to populate search text when value changes externally
  const selectedCategory = React.useMemo(() => {
    return categories.find((c) => c.id === value) ?? null;
  }, [value, categories]);

  // Sync search text with selected value when it changes externally
  React.useEffect(() => {
    if (selectedCategory) {
      setSearchText(selectedCategory.name);
    } else if (!value) {
      setSearchText("");
    }
  }, [selectedCategory, value]);

  // Combine preset categories with custom categories into options format
  const options = React.useMemo(() => {
    return categories.map((c) => ({
      id: c.id,
      label: c.name,
      description: c.description,
    }));
  }, [categories]);

  return (
    <div>
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

      <div
        style={{
          border: showError ? "2px solid var(--danger)" : "none",
          borderRadius: "var(--radius-xl)",
          boxShadow: showError ? "0 0 12px 2px rgba(239, 68, 68, 0.4)" : "none",
        }}
      >
        <CategoryCombobox
          options={options}
          valueId={value ?? null}
          onChangeId={(id) => onChange(id ?? undefined)}
          valueText={searchText}
          onChangeText={setSearchText}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
