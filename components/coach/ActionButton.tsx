"use client";

import * as Lucide from "lucide-react";

/**
 * ActionButton - Contextual action button for coach responses
 * 
 * Used within coach responses for quick actions.
 */

type ActionType = "goal" | "budget" | "transfer" | "review" | "schedule" | "learn" | "custom";

interface ActionButtonProps {
  type?: ActionType;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: "filled" | "outlined" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const typeIcons: Record<ActionType, React.ReactNode> = {
  goal: <Lucide.Target style={{ width: 16, height: 16 }} />,
  budget: <Lucide.PieChart style={{ width: 16, height: 16 }} />,
  transfer: <Lucide.ArrowRightLeft style={{ width: 16, height: 16 }} />,
  review: <Lucide.Eye style={{ width: 16, height: 16 }} />,
  schedule: <Lucide.Calendar style={{ width: 16, height: 16 }} />,
  learn: <Lucide.BookOpen style={{ width: 16, height: 16 }} />,
  custom: <Lucide.Zap style={{ width: 16, height: 16 }} />,
};

export default function ActionButton({
  type = "custom",
  label,
  onClick,
  icon,
  variant = "outlined",
  disabled = false,
  loading = false,
  className = "",
}: ActionButtonProps) {
  const displayIcon = icon || typeIcons[type];

  const variantStyles: Record<string, React.CSSProperties> = {
    filled: {
      backgroundColor: "var(--primary)",
      color: "#FFFFFF",
      border: "none",
    },
    outlined: {
      backgroundColor: "transparent",
      color: "var(--primary)",
      border: "1.5px solid var(--primary)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
      border: "1.5px solid var(--border)",
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-xl font-medium transition-all ${className}`}
      style={{
        padding: "10px 16px",
        fontSize: "var(--text-meta)",
        ...variantStyles[variant],
        opacity: disabled || loading ? 0.5 : 1,
        cursor: disabled || loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? (
        <Lucide.Loader2 
          className="animate-spin" 
          style={{ width: 16, height: 16 }} 
        />
      ) : (
        displayIcon
      )}
      <span>{label}</span>
    </button>
  );
}
