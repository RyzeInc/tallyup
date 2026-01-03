"use client";

import * as Lucide from "lucide-react";

export default function ObligationsHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          Recurring
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Track your recurring bills and income
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
        style={{ backgroundColor: "var(--primary)", color: "#fff" }}
      >
        <Lucide.Plus className="h-4 w-4" />
        New rule
      </button>
    </div>
  );
}
