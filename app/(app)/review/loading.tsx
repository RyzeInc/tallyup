import Skeleton, { SkeletonCard, SkeletonRow } from "@/components/ui/Skeleton";

export default function ReviewLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {/* Header skeleton */}
      <Skeleton style={{ height: 28, width: 180 }} />

      {/* Card skeletons */}
      <SkeletonCard style={{ minHeight: 100 }} />
      <SkeletonCard style={{ minHeight: 100 }} />
      <SkeletonCard style={{ minHeight: 100 }} />

      {/* Row skeletons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
