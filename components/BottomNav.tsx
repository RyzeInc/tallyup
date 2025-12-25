"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Home, Activity, TrendingUp, MoreHorizontal, Plus } from "lucide-react";
import MoreSheet from "./MoreSheet";
import { useQuickLog } from "@/components/log/QuickLogProvider";

interface NavTab {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function BottomNav({ currentPath }: { currentPath?: string }) {
  const pathname = currentPath ?? usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { open: openQuickLog } = useQuickLog();

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  const tabs: NavTab[] = [
    { href: "/overview", label: "Home", icon: <Home className="h-5 w-5" /> },
    {
      href: "/activity",
      label: "Activity",
      icon: <Activity className="h-5 w-5" />,
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    // Placeholder for center FAB
    { href: "#fab", label: "", icon: null },
    { href: "/insights", label: "Insights", icon: <TrendingUp className="h-5 w-5" /> },
    { href: "#more", label: "More", icon: <MoreHorizontal className="h-5 w-5" /> },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 border-t safe-area-inset-bottom"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="mx-auto max-w-md px-4">
          <div className="grid grid-cols-5 gap-1">
            {tabs.map((t, idx) => {
              // Center FAB slot
              if (t.href === "#fab") {
                return (
                  <div key="fab" className="flex items-center justify-center relative">
                    <button
                      onClick={openQuickLog}
                      className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--accent-foreground)",
                        boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.35)",
                      }}
                      aria-label="Log new entry"
                    >
                      <Plus className="h-7 w-7" strokeWidth={2.5} />
                    </button>
                  </div>
                );
              }

              // More button (opens sheet)
              if (t.href === "#more") {
                return (
                  <button
                    key="more"
                    onClick={() => setMoreOpen(true)}
                    className="flex flex-col items-center justify-center gap-0.5 py-3 min-h-[56px]"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="More options"
                  >
                    <span className="relative">
                      {t.icon}
                    </span>
                    <span className="text-[10px] font-medium">{t.label}</span>
                  </button>
                );
              }

              // Regular nav tabs
              const active = pathname === t.href || pathname?.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="flex flex-col items-center justify-center gap-0.5 py-3 min-h-[56px] transition-colors"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-tertiary)",
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="relative">
                    {t.icon}
                    {t.badge !== undefined && t.badge > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                        style={{
                          backgroundColor: "var(--danger)",
                          color: "#fff",
                        }}
                      >
                        {t.badge > 99 ? "99+" : t.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium">{t.label}</span>
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
