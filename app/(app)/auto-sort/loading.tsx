import Skeleton, { SkeletonRow } from "@/components/ui/Skeleton";

export default function RulesLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Skeleton width={80} height={28} />
          <Skeleton width={180} height={16} style={{ marginTop: 8 }} />
        </div>
        <Skeleton width={100} height={36} variant="rectangular" style={{ borderRadius: "var(--card-radius)" }} />
      </div>
      
      {/* Rules list skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
