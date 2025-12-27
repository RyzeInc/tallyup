interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export default function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
  style: customStyle,
}: SkeletonProps) {
  const variantStyles: React.CSSProperties = {
    text: { height: "16px", borderRadius: "var(--radius-sm)" },
    circular: { borderRadius: "var(--radius-full)" },
    rectangular: { borderRadius: "var(--radius-md)" },
  }[variant];

  const style: React.CSSProperties = {
    backgroundColor: "var(--surface-2)",
    ...variantStyles,
  };
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`animate-pulse ${className}`}
      style={{ ...style, ...customStyle }}
      aria-hidden="true"
    />
  );
}

// Common skeleton patterns
export function SkeletonCard({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        ...style,
        borderRadius: "var(--card-radius)",
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width="40%" height={16} />
        <Skeleton width="100%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-3) 0" }}
    >
      <Skeleton variant="circular" width={40} height={40} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={12} />
      </div>
      <Skeleton width={60} height={14} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: "var(--card-radius)",
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            padding: "var(--space-4)",
            borderTop: i > 0 ? "1px solid var(--border)" : undefined,
          }}
        >
          <Skeleton width={80} height={14} />
          <Skeleton style={{ flex: 1 }} height={14} />
          <Skeleton width={60} height={14} />
        </div>
      ))}
    </div>
  );
}
