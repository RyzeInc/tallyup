"use client";

import * as React from "react";
import type { CategoryOption } from "../types";

export function CategorySuggestionRow({
  suggestions,
  selectedId,
  onPick,
  showWhenEmptyOnly = true,
}: {
  suggestions: CategoryOption[];
  selectedId?: string;
  onPick: (id: string) => void;
  showWhenEmptyOnly?: boolean;
}) {
  const shouldShow = showWhenEmptyOnly ? !selectedId : true;
  if (!shouldShow || suggestions.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1">
      {suggestions.slice(0, 8).map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          className="shrink-0 h-8 px-3 text-xs font-medium rounded-full transition-colors"
          style={{
            backgroundColor:
              selectedId === s.id ? "var(--primary)" : "var(--surface-subtle)",
            color:
              selectedId === s.id
                ? "var(--primary-foreground)"
                : "var(--text-secondary)",
            border:
              selectedId === s.id
                ? "1px solid var(--primary)"
                : "1px solid var(--border)",
          }}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
