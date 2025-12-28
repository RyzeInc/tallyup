import Skeleton, { SkeletonCard, SkeletonRow } from "@/components/ui/Skeleton";

export default function RecurringLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Skeleton width={160} height={28} />
          <Skeleton width={200} height={16} style={{ marginTop: 8 }} />
        </div>
        <Skeleton width={100} height={36} variant="rectangular" style={{ borderRadius: "var(--card-radius)" }} />
      </div>
      
      {/* Stats skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-3)" }}>
        <SkeletonCard style={{ minHeight: 80 }} />
        <SkeletonCard style={{ minHeight: 80 }} />
      </div>
      
      {/* Rules list skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width={120} height={20} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
