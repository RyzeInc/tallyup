"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import TopNav from "@/components/TopNav";
import { TabContainer, TabPanel } from "@/components/PersistentTabs";
import dynamic from "next/dynamic";
import { TimeRangeProvider } from "@/components/TimeRangeProvider";

// Dynamically import tab content to avoid circular dependencies
const DashboardPage = dynamic(() => import("@/app/(app)/dashboard/page"), { ssr: false });
const ActivityPage = dynamic(() => import("@/app/(app)/activity/page"), { ssr: false });
const BudgetingPage = dynamic(() => import("@/app/(app)/budgeting/page"), { ssr: false });
const RecurringPage = dynamic(() => import("@/app/(app)/recurring/page"), { ssr: false });
const GoalsPage = dynamic(() => import("@/app/(app)/goals/page"), { ssr: false });
const InsightsPage = dynamic(() => import("@/app/(app)/insights/page"), { ssr: false });
const HelpPage = dynamic(() => import("@/app/(app)/help/page"), { ssr: false });
const MorePage = dynamic(() => import("@/app/(app)/more/page"), { ssr: false });
const ReviewPage = dynamic(() => import("@/app/(app)/review/page"), { ssr: false });
const AccountsPage = dynamic(() => import("@/app/(app)/accounts/page"), { ssr: false });
const CalendarPage = dynamic(() => import("@/app/(app)/calendar/page"), { ssr: false });

/**
 * AppShell - Unified shell with:
 * - Consistent background gradient
 * - Safe-area padding
 * - Top navigation (scrollable tabs)
 * 
 * Design principles:
 * - 16px page horizontal padding
 * - Top navigation for discoverability
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
  
  // Check if we're on a main tab route (root "/" defaults to dashboard tab)
  const isMainTab = pathname === "/" ||
                    pathname === "/dashboard" || pathname === "/activity" || 
                    pathname === "/budgeting" || pathname === "/recurring" || 
                    pathname === "/goals" || pathname === "/insights" || 
                    pathname === "/help" || pathname === "/more" ||
                    pathname === "/review" || pathname === "/accounts" || 
                    pathname === "/calendar" ||
                    pathname?.startsWith("/dashboard/") || pathname?.startsWith("/activity/") || 
                    pathname?.startsWith("/budgeting/") || pathname?.startsWith("/recurring/") || 
                    pathname?.startsWith("/goals/") || pathname?.startsWith("/insights/") ||
                    pathname?.startsWith("/help/") || pathname?.startsWith("/more/") ||
                    pathname?.startsWith("/review/") ||
                    pathname?.startsWith("/calendar/");

  return (
    <div 
      className="min-h-screen" 
      style={{ 
        background: "var(--bg-full)",
        color: "var(--text)",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TopNav />
      <div
        className="mx-auto flex-1 w-full"
        style={{
          maxWidth: "var(--content-max-width-wide)",
          paddingLeft: "var(--page-padding)",
          paddingRight: "var(--page-padding)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <main className="pt-4 flex-1 overflow-auto flex flex-col">
          {isMainTab ? (
            <TabContainer>
              <TabPanel tabId="dashboard">
                <DashboardPage />
              </TabPanel>
              <TimeRangeProvider>
                <TabPanel tabId="activity">
                  <ActivityPage />
                </TabPanel>
                <TabPanel tabId="budgeting">
                  <BudgetingPage />
                </TabPanel>
                <TabPanel tabId="recurring">
                  <RecurringPage />
                </TabPanel>
                <TabPanel tabId="goals">
                  <GoalsPage />
                </TabPanel>
                <TabPanel tabId="insights">
                  <InsightsPage />
                </TabPanel>
                <TabPanel tabId="calendar">
                  <CalendarPage />
                </TabPanel>
                <TabPanel tabId="review">
                  <ReviewPage />
                </TabPanel>
                <TabPanel tabId="accounts">
                  <AccountsPage />
                </TabPanel>
                <TabPanel tabId="help">
                  <HelpPage />
                </TabPanel>
                <TabPanel tabId="more">
                  <MorePage />
                </TabPanel>
              </TimeRangeProvider>
            </TabContainer>
          ) : (
            <TimeRangeProvider>{children}</TimeRangeProvider>
          )}
        </main>
      </div>
    </div>
  );
}
