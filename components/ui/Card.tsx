export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={["rounded-2xl border p-4", className].join(" ")} style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }}>
      {children}
    </div>
  );
}
