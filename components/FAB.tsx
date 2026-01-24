"use client";

import * as Lucide from "lucide-react";
import { useQuickLog } from "./log/QuickLogProvider";

interface FABProps {
  className?: string;
}

export default function FAB({ className = "" }: FABProps) {
  const { open } = useQuickLog();

  return (
    <button
      onClick={open}
      className={`fixed z-40 flex h-14 w-14 items-center justify-center rounded-full transition-all ${className}`}
      style={{
        background: "var(--btn-primary-gradient, var(--primary))",
        color: "var(--primary-foreground)",
        boxShadow: "var(--shadow-fab)",
        /* Position in bottom center, above the nav */
        bottom: "calc(84px + 12px)",
        left: "50%",
        transform: "translateX(-50%)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateX(-50%) scale(1.05)";
        e.currentTarget.style.boxShadow = "0 6px 24px -2px rgba(196, 114, 74, 0.50)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateX(-50%) scale(1)";
        e.currentTarget.style.boxShadow = "var(--shadow-fab)";
      }}
      aria-label="Log new entry"
    >
      <Lucide.Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
