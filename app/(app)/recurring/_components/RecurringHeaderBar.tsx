"use client";

import * as Lucide from "lucide-react";

export default function RecurringHeaderBar({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          Recurring
        </div>
        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Rules, upcoming charges, and inbox decisions
        </div>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
        style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
      >
        <Lucide.Plus className="h-4 w-4" />
        New rule
      </button>
    </div>
  );
}
