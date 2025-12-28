"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import { TabContainer, TabPanel } from "@/components/PersistentTabs";
import dynamic from "next/dynamic";

// Dynamically import tab content to avoid circular dependencies
const OverviewPage = dynamic(() => import("@/app/(app)/overview/page"), { ssr: false });
const ActivityPage = dynamic(() => import("@/app/(app)/activity/page"), { ssr: false });
const InsightsPage = dynamic(() => import("@/app/(app)/insights/page"), { ssr: false });
const LogPage = dynamic(() => import("@/app/(app)/log/page"), { ssr: false });
const MorePage = dynamic(() => import("@/app/(app)/more/page"), { ssr: false });

/**
 * AppShell - Unified shell with:
 * - Consistent background gradient
 * - Safe-area padding
 * - TopBar behavior
 * - Bottom navigation
 * 
 * Design principles:
 * - 16px page horizontal padding
 * - No thick teal band at top
 * - Background gradient never clashes with readable content
 */

interface TopBarProps {
  left?: ReactNode;
  right?: ReactNode;
}

function TopBar({ left, right }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between safe-area-inset-top"
      style={{
        minHeight: "var(--topbar-height)",
        padding: "0 var(--page-padding)",
        backgroundColor: "transparent",
      }}
    >
      <div className="flex items-center gap-2">
        {left || (
          <span 
            className="text-lg font-semibold" 
            style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
          >
            TallyUp
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {right}
      </div>
    </header>
  );
}

export { TopBar };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if we're on a main tab route (overview, activity, insights, log, more) or root
  const isMainTab = pathname === "/" || 
                    pathname === "/overview" || pathname === "/activity" || pathname === "/insights" || pathname === "/log" || pathname === "/more" ||
                    pathname?.startsWith("/overview/") || pathname?.startsWith("/activity/") || 
                    pathname?.startsWith("/insights/") || pathname?.startsWith("/log/") || pathname?.startsWith("/more/");

  return (
    <div 
      className="min-h-screen safe-area-inset-top" 
      style={{ 
        background: "var(--bg-full)",
        color: "var(--text)",
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--content-max-width)",
          paddingLeft: "var(--page-padding)",
          paddingRight: "var(--page-padding)",
          paddingBottom: "calc(var(--bottomnav-height) + env(safe-area-inset-bottom, 0px) + 24px)",
          minHeight: "100vh",
        }}
      >
        <main className="pt-4">
          {isMainTab ? (
            <TabContainer>
              <TabPanel tabId="overview">
                <OverviewPage />
              </TabPanel>
              <TabPanel tabId="activity">
                <ActivityPage />
              </TabPanel>
              <TabPanel tabId="insights">
                <InsightsPage />
              </TabPanel>
              <TabPanel tabId="log">
                <LogPage />
              </TabPanel>
              <TabPanel tabId="more">
                <MorePage />
              </TabPanel>
            </TabContainer>
          ) : (
            children
          )}
        </main>
      </div>
      <BottomNav currentPath={pathname ?? "/"} />
    </div>
  );
}
