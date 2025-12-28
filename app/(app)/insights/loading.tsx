import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function InsightsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width={100} height={28} />
        <Skeleton width={120} height={32} variant="rectangular" style={{ borderRadius: 16 }} />
      </div>
      
      {/* KPI cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
        <SkeletonCard style={{ minHeight: 80 }} />
        <SkeletonCard style={{ minHeight: 80 }} />
        <SkeletonCard style={{ minHeight: 80 }} />
      </div>
      
      {/* Chart skeleton */}
      <SkeletonCard style={{ minHeight: 260 }} />
      
      {/* Insights list skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width={140} height={20} />
        <SkeletonCard style={{ minHeight: 60 }} />
        <SkeletonCard style={{ minHeight: 60 }} />
        <SkeletonCard style={{ minHeight: 60 }} />
      </div>
      
      {/* Categories skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <SkeletonCard style={{ minHeight: 200 }} />
        <SkeletonCard style={{ minHeight: 200 }} />
      </div>
    </div>
  );
}
