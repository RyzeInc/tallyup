"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { centsToDollars, getCategoryDisplayName } from "@/components/utils";
import { useOptimisticLinks } from "@/components/OptimisticLinksProvider";
import Link from "next/link";

// Context tag icons - shared with ContextTagPicker
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

export interface EntryPreviewProps {
  /** The entry to display */
  entry: Doc<"entries">;
  /** Visual variant */
  variant?: "card" | "compact" | "inline";
  /** Whether to show the full date or just month/day */
  dateFormat?: "full" | "short";
  /** Whether clicking navigates to the edit page */
  clickable?: boolean;
  /** Custom link href override */
  linkHref?: string;
  /** Whether the entry is selected (for multi-select scenarios) */
  selected?: boolean;
  /** Selection toggle callback */
  onSelect?: () => void;
  /** Custom right slot content */
  rightSlot?: React.ReactNode;
  /** Whether to show category/area chips */
  showCategory?: boolean;
  /** Whether to show context tags */
  showContextTags?: boolean;
  /** Whether to show the review badge */
  showReviewBadge?: boolean;
  /** Whether to show recurring indicator */
  showRecurringIndicator?: boolean;
  /** Additional className */
  className?: string;
  /** onClick handler for custom actions */
  onClick?: () => void;
}

/**
 * Unified EntryPreview component for consistent entry display across the app.
 * Combines the best patterns from ActivityTable (card view) and EntryCard.
 * Supports multiple variants and is fully customizable.
 */
