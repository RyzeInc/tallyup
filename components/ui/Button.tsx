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
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
    md: "h-11 px-4 text-body rounded-xl gap-2",
    lg: "h-12 px-6 text-body rounded-xl gap-2",
    icon: "h-11 w-11 rounded-xl",
  };

  const variants: Record<string, string> = {
    primary: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-95 active:opacity-90",
    secondary: "bg-[var(--surface-subtle)] text-[var(--text)] hover:bg-[var(--border)]",
    ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
    destructive: "bg-[var(--danger)] text-white hover:opacity-90",
    outline: "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-subtle)]",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Lucide.Loader2 className="h-4 w-4 animate-spin" />
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
