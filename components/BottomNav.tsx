"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import MoreSheet from "./MoreSheet";
import { useTabs } from "./PersistentTabs";

/**
 * BottomNav - Premium 5-tab bottom navigation
 * 
 * Design rules:
 * - Standard 5-tab bar layout
 * - Middle Log tab has subtle emphasis (larger icon, small background highlight)
 * - No floating pill that blocks content
 * - Center button navigates directly to /log
 * - Tap targets ≥ 44px
 */

interface NavTab {
  id: string;
  label: string;
  iconName: "Home" | "Activity" | "Plus" | "TrendingUp" | "MoreHorizontal";
  tabId?: "overview" | "activity" | "insights" | "log";
  isCenter?: boolean;
}

export default function BottomNav({ currentPath }: { currentPath?: string }) {
  const pathname = currentPath ?? usePathname();
  const { activeTab, setActiveTab } = useTabs();
  const [moreOpen, setMoreOpen] = useState(false);

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  const tabs: NavTab[] = [
    { id: "home", label: "Home", iconName: "Home", tabId: "overview" },
    { id: "activity", label: "Activity", iconName: "Activity", tabId: "activity" },
    { id: "log", label: "Log", iconName: "Plus", tabId: "log", isCenter: true },
    { id: "insights", label: "Insights", iconName: "TrendingUp", tabId: "insights" },
    { id: "more", label: "More", iconName: "MoreHorizontal" },
  ];

  const iconMap = {
    Home: Lucide.Home,
    Activity: Lucide.Activity,
    Plus: Lucide.Plus,
    TrendingUp: Lucide.TrendingUp,
    MoreHorizontal: Lucide.MoreHorizontal,
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom"
        style={{
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -1px 3px rgba(0, 0, 0, 0.03)",
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "var(--content-max-width)" }}>
          <div className="flex items-center justify-around">
            {tabs.map((t) => {
              const isActive = t.tabId ? activeTab === t.tabId : false;
              const Icon = iconMap[t.iconName];
              const showBadge = t.id === "activity" && reviewCount > 0;

              // Center Log tab - navigates directly to /log
              if (t.isCenter) {
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab("log")}
                    className="flex flex-col items-center justify-center py-2 px-3 transition-colors"
                    style={{ 
                      minHeight: 64,
                      minWidth: 64,
                      color: isActive ? "var(--primary)" : "var(--text-tertiary)",
                    }}
                    aria-label="Log new transaction"
                  >
                    <span
                      className="flex items-center justify-center rounded-full transition-colors"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: isActive ? "var(--accent-subtle)" : "var(--surface-2)",
                      }}
                    >
                      <Icon 
                        className="h-6 w-6" 
                        strokeWidth={2} 
                        style={{ color: "var(--primary)" }}
                      />
                    </span>
                    <span 
                      className="mt-0.5 text-[10px] font-medium"
                      style={{ color: "var(--primary)" }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              }

              // More button
              if (t.id === "more") {
                return (
                  <button
                    key={t.id}
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center justify-center py-2 px-3 transition-colors"
                    style={{ 
                      minHeight: 64,
                      color: "var(--text-tertiary)",
                    }}
                    aria-label="More options"
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                    <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                  </button>
                );
              }

              // Regular tabs
              return (
                <button
                  key={t.id}
                  onClick={() => t.tabId && setActiveTab(t.tabId)}
                  className="flex flex-col items-center justify-center py-2 px-3 transition-colors"
                  style={{ 
                    minHeight: 64,
                    color: isActive ? "var(--primary)" : "var(--text-tertiary)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                    {showBadge && (
                      <span
                        className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                        style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                      >
                        {reviewCount > 99 ? "99+" : reviewCount}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pendingReviewCount={reviewCount} />
    </>
  );
}
