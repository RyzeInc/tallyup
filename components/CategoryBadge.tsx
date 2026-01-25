"use client";

import * as Lucide from "lucide-react";

/**
 * CategoryBadge - Colored circular category icon (Rocket Money style)
 * 
 * Design rules:
 * - Circular background with category-specific color
 * - Icon centered within the circle
 * - Size variants: sm (32px), md (40px), lg (48px)
 * - Colors follow the category badge system from CSS variables
 */

// Category to color index mapping
const categoryColorMap: Record<string, number> = {
  // Income categories (green tones)
  income: 1,
  salary: 1,
  paycheck: 1,
  freelance: 1,
  
  // Bills & utilities (blue tones)
  bills: 2,
  utilities: 2,
  rent: 2,
  mortgage: 2,
  
  // Food & dining (purple/pink)
  food: 3,
  dining: 3,
  restaurants: 3,
  groceries: 3,
  
  // Shopping (teal)
  shopping: 4,
  clothing: 4,
  retail: 4,
  
  // Transportation (blue)
  transport: 5,
  gas: 5,
  auto: 5,
  car: 5,
  
  // Entertainment (orange)
  entertainment: 6,
  subscriptions: 6,
  streaming: 6,
  
  // Health & fitness (teal/cyan)
  health: 7,
  fitness: 7,
  gym: 7,
  medical: 7,
  
  // Education (purple)
  education: 8,
  loans: 8,
  "student loan": 8,
  
  // Default for unknown
  default: 2,
};

// Category to icon mapping
const categoryIconMap: Record<string, keyof typeof Lucide> = {
  // Income
  income: "DollarSign",
  salary: "DollarSign",
  paycheck: "Banknote",
  freelance: "Briefcase",
  
  // Bills
  bills: "Receipt",
  utilities: "Zap",
  rent: "Home",
  mortgage: "Building2",
  
  // Food
  food: "UtensilsCrossed",
  dining: "UtensilsCrossed",
  restaurants: "UtensilsCrossed",
  groceries: "ShoppingCart",
  
  // Shopping
  shopping: "ShoppingBag",
  clothing: "Shirt",
  retail: "Store",
  
  // Transport
  transport: "Car",
  gas: "Fuel",
  auto: "Car",
  car: "Car",
  
  // Entertainment
  entertainment: "Tv",
  subscriptions: "CreditCard",
  streaming: "Play",
  
  // Health
  health: "Heart",
  fitness: "Dumbbell",
  gym: "Dumbbell",
  medical: "Stethoscope",
  
  // Education
  education: "GraduationCap",
  loans: "Building2",
  "student loan": "GraduationCap",
  
  // Fallbacks
  transfer: "ArrowLeftRight",
  refund: "RotateCcw",
  fee: "AlertCircle",
  interest: "Percent",
  default: "CircleDot",
};

interface CategoryBadgeProps {
  category?: string | null;
  /** Custom icon override */
  icon?: keyof typeof Lucide;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom color index (1-8) */
  colorIndex?: number;
  /** Additional CSS classes */
  className?: string;
  /** Is this an income/positive transaction? */
  isIncome?: boolean;
}

export default function CategoryBadge({
  category,
  icon,
  size = "md",
  colorIndex,
  className = "",
  isIncome = false,
}: CategoryBadgeProps) {
  // Normalize category for lookup
  const normalizedCategory = category?.toLowerCase().trim() || "default";
  
  // Determine color index
  const resolvedColorIndex = colorIndex ?? (
    isIncome ? 1 : (categoryColorMap[normalizedCategory] ?? categoryColorMap.default)
  );
  
  // Determine icon
  const iconName = icon ?? (
    isIncome ? "DollarSign" : (categoryIconMap[normalizedCategory] ?? categoryIconMap.default)
  );
  
  // Get the icon component
  // Lucide icon components are SVG elements — use the SVG props type so
  // properties like `style` are accepted (e.g., color via inline style).
  const IconComponent = Lucide[iconName as keyof typeof Lucide] as React.ComponentType<
    React.SVGProps<SVGSVGElement>
  >;

  // Size styles
  const sizeStyles = {
    sm: { width: 32, height: 32, iconSize: "h-4 w-4" },
    md: { width: 40, height: 40, iconSize: "h-5 w-5" },
    lg: { width: 48, height: 48, iconSize: "h-6 w-6" },
  };

  const { width, height, iconSize } = sizeStyles[size];

  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{
        width,
        height,
        backgroundColor: `var(--category-badge-${resolvedColorIndex}, var(--accent-soft))`,
      }}
    >
      {IconComponent && (
        <IconComponent
          className={iconSize}
          strokeWidth={2}
          style={{
            color: `var(--category-badge-${resolvedColorIndex}-text, var(--text))`,
          } as React.CSSProperties}
        />
      )}
    </div>
  );
}

/**
 * Get color index for a category (useful for charts, etc.)
 */
export function getCategoryColorIndex(category?: string | null, isIncome?: boolean): number {
  if (isIncome) return 1;
  const normalized = category?.toLowerCase().trim() || "default";
  return categoryColorMap[normalized] ?? categoryColorMap.default;
}

/**
 * Generate CSS color from category
 */
export function getCategoryColor(category?: string | null, isIncome?: boolean): string {
  const index = getCategoryColorIndex(category, isIncome);
  return `var(--category-badge-${index})`;
}
