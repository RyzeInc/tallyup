export default function Pill({ children, active = false, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  const className = ["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", active ? "bg-accent text-accent-foreground" : "bg-neutral-100 text-neutral-700"].join(" ");
  if (onClick) {
    return (
      <button onClick={onClick} className={className} style={{ border: active ? undefined : "1px solid var(--border)" }}>
        {children}
      </button>
    );
  }
  return (
    <span className={className} style={{ border: active ? undefined : "1px solid var(--border)" }}>
      {children}
    </span>
  );
}
