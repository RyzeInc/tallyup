import { ReactNode } from "react";
import * as Lucide from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        borderRadius: "var(--card-radius)",
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        padding: compact ? "40px 24px" : "64px 32px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: "var(--radius-full)",
          backgroundColor: "var(--surface-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        {icon ?? (
          <Lucide.Inbox
            className="h-7 w-7"
            style={{ color: "var(--text-tertiary)" }}
          />
        )}
      </div>
      <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text)" }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-meta)", color: "var(--text-secondary)", maxWidth: "24rem" }}>
          {subtitle}
        </p>
      )}
      {action && <div style={{ marginTop: "var(--space-5)" }}>{action}</div>}
    </div>
  );
}
