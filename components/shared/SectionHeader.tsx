import { ReactNode } from "react";

/**
 * SectionHeader - Uppercase section label with optional action
 * 
 * Design patterns (Rocket Money-inspired):
 * - Uppercase, small, muted text
 * - Wide letter-spacing for readability
 * - Optional action button on right (e.g., "Dismiss", "Add Account")
 * - Consistent vertical spacing
 */

interface SectionHeaderProps {
  /** Section title (will be uppercased) */
  title: string;
  /** Optional action element on right */
  action?: ReactNode;
  /** Add top margin (default true) */
  marginTop?: boolean;
  /** Custom className */
  className?: string;
}

export default function SectionHeader({
  title,
  action,
  marginTop = true,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between ${className}`}
      style={{
        marginTop: marginTop ? "var(--space-6)" : 0,
        marginBottom: "var(--space-3)",
        paddingLeft: "var(--space-1)",
        paddingRight: "var(--space-1)",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </span>
      {action && (
        <div style={{ color: "var(--text-secondary)" }}>
          {action}
        </div>
      )}
    </div>
  );
}

// Dismissable section header variant
interface DismissableSectionHeaderProps {
  title: string;
  onDismiss: () => void;
  marginTop?: boolean;
}

export function DismissableSectionHeader({
  title,
  onDismiss,
  marginTop = true,
}: DismissableSectionHeaderProps) {
  return (
    <SectionHeader
      title={title}
      marginTop={marginTop}
      action={
        <button
          onClick={onDismiss}
          className="flex items-center gap-1"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            padding: "4px 8px",
            borderRadius: "6px",
            transition: "background var(--motion-fast) var(--ease-out)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-elevated)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          Dismiss
          <span style={{ fontSize: "16px", lineHeight: 1 }}>×</span>
        </button>
      }
    />
  );
}
