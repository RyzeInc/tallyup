"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { CategoryCombobox } from "@/components/ui/CategoryCombobox";
import { useToast } from "@/components/ToastProvider";
import { useFilteredCategories, type CategoryOption } from "./useFilteredCategories";

export interface CategoryPickerProps {
  /** Currently selected category ID (snake_case for built-in, Convex ID for custom) */
  value?: string;
  /** Callback when selection changes */
  onChange: (categoryId?: string, categoryName?: string) => void;
  /** Filter by type */
  type?: "expense" | "income";
  /** Placeholder text */
  placeholder?: string;
  /** Mark as required (shows indicator) */
  required?: boolean;
  /** Show validation error styling */
  showError?: boolean;
  /** Allow creating new categories */
  allowCreate?: boolean;
  /** Disable the picker */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Label to display above picker */
  label?: string;
  /** Show the label */
  showLabel?: boolean;
}

/**
 * CategoryPicker - Unified category selection component
 * 
 * Uses the shared useFilteredCategories hook to:
 * - Filter out hidden categories based on user preferences
 * - Include custom user-created categories
 * - Support both built-in (snake_case ID) and custom (Convex ID) categories
 * 
 * @example
 * ```tsx
 * // For expense entries
 * <CategoryPicker
 *   type="expense"
 *   value={selectedCategoryId}
 *   onChange={(id, name) => setCategory(id)}
 *   required
 * />
 * 
 * // For income entries
 * <CategoryPicker
 *   type="income"
 *   value={selectedCategoryId}
 *   onChange={(id, name) => setCategory(id)}
 * />
 * ```
 */
export function CategoryPicker({
  value,
  onChange,
  type = "expense",
  placeholder = "Category",
  required = false,
  showError = false,
  allowCreate = true,
  disabled = false,
  className,
  label = "Category",
  showLabel = true,
}: CategoryPickerProps) {
  const toast = useToast();
  const [searchText, setSearchText] = React.useState("");
  
  // Use the shared hook for filtered categories
  const { categories, getCategoryById, isLoading } = useFilteredCategories({ type });
  
  const createCategory = useMutation(api.categories.createCategory);

  // Find selected category to populate search text
  const selectedCategory = React.useMemo((): CategoryOption | null => {
    if (!value) return null;
    return getCategoryById(value) ?? null;
  }, [value, getCategoryById]);

  // Sync search text with selected value when it changes externally
  React.useEffect(() => {
    if (selectedCategory) {
      setSearchText(selectedCategory.name);
    } else if (!value) {
      setSearchText("");
    }
  }, [selectedCategory, value]);

  // Convert categories to combobox options format
  const options = React.useMemo(() => {
    return categories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      description: cat.description,
    }));
  }, [categories]);

  // Create category handler
  const handleCreate = React.useCallback(async (
    label: string
  ): Promise<{ id: string; label: string }> => {
    try {
      const newId = await createCategory({
        name: label.trim(),
        categoryType: type,
      });
      toast.success(`Created "${label.trim()}" category`);
      return { id: newId, label: label.trim() };
    } catch (e) {
      console.error(e);
      toast.error("Failed to create category");
      throw e;
    }
  }, [createCategory, type, toast]);

  // Handle selection change
  const handleChangeId = React.useCallback((id: string | null) => {
    if (id) {
      const cat = getCategoryById(id);
      onChange(id, cat?.name);
    } else {
      onChange(undefined, undefined);
    }
  }, [onChange, getCategoryById]);

  if (isLoading) {
    return (
      <div className={className}>
        {showLabel && (
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {label}
            </div>
          </div>
        )}
        <div
          className="h-12 rounded-xl animate-pulse"
          style={{ backgroundColor: "var(--surface-subtle)" }}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <div
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {label}
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
      )}

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
          onChangeId={handleChangeId}
          valueText={searchText}
          onChangeText={setSearchText}
          onCreate={allowCreate ? handleCreate : undefined}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * CategoryChips - Grid of category chips for quick selection
 * 
 * Alternative to CategoryPicker for scenarios where you want 
 * visible chips instead of a dropdown (e.g., review page quick actions)
 * 
 * @example
 * ```tsx
 * <CategoryChips
 *   type="expense"
 *   value={selectedId}
 *   onChange={(id) => setCategory(id)}
 *   maxVisible={5}
 * />
 * ```
 */
export interface CategoryChipsProps {
  /** Currently selected category ID */
  value?: string;
  /** Callback when selection changes */
  onChange: (categoryId: string, categoryName: string) => void;
  /** Filter by type */
  type?: "expense" | "income";
  /** Maximum number of chips to show before "More..." */
  maxVisible?: number;
  /** Callback when "More" is clicked */
  onShowMore?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export function CategoryChips({
  value,
  onChange,
  type = "expense",
  maxVisible = 5,
  onShowMore,
  disabled = false,
  className,
}: CategoryChipsProps) {
  const { categories, isLoading } = useFilteredCategories({ type });

  const visibleCategories = categories.slice(0, maxVisible);
  const hasMore = categories.length > maxVisible;

  if (isLoading) {
    return (
      <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-8 w-20 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--surface-2)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {visibleCategories.map((cat) => {
        const isSelected = value === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id, cat.name)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: isSelected ? "var(--primary)" : "var(--surface-2)",
              color: isSelected ? "var(--primary-foreground)" : "var(--text)",
              border: isSelected ? "none" : "1px solid var(--border)",
            }}
          >
            {cat.name}
          </button>
        );
      })}
      {hasMore && onShowMore && (
        <button
          type="button"
          onClick={onShowMore}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px dashed var(--border)",
          }}
        >
          More...
        </button>
      )}
    </div>
  );
}

export default CategoryPicker;
