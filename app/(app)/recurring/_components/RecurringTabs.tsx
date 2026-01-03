"use client";

import * as Lucide from "lucide-react";

export type RecurringTabId = "overview" | "upcoming" | "rules" | "inbox" | "insights";

const TABS: Array<{ id: RecurringTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Overview", icon: Lucide.LayoutDashboard },
  { id: "upcoming", label: "Upcoming", icon: Lucide.CalendarClock },
  { id: "rules", label: "Recurring rules", icon: Lucide.Repeat },
  { id: "inbox", label: "Inbox", icon: Lucide.Inbox },
  { id: "insights", label: "Insights", icon: Lucide.LineChart },
];

export default function RecurringTabs({
  activeTab,
  onChange,
  inboxCount,
}: {
  activeTab: RecurringTabId;
  onChange: (tab: RecurringTabId) => void;
  inboxCount: number;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--surface-2)" }}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              backgroundColor: isActive ? "var(--surface)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-secondary)",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {tab.id === "inbox" && inboxCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isActive ? "var(--warning)" : "var(--surface-subtle)",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                }}
              >
                {inboxCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
