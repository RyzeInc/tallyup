import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function InboxLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header skeleton */}
      <div>
        <Skeleton width={140} height={28} />
        <Skeleton width={220} height={16} style={{ marginTop: 8 }} />
      </div>
      
      {/* Review items skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <SkeletonCard style={{ minHeight: 120 }} />
        <SkeletonCard style={{ minHeight: 120 }} />
        <SkeletonCard style={{ minHeight: 120 }} />
      </div>
    </div>
  );
}