export function EntryPreview({
  entry,
  variant = "card",
  dateFormat = "short",
  clickable = true,
  linkHref,
  selected,
  onSelect,
  rightSlot,
  showCategory = true,
  showContextTags = true,
  showReviewBadge = true,
  showRecurringIndicator = true,
  className = "",
  onClick,
}: EntryPreviewProps) {
  // Optimistic link context
  const optimisticLinks = useOptimisticLinks();
  const isOptimistic = optimisticLinks?.has(entry._id) ?? false;

  // Fetch custom categories for display name resolution
  const expenseCategories = useQuery(api.categories.listCategories, { categoryType: "expense" });
  const incomeCategories = useQuery(api.categories.listCategories, { categoryType: "income" });
  const allCustomCategories = useMemo(() => {
    const expense = (expenseCategories ?? []) as { _id: string; name: string }[];
    const income = (incomeCategories ?? []) as { _id: string; name: string }[];
    return [...expense, ...income];
  }, [expenseCategories, incomeCategories]);

  // Computed values
  const isIncome = entry.type === "income";
  const amountColor = isIncome ? "var(--success)" : "var(--text)";
  const amountPrefix = isIncome ? "+" : "−";
  const categoryKey = entry.categoryId ?? entry.category ?? entry.bucket;
  const categoryLabel = getCategoryDisplayName(categoryKey, allCustomCategories);
  const contextTags = entry.contextTags ?? [];
  const tags = entry.tags ?? [];

  // Date formatting
  const formattedDate = useMemo(() => {
    const date = new Date(entry.date);
    if (dateFormat === "full") {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [entry.date, dateFormat]);

  const href = linkHref ?? `/activity?edit=${entry._id}`;

  // Handle click
  const handleClick = () => {
    if (onSelect && selected !== undefined) {
      onSelect();
      return;
    }
    if (onClick) {
      onClick();
      return;
    }
  };

  // Common icon element (not a component to avoid re-creation on each render)
  const typeIconElement = (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{
        backgroundColor: isIncome ? "var(--success-subtle)" : "var(--surface-subtle)",
      }}
    >
      {isIncome ? (
        <Lucide.ArrowDownLeft className="h-5 w-5" style={{ color: "var(--success)" }} />
      ) : (
        <Lucide.ArrowUpRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
      )}
    </div>
  );

  // Compact variant - minimal, single line
  if (variant === "compact") {
    const content = (
      <div
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors ${className}`}
        onClick={handleClick}
        style={{ cursor: clickable || onClick ? "pointer" : "default" }}
      >
        {selected !== undefined && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-4 w-4 rounded shrink-0"
            style={{ accentColor: "var(--primary)" }}
          />
        )}
        <span
          className="text-sm font-medium truncate flex-1"
          style={{ color: "var(--text)" }}
        >
          {entry.merchant || categoryLabel}
        </span>
        <span
          className="text-sm font-semibold tabular-nums shrink-0"
          style={{ color: amountColor }}
        >
          {amountPrefix}{centsToDollars(Math.abs(entry.amountCents))}
        </span>
        {rightSlot}
      </div>
    );

    if (clickable && !onClick && !onSelect) {
      return <Link href={href}>{content}</Link>;
    }
    return content;
  }

  // Inline variant - for lists and tables
  if (variant === "inline") {
    const content = (
      <div
        className={`flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-subtle)] transition-colors ${className}`}
        onClick={handleClick}
        style={{ cursor: clickable || onClick ? "pointer" : "default" }}
      >
        {selected !== undefined && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-5 w-5 rounded shrink-0"
            style={{ accentColor: "var(--primary)" }}
          />
        )}
        {typeIconElement}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
              {entry.merchant || categoryLabel}
            </span>
            {showReviewBadge && entry.needsReview && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning)" }}
              >
                Review
              </span>
            )}
            {showRecurringIndicator && (entry.recurringRuleId || isOptimistic) && (
              <Lucide.Repeat className="h-3 w-3 shrink-0" style={{ color: "var(--text-tertiary)" }} />
            )}
          </div>
          {showCategory && categoryLabel !== (entry.merchant || categoryLabel) && (
            <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {categoryLabel}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-sm font-semibold tabular-nums"
            style={{ color: amountColor }}
          >
            {amountPrefix}{centsToDollars(Math.abs(entry.amountCents))}
          </div>
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {formattedDate}
          </div>
        </div>
        {rightSlot}
      </div>
    );

    if (clickable && !onClick && !onSelect) {
      return <Link href={href}>{content}</Link>;
    }
    return content;
  }

  // Card variant (default) - full featured card display
  const content = (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-[var(--surface)] transition-colors ${clickable || onClick ? "cursor-pointer hover:bg-[var(--surface-subtle)]" : ""} ${className}`}
      onClick={handleClick}
    >
      {/* Checkbox for selection */}
      {selected !== undefined && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-5 w-5 rounded shrink-0"
          style={{ accentColor: "var(--primary)" }}
        />
      )}

      {/* Type Icon */}
      {typeIconElement}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Primary: Title */}
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold truncate" style={{ color: "var(--text)" }}>
            {entry.merchant || categoryLabel}
          </span>
          {showReviewBadge && entry.needsReview && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold"
              style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning)" }}
            >
              Review
            </span>
          )}
        </div>

        {/* Note */}
        {entry.note && (
          <div className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
            {entry.note}
          </div>
        )}

        {/* Secondary: Category · Tags */}
        <div className="flex items-center gap-1.5 text-meta truncate" style={{ color: "var(--text-secondary)" }}>
          {showCategory && <span>{categoryLabel}</span>}
          {showRecurringIndicator && (entry.recurringRuleId || isOptimistic) && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-tertiary)" }}
            >
              Recurring
            </span>
          )}
          {tags.length > 0 && (
            <>
              <span style={{ color: "var(--text-tertiary)" }}>·</span>
              {tags.slice(0, 2).map((tag: string) => (
                <span key={tag} className="inline-flex items-center">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full mr-1"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                  <span className="text-[11px]">{tag}</span>
                </span>
              ))}
            </>
          )}
        </div>

        {/* Context Tags */}
        {showContextTags && contextTags.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {contextTags.slice(0, 3).map((tag: string) => {
              const Icon = CONTEXT_TAG_ICONS[tag];
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5"
                  style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-secondary)" }}
                >
                  {Icon && <Icon style={{ width: 10, height: 10 }} />}
                  {tag}
                </span>
              );
            })}
            {contextTags.length > 3 && (
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                +{contextTags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Method/Account */}
        {entry.methodOrAccount && (
          <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {entry.methodOrAccount}
          </div>
        )}
      </div>

      {/* Amount + Date */}
      <div className="shrink-0 text-right">
        <div
          className="text-body font-semibold tabular-nums"
          style={{ color: amountColor }}
        >
          {amountPrefix}{centsToDollars(Math.abs(entry.amountCents))}
        </div>
        <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
          {formattedDate}
        </div>
      </div>

      {/* Custom Right Slot */}
      {rightSlot}
    </div>
  );

  if (clickable && !onClick && !onSelect) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

/**
 * EntryPreviewList - Wrapper component for rendering multiple entries
 * with proper borders and container styling.
 */
export function EntryPreviewList({
  entries,
  variant = "card",
  emptyMessage = "No entries",
  className = "",
  ...props
}: {
  entries: Doc<"entries">[];
  emptyMessage?: string;
  className?: string;
} & Omit<EntryPreviewProps, "entry">) {
  if (entries.length === 0) {
    return (
      <div
        className={`rounded-xl p-8 text-center ${className}`}
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-meta" style={{ color: "var(--text-secondary)" }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {entries.map((entry, i) => (
        <div
          key={entry._id}
          className={i > 0 ? "border-t" : ""}
          style={{ borderColor: "var(--border)" }}
        >
          <EntryPreview entry={entry} variant={variant} {...props} />
        </div>
      ))}
    </div>
  );
}
