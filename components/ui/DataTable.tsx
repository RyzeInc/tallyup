import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string | ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyState,
  loading = false,
  className = "",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={`overflow-hidden rounded-xl border bg-[var(--card)] ${className}`} style={{ borderColor: "var(--border)" }}>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-4 w-24 rounded bg-[var(--surface-subtle)] animate-shimmer" />
              <div className="h-4 flex-1 rounded bg-[var(--surface-subtle)] animate-shimmer" />
              <div className="h-4 w-20 rounded bg-[var(--surface-subtle)] animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-[var(--card)] ${className}`} style={{ borderColor: "var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[var(--surface-subtle)]" style={{ borderColor: "var(--border)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide ${col.headerClassName ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors ${
                  onRowClick
                    ? "cursor-pointer hover:bg-[var(--surface-subtle)]"
                    : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-[var(--text)] ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple table wrapper for custom table content
export function TableWrapper({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border bg-[var(--card)] ${className}`} style={{ borderColor: "var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}
