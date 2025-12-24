interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  const baseClass = "bg-[var(--surface-subtle)] animate-shimmer";
  
  const variantClass = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  }[variant];

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`${baseClass} ${variantClass} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Common skeleton patterns
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border bg-[var(--card)] p-4 ${className}`} style={{ borderColor: "var(--border)" }}>
      <div className="space-y-3">
        <Skeleton width="40%" height={16} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 py-3 ${className}`}>
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={12} />
      </div>
      <Skeleton width={60} height={14} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`rounded-xl border bg-[var(--card)] divide-y ${className}`} style={{ borderColor: "var(--border)" }}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton width={80} height={14} />
          <Skeleton className="flex-1" height={14} />
          <Skeleton width={60} height={14} />
        </div>
      ))}
    </div>
  );
}
