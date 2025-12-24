export default function Skeleton({ className = "h-4 w-full rounded bg-neutral-800/20" }: { className?: string }) {
  return <div className={className} aria-hidden="true" />;
}
