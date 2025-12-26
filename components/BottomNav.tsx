"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import MoreSheet from "./MoreSheet";
import { useTabs } from "./PersistentTabs";

interface NavTab {
  href: string;
  label: string;
  iconName: "Home" | "Activity" | "TrendingUp" | "MoreHorizontal";
  badge?: number;
  tabId?: "overview" | "activity" | "insights";
}

export default function BottomNav({ currentPath }: { currentPath?: string }) {
  const pathname = currentPath ?? usePathname();
  const router = useRouter();
  const { activeTab, setActiveTab } = useTabs();
  const [moreOpen, setMoreOpen] = useState(false);

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  const tabs: NavTab[] = [
    { href: "/overview", label: "Home", iconName: "Home", tabId: "overview" },
    { href: "/activity", label: "Activity", iconName: "Activity", badge: reviewCount > 0 ? reviewCount : undefined, tabId: "activity" },
    { href: "/insights", label: "Insights", iconName: "TrendingUp", tabId: "insights" },
    { href: "#more", label: "More", iconName: "MoreHorizontal" },
  ];

  const iconMap = {
    Home: Lucide.Home,
    Activity: Lucide.Activity,
    TrendingUp: Lucide.TrendingUp,
    MoreHorizontal: Lucide.MoreHorizontal,
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom"
        style={{
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-lg">
          <div className="relative flex items-end justify-around px-2">
            {/* Left tabs */}
            {tabs.slice(0, 2).map((t) => {
              const active = t.tabId ? activeTab === t.tabId : pathname === t.href || pathname?.startsWith(t.href + "/");
              const Icon = iconMap[t.iconName];
              
              if (t.tabId) {
                return (
                  <button
                    key={t.href}
                    onClick={() => setActiveTab(t.tabId!)}
                    className="flex flex-col items-center justify-center py-2 px-3 min-h-[56px] transition-colors"
                    style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                      {t.badge !== undefined && t.badge > 0 && (
                        <span
                          className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                          style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                        >
                          {t.badge > 99 ? "99+" : t.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="flex flex-col items-center justify-center py-2 px-3 min-h-[56px] transition-colors"
                  style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    {t.badge !== undefined && t.badge > 0 && (
                      <span
                        className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                        style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                      >
                        {t.badge > 99 ? "99+" : t.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                </Link>
              );
            })}

            {/* Center FAB - elevated above nav */}
            <div className="relative flex items-center justify-center px-4">
              <button
                onClick={() => setActiveTab("log")}
                className="absolute -top-5 flex items-center gap-1.5 rounded-full px-5 py-3 font-semibold text-sm transition-transform hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-foreground)",
                  boxShadow: "var(--shadow-fab)",
                }}
                aria-label="Log new entry"
              >
                <Lucide.Plus className="h-5 w-5" strokeWidth={2.5} />
                <span>Log</span>
              </button>
              {/* Spacer to maintain nav height */}
              <div className="h-[56px] w-[80px]" />
            </div>

            {/* Right tabs */}
            {tabs.slice(2).map((t) => {
              if (t.href === "#more") {
                return (
                  <button
                    key="more"
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center justify-center py-2 px-3 min-h-[56px] transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="More options"
                  >
                    <Lucide.MoreHorizontal className="h-5 w-5" strokeWidth={2} />
                    <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                  </button>
                );
              }

              const active = t.tabId ? activeTab === t.tabId : pathname === t.href || pathname?.startsWith(t.href + "/");
              const Icon = iconMap[t.iconName];
              
              if (t.tabId) {
                return (
                  <button
                    key={t.href}
                    onClick={() => setActiveTab(t.tabId!)}
                    className="flex flex-col items-center justify-center py-2 px-3 min-h-[56px] transition-colors"
                    style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="flex flex-col items-center justify-center py-2 px-3 min-h-[56px] transition-colors"
                  style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  <span className="mt-0.5 text-[10px] font-medium">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pendingReviewCount={reviewCount} />
    </>
  );
}
