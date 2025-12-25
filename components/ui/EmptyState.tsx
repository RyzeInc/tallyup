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
      className={`flex flex-col items-center justify-center text-center rounded-2xl ${
        compact ? "py-10 px-6" : "py-16 px-8"
      }`}
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--surface-subtle)" }}
      >
        {icon ?? (
          <Lucide.Inbox
            className="h-7 w-7"
            style={{ color: "var(--text-tertiary)" }}
          />
        )}
      </div>
      <h3 className="text-h2" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      {subtitle && (
        <p className="mt-2 text-meta max-w-sm">{subtitle}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
