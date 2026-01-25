"use client";

import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTabs } from "./PersistentTabs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";

/**
 * BottomNav - Fixed bottom tab bar (Rocket Money style)
 * 
 * Design rules:
 * - Fixed to bottom with safe area padding
 * - 5 primary tabs visible at all times
 * - Active tab has colored underline indicator
 * - Icons change from outline to filled when active
 * - Labels always visible below icons
 * - Minimum tap target 44px
 */

type TabId = "dashboard" | "activity" | "budgeting" | "recurring" | "goals" | "insights" | "help" | "more" | "calendar" | "review" | "accounts" | "auto-sort";

interface BottomTab {
  id: TabId;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export default function BottomNav() {
  const { activeTab, setActiveTab } = useTabs();

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as Doc<"entries">[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  // Primary bottom tabs (matching Rocket Money's 5-tab pattern)
  const bottomTabs: BottomTab[] = [
    { id: "dashboard", label: "Dashboard", icon: Lucide.LayoutDashboard },
    { id: "recurring", label: "Recurring", icon: Lucide.CalendarClock },
    { id: "budgeting", label: "Spending", icon: Lucide.PieChart },
    { id: "activity", label: "Activity", icon: Lucide.ArrowUpDown, badge: reviewCount > 0 ? reviewCount : undefined },
    { id: "more", label: "More", icon: Lucide.Menu },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div 
        className="flex items-center justify-around"
        style={{
          height: "var(--bottomnav-height, 64px)",
          maxWidth: "var(--content-max-width-wide)",
          margin: "0 auto",
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center relative"
              style={{
                flex: 1,
                minHeight: 44,
                minWidth: 44,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 4px",
                transition: "all var(--motion-fast, 100ms) ease-out",
              }}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
            >
              {/* Underline indicator above icon */}
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b"
                style={{
                  width: isActive ? 32 : 0,
                  height: 3,
                  backgroundColor: "var(--tab-indicator-color, var(--accent))",
                  transition: "width var(--motion-medium, 150ms) ease-out",
                }}
              />
              
              {/* Icon with badge */}
              <span className="relative">
                <Icon
                  className="h-6 w-6"
                  strokeWidth={isActive ? 2.5 : 1.75}
                  style={{
                    color: isActive ? "var(--tab-indicator-color, var(--accent))" : "var(--text-secondary)",
                    transition: "color var(--motion-fast, 100ms) ease-out",
                  } as React.CSSProperties}
                />
                {tab.badge && tab.badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--text-on-accent, #fff)",
                    }}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className="mt-1 text-xs"
                style={{
                  color: isActive ? "var(--tab-indicator-color, var(--accent))" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 500,
                  transition: "color var(--motion-fast, 100ms) ease-out",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
