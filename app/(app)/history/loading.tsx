import Skeleton, { SkeletonRow } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header with search skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width={120} height={28} />
        <Skeleton width={36} height={36} variant="circular" />
      </div>
      
      {/* Filter bar skeleton */}
      <div style={{ display: "flex", gap: "var(--space-2)", overflowX: "auto" }}>
        <Skeleton width={80} height={32} variant="rectangular" style={{ borderRadius: 16 }} />
        <Skeleton width={100} height={32} variant="rectangular" style={{ borderRadius: 16 }} />
        <Skeleton width={90} height={32} variant="rectangular" style={{ borderRadius: 16 }} />
      </div>
      
      {/* Entry list skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width={80} height={16} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width={100} height={16} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
