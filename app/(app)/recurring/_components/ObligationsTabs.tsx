"use client";

import * as Lucide from "lucide-react";

export type ObligationsTabId = "this_month" | "rules" | "inbox" | "plaid_streams" | "insights";

const TABS: Array<{
  id: ObligationsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "this_month", label: "This month", icon: Lucide.CalendarDays },
  { id: "rules", label: "Rules", icon: Lucide.Settings2 },
  { id: "inbox", label: "Inbox", icon: Lucide.Inbox },
  { id: "plaid_streams", label: "Detected", icon: Lucide.Sparkles },
  { id: "insights", label: "Insights", icon: Lucide.LineChart },
];

export default function ObligationsTabs({
  activeTab,
  onChange,
  inboxCount,
  plaidStreamsCount,
}: {
  activeTab: ObligationsTabId;
  onChange: (tab: ObligationsTabId) => void;
  inboxCount: number;
  plaidStreamsCount?: number;
}) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl overflow-x-auto hide-scrollbar"
      style={{ backgroundColor: "var(--surface-2)" }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const badgeCount = tab.id === "inbox" ? inboxCount : tab.id === "plaid_streams" ? (plaidStreamsCount ?? 0) : 0;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              backgroundColor: isActive ? "var(--surface)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-secondary)",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {badgeCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isActive 
                    ? (tab.id === "plaid_streams" ? "var(--primary)" : "var(--warning)")
                    : (tab.id === "plaid_streams" ? "var(--primary-subtle)" : "var(--warning-subtle)"),
                  color: isActive 
                    ? "#fff" 
                    : (tab.id === "plaid_streams" ? "var(--primary)" : "var(--warning)"),
                }}
              >
                {badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
