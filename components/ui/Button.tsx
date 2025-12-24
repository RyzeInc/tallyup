"use client";

import React from "react";

export default function Button({ children, variant = "primary", size = "md", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "destructive"; size?: "sm" | "md" | "lg" }) {
  const base = "inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const sizes: Record<string, string> = { sm: "px-2 py-1 text-sm", md: "px-3 py-2 text-sm", lg: "px-4 py-2 text-base" };
  const variants: Record<string, string> = {
    primary: "bg-accent text-accent-foreground hover:brightness-95",
    secondary: "bg-secondary text-secondary-foreground border border-border",
    ghost: "bg-transparent text-text-muted",
    destructive: "bg-danger text-accent-foreground",
  };

  return (
    <button className={[base, sizes[size], variants[variant]].join(" ")} {...rest}>
      {children}
    </button>
  );
}
