/**
 * Shared Components Index
 * 
 * This module exports all shared UI components that should be used
 * consistently across the TallyUp application.
 */

// Category selection
export { CategoryPicker, type CategoryPickerProps } from "./CategoryPicker";
export { useFilteredCategories } from "./useFilteredCategories";

// Context tag selection
export { ContextTagPicker, useFilteredContextTags, type ContextTagPickerProps } from "./ContextTagPicker";

// Entry display
export { EntryPreview, EntryPreviewList, type EntryPreviewProps } from "./EntryPreview";

// UI Components
export { default as SectionHeader, DismissableSectionHeader } from "./SectionHeader";
