"use client";

import * as Lucide from "lucide-react";

export type ViewMode = "list" | "cards" | "calendar";

interface ViewSwitcherProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const VIEWS: Array<{ id: ViewMode; icon: React.ComponentType<{ className?: string }>; label: string }> = [
  { id: "list", icon: Lucide.List, label: "List" },
  { id: "cards", icon: Lucide.LayoutGrid, label: "Cards" },
  { id: "calendar", icon: Lucide.Calendar, label: "Calendar" },
];

export default function ViewSwitcher({ mode, onChange }: ViewSwitcherProps) {
  return (
    <div
      className="inline-flex p-1 rounded-lg"
      style={{ backgroundColor: "var(--surface-2)" }}
    >
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = mode === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onChange(view.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: isActive ? "var(--surface)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-secondary)",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
            title={view.label}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}
