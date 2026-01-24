import { ReactNode } from "react";

/**
 * Card - Foam Card Component (Warm Sand / Coastal Theme)
 * 
 * Design rules (Coastal):
 * - Foam white background with subtle inner highlight
 * - Hairline border at low opacity (foam edge)
 * - Soft, wide shadow (foam softness)
 * - 20px border radius (--card-radius)
 * - Optional foam variant with top highlight (light catching foam)
 */

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  /** Use foam variant for premium card treatment with inner highlight */
  foam?: boolean;
}

export default function Card({
  children,
  className = "",
  padding = "md",
  hover = false,
  foam = false,
}: CardProps) {
  const paddingStyles = {
    none: "0",
    sm: "var(--space-4)",
    md: "var(--card-padding)",
    lg: "var(--space-6)",
  };

  // Foam card: subtle gradient top (light catching foam)
  const foamBackground = foam
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, var(--surface) 12%)"
    : "var(--surface)";

  // Foam shadow includes inner highlight
  const foamShadow = foam
    ? "var(--shadow-foam), inset 0 1px 0 rgba(255, 255, 255, 0.8)"
    : "var(--shadow-card)";

  return (
    <div
      className={[
        hover ? "transition-all hover:shadow-md" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: foamBackground,
        color: "var(--text)",
        border: "1px solid var(--border-foam, var(--border))",
        borderRadius: "var(--card-radius)",
        boxShadow: foamShadow,
        padding: paddingStyles[padding],
        transition: "box-shadow var(--motion-medium) var(--ease-wave, ease-out), transform var(--motion-medium) var(--ease-wave, ease-out)",
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
