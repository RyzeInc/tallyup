export default function Pill({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const baseClass =
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  
  const activeStyles = {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  };
  
  const inactiveStyles = {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  };

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClass} ${active ? "" : "hover:bg-[var(--surface-subtle)]"}`}
        style={active ? activeStyles : inactiveStyles}
      >
        {children}
      </button>
    );
  }

  return (
    <span className={baseClass} style={active ? activeStyles : inactiveStyles}>
      {children}
    </span>
  );
}
