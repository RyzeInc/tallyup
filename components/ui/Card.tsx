import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export default function Card({ children, className = "", padding = "md", hover = false }: CardProps) {
  const paddingClass = {
    none: "",
    sm: "p-3",
    md: "p-4 lg:p-5",
    lg: "p-6 lg:p-8",
  }[padding];

  return (
    <div
      className={[
        "rounded-xl border bg-[var(--card)]",
        paddingClass,
        hover ? "transition-shadow hover:shadow-md" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

// Card subcomponents for structured layouts
export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-base font-semibold text-[var(--text)] ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mt-1 text-sm text-[var(--text-secondary)] ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t flex items-center gap-2 ${className}`} style={{ borderColor: "var(--border)" }}>
      {children}
    </div>
  );
}
