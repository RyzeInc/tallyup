"use client";

import * as React from "react";
import type { CategoryOption } from "../types";
import { CategoryCombobox } from "@/components/ui/CategoryCombobox";

type SubcategoryFieldProps = {
  value?: string;
  /** All subcategories (items with parentId) */
  subcategories: CategoryOption[];
  /** Currently selected parent category ID - for filtering */
  selectedCategoryId?: string;
  onChange: (id?: string, parentId?: string) => void;
  placeholder?: string;
};

export function SubcategoryField({
  value,
  subcategories,
  selectedCategoryId,
  onChange,
  placeholder = "Subcategory (optional)",
}: SubcategoryFieldProps) {
  const [searchText, setSearchText] = React.useState("");

  // Filter subcategories by selected category if one is selected
  const filteredSubcategories = React.useMemo(() => {
    if (!selectedCategoryId) {
      return subcategories;
    }
    return subcategories.filter(c => c.parentId === selectedCategoryId);
  }, [subcategories, selectedCategoryId]);

  // Find selected subcategory to populate search text
  const selectedSubcategory = React.useMemo(() => {
    return subcategories.find((c) => c.id === value) ?? null;
  }, [value, subcategories]);

  // Sync search text with selected value when it changes externally
  React.useEffect(() => {
    if (selectedSubcategory) {
      setSearchText(selectedSubcategory.name);
    } else if (!value) {
      setSearchText("");
    }
  }, [selectedSubcategory, value]);

  // Convert to options format for combobox
  const options = React.useMemo(() => {
    return filteredSubcategories.map((c) => ({
      id: c.id,
      label: c.name,
      description: c.description,
      parentId: c.parentId,
    }));
  }, [filteredSubcategories]);

  // Handle selection
  const handleChange = React.useCallback((id: string | null) => {
    if (!id) {
      onChange(undefined, undefined);
      return;
    }
    // Find the subcategory to get its parentId
    const subcat = subcategories.find(c => c.id === id);
    onChange(id, subcat?.parentId);
  }, [onChange, subcategories]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Subcategory
        </div>
      </div>

      <CategoryCombobox
        options={options}
        valueId={value ?? null}
        onChangeId={handleChange}
        valueText={searchText}
        onChangeText={setSearchText}
        placeholder={placeholder}
      />
      
      {filteredSubcategories.length === 0 && selectedCategoryId && (
        <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
          No subcategories for this category.
        </p>
      )}
    </div>
  );
}
