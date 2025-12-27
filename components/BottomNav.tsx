"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
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
 * - Compose opens a bottom sheet with "Spent" / "Received" options
 * - Tap targets ≥ 44px
 */

interface NavTab {
  id: string;
  label: string;
  iconName: "Home" | "Activity" | "Plus" | "TrendingUp" | "MoreHorizontal";
  tabId?: "overview" | "activity" | "insights" | "log";
  isCenter?: boolean;
}

// Compose Sheet - Opens when Log is tapped
function ComposeSheet({ 
  open, 
  onClose, 
  onSelectType 
}: { 
  open: boolean; 
  onClose: () => void;
  onSelectType: (type: "expense" | "income") => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Log transaction"
        className="relative w-full max-w-md animate-slide-in-from-bottom"
      >
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderTopLeftRadius: "var(--card-radius)",
            borderTopRightRadius: "var(--card-radius)",
            borderTop: "1px solid var(--border)",
            borderLeft: "1px solid var(--border)",
            borderRight: "1px solid var(--border)",
            padding: "var(--space-4)",
            paddingBottom: "calc(var(--space-6) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Handle */}
          <div className="flex justify-center mb-4">
            <div
              className="h-1 w-10 rounded-full"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 
              style={{ 
                color: "var(--text)",
                fontSize: "var(--text-h2)",
                fontWeight: "var(--text-h2-weight)",
              }}
            >
              Log transaction
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 transition-colors"
              style={{ minHeight: 44, minWidth: 44 }}
              aria-label="Close"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          {/* Quick Log Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                onSelectType("expense");
                onClose();
              }}
              className="flex items-center justify-center gap-3 transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--input-radius)",
                padding: "var(--space-4)",
                minHeight: "var(--button-height)",
                color: "var(--text)",
                fontWeight: 600,
              }}
            >
              <Lucide.ArrowUpRight className="h-5 w-5" style={{ color: "var(--danger)" }} />
              Spent
            </button>
            <button
              onClick={() => {
                onSelectType("income");
                onClose();
              }}
              className="flex items-center justify-center gap-3 transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--input-radius)",
                padding: "var(--space-4)",
                minHeight: "var(--button-height)",
                color: "var(--text)",
                fontWeight: 600,
              }}
            >
              <Lucide.ArrowDownLeft className="h-5 w-5" style={{ color: "var(--success)" }} />
              Received
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BottomNav({ currentPath }: { currentPath?: string }) {
  const pathname = currentPath ?? usePathname();
  const { activeTab, setActiveTab } = useTabs();
  const [moreOpen, setMoreOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

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

  function handleLogSelect(type: "expense" | "income") {
    // Navigate to log tab and store the selected type
    if (typeof window !== "undefined") {
      sessionStorage.setItem("tallyup.logType", type);
    }
    setActiveTab("log");
  }

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

              // Center Log tab - slightly emphasized
              if (t.isCenter) {
                return (
                  <button
                    key={t.id}
                    onClick={() => setComposeOpen(true)}
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
      <ComposeSheet 
        open={composeOpen} 
        onClose={() => setComposeOpen(false)} 
        onSelectType={handleLogSelect}
      />
    </>
  );
}
