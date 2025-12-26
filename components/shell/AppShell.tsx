"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";
import { TabContainer, TabPanel } from "@/components/PersistentTabs";
import dynamic from "next/dynamic";

// Dynamically import tab content to avoid circular dependencies
const OverviewPage = dynamic(() => import("@/app/(app)/overview/page"), { ssr: false });
const ActivityPage = dynamic(() => import("@/app/(app)/activity/page"), { ssr: false });
const InsightsPage = dynamic(() => import("@/app/(app)/insights/page"), { ssr: false });
const LogPage = dynamic(() => import("@/app/(app)/log/page"), { ssr: false });

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if we're on a main tab route (overview, activity, insights, log) or root
  const isMainTab = pathname === "/" || 
                    pathname === "/overview" || pathname === "/activity" || pathname === "/insights" || pathname === "/log" ||
                    pathname?.startsWith("/overview/") || pathname?.startsWith("/activity/") || 
                    pathname?.startsWith("/insights/") || pathname?.startsWith("/log/");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div
        className="mx-auto max-w-md px-4 pt-6 pb-28"
        style={{ minHeight: "calc(100vh - 84px)", position: "relative" }}
      >
        {/* Minimal header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            TallyUp
          </h1>
          <ThemeToggle />
        </header>

        <main>
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
