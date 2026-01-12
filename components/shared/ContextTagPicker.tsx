"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CONTEXT_TAGS } from "@/lib/constants";
import * as Lucide from "lucide-react";

// Context tag icons for visual consistency
const CONTEXT_TAG_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "Personal": Lucide.User,
  "Shared": Lucide.Users,
  "Household": Lucide.Home,
  "Partner": Lucide.Heart,
  "Dependent": Lucide.Baby,
  "Business": Lucide.Briefcase,
  "Client": Lucide.Building,
  "Reimbursable": Lucide.Receipt,
  "Tax-Deductible": Lucide.FileText,
};

export interface ContextTagPickerProps {
  /** Currently selected tags */
  value: string[];
  /** Callback when selection changes */
  onChange: (tags: string[]) => void;
  /** Visual variant for different contexts */
  variant?: "chips" | "compact";
  /** Whether to show icons */
  showIcons?: boolean;
  /** Whether selection is required (shows error styling when empty) */
  required?: boolean;
  /** Custom label above the picker */
  label?: string;
  /** Custom hint text */
  hint?: string;
}

/**
 * Shared ContextTagPicker component for consistent multi-select context tag selection.
 * Automatically filters tags based on user preferences (hiddenContextTags).
 */
export function ContextTagPicker({
  value,
  onChange,
  variant = "chips",
  showIcons = true,
  required = false,
  label,
  hint,
}: ContextTagPickerProps) {
  // Fetch user preferences for hidden tags
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});

  // Filter context tags based on user preferences
  const filteredTags = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenContextTags ?? []).map((t: string) => t.toLowerCase()));
    return CONTEXT_TAGS.filter(tag => !hiddenSet.has(tag.toLowerCase()));
  }, [userPrefs?.hiddenContextTags]);

  const toggleTag = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter(t => t !== tag));
    } else {
      onChange([...value, tag]);
    }
  };

  const showError = required && value.length === 0;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {filteredTags.map((tag) => {
          const isSelected = value.includes(tag);
          const IconComponent = showIcons ? CONTEXT_TAG_ICONS[tag] : null;

          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-micro)",
                fontWeight: 500,
                cursor: "pointer",
                backgroundColor: isSelected ? "var(--primary)" : "transparent",
                color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                border: isSelected ? "none" : "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {IconComponent && <IconComponent style={{ width: 12, height: 12 }} />}
              {tag}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: chips variant
  return (
    <div>
      {label && (
        <h3
          className="text-meta font-medium mb-2"
          style={{ color: "var(--text)" }}
        >
          {label}
          {required && <span style={{ color: "var(--error)" }}> *</span>}
        </h3>
      )}

      {hint && (
        <p className="text-micro mb-3" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {filteredTags.map((tag) => {
          const isSelected = value.includes(tag);
          const IconComponent = showIcons ? CONTEXT_TAG_ICONS[tag] : null;

          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border hover:bg-[var(--surface-subtle)]"
              }`}
              style={{
                borderColor: isSelected ? undefined : showError ? "var(--error)" : "var(--border)",
                color: isSelected ? undefined : "var(--text)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {IconComponent && <IconComponent style={{ width: 14, height: 14 }} />}
              {tag}
            </button>
          );
        })}
      </div>

      {showError && (
        <p className="text-micro mt-2" style={{ color: "var(--error)" }}>
          Please select at least one context tag
        </p>
      )}

      {value.length > 0 && (
        <div className="mt-3 text-micro" style={{ color: "var(--text-secondary)" }}>
          Selected: {value.join(", ")}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get filtered context tags based on user preferences.
 * Useful when you need the tag list without the picker UI.
 */
export function useFilteredContextTags() {
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});

  const filteredTags = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenContextTags ?? []).map((t: string) => t.toLowerCase()));
    return CONTEXT_TAGS.filter(tag => !hiddenSet.has(tag.toLowerCase()));
  }, [userPrefs?.hiddenContextTags]);

  return {
    contextTags: filteredTags,
    isLoading: userPrefs === undefined,
    allTags: CONTEXT_TAGS,
    icons: CONTEXT_TAG_ICONS,
  };
}
