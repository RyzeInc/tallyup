import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function HomeLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Balance card skeleton */}
      <SkeletonCard style={{ minHeight: 140 }} />
      
      {/* Quick actions skeleton */}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <Skeleton width={100} height={44} variant="rectangular" style={{ borderRadius: "var(--card-radius)" }} />
        <Skeleton width={100} height={44} variant="rectangular" style={{ borderRadius: "var(--card-radius)" }} />
      </div>
      
      {/* Today section skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width={80} height={20} />
        <SkeletonCard style={{ minHeight: 72 }} />
        <SkeletonCard style={{ minHeight: 72 }} />
        <SkeletonCard style={{ minHeight: 72 }} />
      </div>
      
      {/* Yesterday section skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Skeleton width={100} height={20} />
        <SkeletonCard style={{ minHeight: 72 }} />
        <SkeletonCard style={{ minHeight: 72 }} />
      </div>
    </div>
  );
}
