import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}

export default function EmptyState({ icon, title, subtitle, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-xl border bg-[var(--card)] ${
        compact ? "py-8 px-6" : "py-12 px-8"
      }`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)]">
        {icon ?? <Inbox className="h-6 w-6 text-[var(--text-tertiary)]" />}
      </div>
      <h3 className="text-base font-medium text-[var(--text)]">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-sm">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
