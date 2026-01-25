"use client";

import { ReactNode } from "react";

/**
 * SectionHeader - Uppercase muted section labels (Rocket Money style)
 * 
 * Design rules:
 * - ALL CAPS text with letter-spacing
 * - Muted color (text-secondary)
 * - Small font size
 * - Optional action button on right
 * - Consistent vertical spacing
 */

interface SectionHeaderProps {
  /** Section title (will be uppercased) */
  title: string;
  /** Optional action text/button on the right */
  action?: ReactNode;
  /** Action click handler */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to add top margin */
  withTopMargin?: boolean;
}

export default function SectionHeader({
  title,
  action,
  onAction,
  className = "",
  withTopMargin = true,
}: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between ${className}`}
      style={{
        marginTop: withTopMargin ? "var(--space-6, 24px)" : 0,
        marginBottom: "var(--space-3, 12px)",
        paddingLeft: "var(--space-1, 4px)",
        paddingRight: "var(--space-1, 4px)",
      }}
    >
      <h3
        style={{
          fontSize: "var(--text-micro, 11px)",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-secondary, var(--muted))",
          margin: 0,
        }}
      >
        {title}
      </h3>
      
      {action && (
        typeof action === "string" && onAction ? (
          <button
            onClick={onAction}
            style={{
              fontSize: "var(--text-meta, 13px)",
              fontWeight: 500,
              color: "var(--accent, var(--primary))",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            {action}
          </button>
        ) : (
          <span
            style={{
              fontSize: "var(--text-meta, 13px)",
              color: "var(--text-secondary, var(--muted))",
            }}
          >
            {action}
          </span>
        )
      )}
    </div>
  );
}

/**
 * SectionDivider - Subtle divider between sections
 */
export function SectionDivider({ className = "" }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        height: 1,
        backgroundColor: "var(--border)",
        marginTop: "var(--space-4, 16px)",
        marginBottom: "var(--space-4, 16px)",
      }}
    />
  );
}
