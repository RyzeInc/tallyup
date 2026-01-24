"use client";

import { useRef, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { useTabs } from "./PersistentTabs";
import { useQuickLog } from "./log/QuickLogProvider";
import { useTheme, type CustomizableNavItem } from "./ThemeProvider";

/**
 * TopNav - Horizontally scrollable top navigation
 * 
 * Design rules:
 * - Tabs scroll horizontally for discoverability
 * - Active tab has clear visual indicator
 * - No hamburger menus for primary navigation
 * - All critical paths visible
 * - Tap targets ≥ 44px
 * - Respects user's navigation customization preferences
 */

interface NavTab {
  id: string;
  label: string;
  iconName: keyof typeof iconMap;
  tabId: TabId;
  badge?: number;
  customizableId?: CustomizableNavItem; // If set, this tab can be hidden by user
}

type TabId = "dashboard" | "activity" | "budgeting" | "recurring" | "goals" | "insights" | "help" | "more" | "calendar" | "review" | "accounts" | "auto-sort";

const iconMap = {
  LayoutDashboard: Lucide.LayoutDashboard,
  Activity: Lucide.Activity,
  Wallet: Lucide.Wallet,
  RefreshCw: Lucide.RefreshCw,
  Target: Lucide.Target,
  TrendingUp: Lucide.TrendingUp,
  Menu: Lucide.Menu,
  Plus: Lucide.Plus,
  Calendar: Lucide.Calendar,
  ClipboardCheck: Lucide.ClipboardCheck,
  Building2: Lucide.Building2,
  Wand2: Lucide.Wand2,
};

export default function TopNav() {
  const { activeTab, setActiveTab } = useTabs();
  const { open: openQuickLog } = useQuickLog();
  const { visibleNavItems } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as Doc<"entries">[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  // All possible tabs (order matters)
  const allTabs: NavTab[] = [
    { id: "dashboard", label: "Dashboard", iconName: "LayoutDashboard", tabId: "dashboard" },
    { id: "activity", label: "Activity", iconName: "Activity", tabId: "activity", badge: reviewCount > 0 ? reviewCount : undefined, customizableId: "activity" },
    { id: "budgeting", label: "Budgeting", iconName: "Wallet", tabId: "budgeting", customizableId: "budgeting" },
    { id: "recurring", label: "Recurring", iconName: "RefreshCw", tabId: "recurring", customizableId: "recurring" },
    { id: "goals", label: "Goals", iconName: "Target", tabId: "goals", customizableId: "goals" },
    { id: "insights", label: "Insights", iconName: "TrendingUp", tabId: "insights", customizableId: "insights" },
    { id: "calendar", label: "Calendar", iconName: "Calendar", tabId: "calendar", customizableId: "calendar" },
    { id: "review", label: "Review", iconName: "ClipboardCheck", tabId: "review", customizableId: "review" },
    { id: "accounts", label: "Accounts", iconName: "Building2", tabId: "accounts", customizableId: "accounts" },
    { id: "auto-sort", label: "Auto-Sort", iconName: "Wand2", tabId: "auto-sort", customizableId: "auto-sort" },
    { id: "more", label: "Menu", iconName: "Menu", tabId: "more" },
  ];

  // Filter tabs based on user preferences
  const tabs = allTabs.filter((tab) => {
    // Dashboard and Menu are always visible
    if (!tab.customizableId) return true;
    // Check if user wants this tab visible
    return visibleNavItems.includes(tab.customizableId);
  });

  // Handle scroll fade indicators
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setShowLeftFade(el.scrollLeft > 10);
      setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll active tab into view on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const activeEl = el.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement;
    if (activeEl) {
      const containerRect = el.getBoundingClientRect();
      const tabRect = activeEl.getBoundingClientRect();
      const scrollLeft = tabRect.left - containerRect.left - (containerRect.width - tabRect.width) / 2 + el.scrollLeft;
      el.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeTab]);

  return (
    <nav
      className="sticky top-0 z-50 safe-area-inset-top"
      style={{
        backgroundColor: "var(--foam-white, var(--surface))",
        borderBottom: "1px solid var(--border-foam, var(--border))",
        /* Subtle foam blur for coastal feel */
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* App Title Bar */}
      <div
        className="flex items-center justify-between px-4"
        style={{ height: "var(--topbar-height)" }}
      >
        <button
          onClick={() => setActiveTab("more")}
          className="text-lg font-semibold hover:opacity-80 transition-opacity"
          style={{ color: "var(--text)", letterSpacing: "-0.01em", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          aria-label="Open menu"
        >
          TallyUp
        </button>
        
        {/* Quick Log Button - Burnt Orange (the hero color!) */}
        <button
          onClick={openQuickLog}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 40,
            height: 40,
            background: "var(--btn-primary-gradient, var(--primary))",
            color: "var(--primary-foreground)",
            boxShadow: "0 2px 10px -2px rgba(196, 114, 74, 0.40)",
            transition: "all var(--motion-medium, 150ms) var(--ease-wave, ease-out)",
          }}
          aria-label="Log transaction"
        >
          <Lucide.Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Scrollable Tab Bar */}
      <div className="relative">
        {/* Left fade indicator */}
        {showLeftFade && (
          <div
            className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: "linear-gradient(to right, var(--foam-white, var(--surface)), transparent)",
            }}
          />
        )}
        
        {/* Right fade indicator */}
        {showRightFade && (
          <div
            className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: "linear-gradient(to left, var(--foam-white, var(--surface)), transparent)",
            }}
          />
        )}

        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <div className="flex px-2 pb-2 pt-1 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.tabId;
              const Icon = iconMap[tab.iconName];

              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.tabId}
                  onClick={() => setActiveTab(tab.tabId)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap"
                  style={{
                    scrollSnapAlign: "center",
                    minHeight: 44,
                    /* Sea-glass tint fill for selected, transparent for unselected */
                    backgroundColor: isActive ? "var(--tab-selected-bg, var(--accent-subtle))" : "transparent",
                    color: isActive ? "var(--tab-selected-text, var(--primary))" : "var(--tab-unselected-text, var(--text-secondary))",
                    fontWeight: isActive ? 600 : 500,
                    transition: "all var(--motion-medium, 150ms) var(--ease-wave, ease-out)",
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
                    {tab.badge && (
                      <span
                        className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        style={{ backgroundColor: "var(--sun-coral, var(--danger))", color: "#fff" }}
                      >
                        {tab.badge > 99 ? "99+" : tab.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
