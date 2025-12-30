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
      className={`fixed z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 ${className}`}
      style={{
        backgroundColor: "var(--accent)",
        color: "var(--accent-foreground)",
        boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.35)",
        /* Position in bottom center, above the nav */
        bottom: "calc(84px + 12px)",
        left: "50%",
        transform: "translateX(-50%)",
      }}
      aria-label="Log new entry"
    >
      <Lucide.Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
