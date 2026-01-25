import { ReactNode } from "react";

/**
 * Card - Premium Floating Card Component
 * 
 * Design principles (Rocket Money-inspired upgrade):
 * - Floating cards with premium shadows for depth
 * - Theme-aware styling using CSS custom properties
 * - Optional variants: foam (coastal), sea (ocean accent), float (premium depth)
 * - Responsive border radius and padding
 * 
 * Variants:
 * - Default: Clean surface with subtle shadow
 * - Float: Premium floating effect with deeper shadow
 * - Foam: Inner highlight for premium feel (coastal)
 * - Sea: Sea-green gradient accent (coastal)
 */

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  /** Use foam variant for premium card treatment with inner highlight */
  foam?: boolean;
  /** Use sea variant for cards that should feel more "ocean" */
  sea?: boolean;
  /** Use float variant for premium floating card with deeper shadow */
  float?: boolean;
}

export default function Card({
  children,
  className = "",
  padding = "md",
  hover = false,
  foam = false,
  sea = false,
  float = false,
}: CardProps) {
  const paddingStyles = {
    none: "0",
    sm: "var(--space-4)",
    md: "var(--card-padding)",
    lg: "var(--space-6)",
  };

  // Sea card: subtle sea-green gradient from top
  // Foam card: subtle white gradient top (light catching foam)
  // Float card: clean white/surface for maximum contrast
  // Default: solid surface
  const cardBackground = sea
    ? "linear-gradient(180deg, rgba(90, 154, 148, 0.04) 0%, var(--surface) 25%)"
    : foam
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, var(--surface) 12%)"
    : float
    ? "var(--surface)"
    : "var(--surface)";

  // Border: sea-green tinted for sea variant, subtle for float, foam border for others
  const cardBorder = sea
    ? "1px solid rgba(90, 154, 148, 0.22)"
    : float
    ? "1px solid var(--border)"
    : "1px solid var(--border-foam, var(--border))";

  // Float shadow: premium deep shadow from CSS variable
  // Foam shadow includes inner highlight
  const cardShadow = float
    ? "var(--floating-card-shadow, 0 4px 24px rgba(0, 0, 0, 0.08))"
    : foam
    ? "var(--shadow-foam), inset 0 1px 0 rgba(255, 255, 255, 0.8)"
    : "var(--shadow-card)";

  // Build class names including float utility class
  const classNames = [
    hover ? "card-hover" : "",
    float ? "floating-card" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      style={{
        background: cardBackground,
        color: "var(--text)",
        border: cardBorder,
        borderRadius: "var(--card-radius)",
        boxShadow: cardShadow,
        padding: paddingStyles[padding],
        transition: "border-color var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out)",
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
