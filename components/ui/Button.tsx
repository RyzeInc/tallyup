"use client";

import React from "react";
import * as Lucide from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  // Base styles using design tokens
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    transition: "all 0.15s ease",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.5 : 1,
    border: "none",
    outline: "none",
  };

  // Size styles - ensuring 44px minimum for accessibility
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      minHeight: 36,
      minWidth: 36,
      padding: "0 var(--space-3)",
      fontSize: "var(--text-sm)",
      borderRadius: "var(--radius-md)",
      gap: "var(--space-1)",
    },
    md: {
      minHeight: 44, // Accessibility minimum
      minWidth: 44,
      padding: "0 var(--space-4)",
      fontSize: "var(--text-base)",
      borderRadius: "var(--radius-lg)",
      gap: "var(--space-2)",
    },
    lg: {
      minHeight: "var(--button-height)", // 48px
      minWidth: 48,
      padding: "0 var(--space-6)",
      fontSize: "var(--text-base)",
      borderRadius: "var(--radius-lg)",
      gap: "var(--space-2)",
    },
    icon: {
      minHeight: 44, // Accessibility minimum
      minWidth: 44,
      padding: 0,
      borderRadius: "var(--radius-lg)",
    },
  };

  // Variant styles using design tokens
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--primary)",
      color: "#FFFFFF",
    },
    secondary: {
      backgroundColor: "var(--surface-2)",
      color: "var(--text)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
    },
    destructive: {
      backgroundColor: "var(--danger)",
      color: "#FFFFFF",
    },
    outline: {
      backgroundColor: "transparent",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
  };

  const combinedStyle: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      style={combinedStyle}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <Lucide.Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}
