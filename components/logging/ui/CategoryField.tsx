"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { CategoryOption } from "../types";
import { CategoryCombobox } from "@/components/ui/CategoryCombobox";
import { useToast } from "@/components/ToastProvider";

export function CategoryField({
  value,
  categories,
  onChange,
  required,
  showError,
  placeholder = "Category",
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
  const [searchText, setSearchText] = React.useState("");
  
  // Fetch user's custom categories
  const customCategories = useQuery(api.categories.listCategories, { categoryType }) as { _id: string; name: string }[] | undefined;
  const createCategory = useMutation(api.categories.createCategory);

  // Find selected category name to populate search text when value changes externally
  const selectedCategory = React.useMemo(() => {
    const fromPreset = categories.find((c) => c.id === value);
    if (fromPreset) return fromPreset;
    const fromCustom = customCategories?.find((c) => c._id === value);
    if (fromCustom) return { id: fromCustom._id, label: fromCustom.name };
    return null;
  }, [value, categories, customCategories]);

  // Sync search text with selected value when it changes externally
  React.useEffect(() => {
    if (selectedCategory) {
      setSearchText("label" in selectedCategory ? selectedCategory.label : selectedCategory.name);
    } else if (!value) {
      setSearchText("");
    }
  }, [selectedCategory, value]);

  // Combine preset categories with custom categories into options format
  const options = React.useMemo(() => {
    const preset = categories.map((c) => ({
      id: c.id,
      label: c.name,
      description: c.description,
    }));
    const custom = (customCategories ?? []).map((c) => ({
      id: c._id,
      label: c.name,
    }));
    // Dedupe by label (case-insensitive) - prefer preset
    const seen = new Set(preset.map((o) => o.label.toLowerCase()));
    const filteredCustom = custom.filter((c) => !seen.has(c.label.toLowerCase()));
    return [...preset, ...filteredCustom];
  }, [categories, customCategories]);

  // Create category handler - called when user selects "Create ..." option
  const handleCreate = React.useCallback(async (label: string): Promise<{ id: string; label: string }> => {
    try {
      const newId = await createCategory({
        name: label.trim(),
        categoryType,
      });
      toast.success(`Created "${label.trim()}" category`);
      return { id: newId, label: label.trim() };
    } catch (e) {
      console.error(e);
      toast.error("Failed to create category");
      throw e;
    }
  }, [createCategory, categoryType, toast]);

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
          onCreate={handleCreate}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
