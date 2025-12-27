import { ReactNode } from "react";

/**
 * Card - Design system enforced card component
 * 
 * Design rules:
 * - Always white background (--surface)
 * - 20px border radius (--card-radius)
 * - Consistent shadow (--shadow-card)
 * - 20px padding by default (--card-padding)
 */

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export default function Card({
  children,
  className = "",
  padding = "md",
  hover = false,
}: CardProps) {
  const paddingStyles = {
    none: "0",
    sm: "var(--space-4)",
    md: "var(--card-padding)",
    lg: "var(--space-6)",
  };

  return (
    <div
      className={[
        hover ? "transition-shadow hover:shadow-md" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--shadow-card)",
        padding: paddingStyles[padding],
      }}
    >
      {children}
    </div>
  );
}

// Card subcomponents for structured layouts
export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className} style={{ marginBottom: "var(--space-4)" }}>{children}</div>;
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={className}
      style={{ 
        color: "var(--text)",
        fontSize: "var(--text-h2)",
        fontWeight: "var(--text-h2-weight)",
      }}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p 
      className={className}
      style={{ 
        marginTop: "var(--space-1)",
        fontSize: "var(--text-meta)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div 
      className={`flex items-center gap-2 ${className}`} 
      style={{ 
        marginTop: "var(--space-4)",
        paddingTop: "var(--space-4)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}
