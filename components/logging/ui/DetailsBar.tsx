"use client";

import * as React from "react";
import type { SheetKey, DetailCounts } from "../types";
import * as Lucide from "lucide-react";

type DetailItem = {
  label: string;
  sheet: Exclude<SheetKey, null>;
  badge?: string;
  prefix?: boolean;
};

export function DetailsBar({
  onOpen,
  counts,
}: {
  onOpen: (sheet: Exclude<SheetKey, null>) => void;
  counts: DetailCounts;
}) {
  const items: DetailItem[] = [
    {
      label: "Context",
      sheet: "context",
      badge: counts.hasContext ? "•" : undefined,
      prefix: true,
    },
    {
      label: "Intent",
      sheet: "intent",
      badge: counts.hasIntent ? "•" : undefined,
      prefix: true,
    },
    {
      label: "Account",
      sheet: "account",
      badge: counts.hasAccount ? "•" : undefined,
      prefix: true,
    },
    {
      label: "Tags",
      sheet: "tags",
      badge: counts.tags ? String(counts.tags) : undefined,
      prefix: true,
    },
    {
      label: "Note",
      sheet: "note",
      badge: counts.hasNote ? "•" : undefined,
      prefix: true,
    },
  ];

  const secondaryItems: DetailItem[] = [
    {
      label: "Recurring",
      sheet: "recurring",
      badge: counts.hasRecurring ? "On" : undefined,
    },
    {
      label: "Goal",
      sheet: "goal",
      badge: counts.hasGoal ? "On" : undefined,
    },
  ];

  const renderPill = (item: DetailItem) => {
    const hasBadge = !!item.badge;
    return (
      <button
        key={item.sheet}
        type="button"
        onClick={() => onOpen(item.sheet)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium transition-colors"
        style={{
          backgroundColor: hasBadge ? "var(--accent-subtle)" : "transparent",
          color: hasBadge ? "var(--primary)" : "var(--text-secondary)",
          border: hasBadge ? "1px solid var(--primary)" : "1px solid var(--border)",
        }}
      >
        {item.prefix && !hasBadge && (
          <Lucide.Plus className="h-3 w-3" />
        )}
        {item.label}
        {item.badge && (
          <span
            className="text-[10px]"
            style={{ color: "var(--primary)" }}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map(renderPill)}
      </div>
      <div className="flex flex-wrap gap-2">
        {secondaryItems.map(renderPill)}
      </div>
    </div>
  );
}
