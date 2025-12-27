import Skeleton, { SkeletonRow } from "@/components/ui/Skeleton";

export default function ActivityLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header skeleton */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4)",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Skeleton width={120} height={24} />
          <Skeleton width={80} height={14} />
        </div>
        <Skeleton width={100} height={36} variant="rectangular" />
      </div>

      {/* Search skeleton */}
      <Skeleton width="100%" height={48} variant="rectangular" />

      {/* Filter chips skeleton */}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Skeleton width={60} height={36} variant="rectangular" />
        <Skeleton width={80} height={36} variant="rectangular" />
        <Skeleton width={90} height={36} variant="rectangular" />
      </div>

      {/* Rows skeleton */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--border)",
          padding: "var(--space-4)",
        }}
      >
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
