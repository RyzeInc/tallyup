import { ReactNode } from "react";

/**
 * PageHeader - Consistent header for all pages
 * 
 * Design rules:
 * - Title sits at same baseline across all tabs
 * - Uses design system typography tokens
 * - Right slot for contextual actions (time range, overflow)
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  compact?: boolean;
}

export default function PageHeader({ title, subtitle, rightSlot, compact = false }: PageHeaderProps) {
  return (
    <div 
      className="flex items-start justify-between"
      style={{ 
        marginBottom: compact ? "var(--space-4)" : "var(--space-6)",
        gap: "var(--space-4)",
      }}
    >
      <div className="flex-1 min-w-0">
        <h1 
          className="text-h1 truncate"
          style={{ 
            color: "var(--text)",
            fontSize: "var(--text-h1)",
            fontWeight: "var(--text-h1-weight)",
            letterSpacing: "var(--text-h1-tracking)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p 
            className="text-meta mt-1 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && (
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
