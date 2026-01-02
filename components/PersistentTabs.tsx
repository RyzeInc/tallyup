"use client";

import { ReactNode, createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";

export type TabId = "dashboard" | "activity" | "budgeting" | "recurring" | "goals" | "insights" | "help" | "more";

interface TabsContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  previousTab: TabId | null;
}

const TabsContext = createContext<TabsContextValue | null>(null);

// Store scroll positions per tab (persists across re-renders)
const scrollPositions: Record<TabId, number> = {
  dashboard: 0,
  activity: 0,
  budgeting: 0,
  recurring: 0,
  goals: 0,
  insights: 0,
  help: 0,
  more: 0,
};

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within PersistentTabsProvider");
  return ctx;
}

export function PersistentTabsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Initialize tab based on current pathname, default to dashboard
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "dashboard";
    const path = window.location.pathname;
    if (path.startsWith("/dashboard") || path === "/") return "dashboard";
    if (path.startsWith("/activity")) return "activity";
    if (path.startsWith("/budgeting")) return "budgeting";
    if (path.startsWith("/recurring")) return "recurring";
    if (path.startsWith("/goals")) return "goals";
    if (path.startsWith("/insights")) return "insights";
    if (path.startsWith("/help") || path.startsWith("/learn")) return "help";
    if (path.startsWith("/more") || path.startsWith("/settings") || path.startsWith("/profile")) return "more";
    return "dashboard"; // default to dashboard
  });
  
  const [previousTab, setPreviousTab] = useState<TabId | null>(null);

  // Helper to update URL without navigation
  const updateUrl = useCallback((tab: TabId) => {
    if (typeof window !== "undefined") {
      const tabPath = `/${tab}`;
      if (window.location.pathname !== tabPath) {
        const newUrl = tabPath + window.location.search;
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, []);

  // User-triggered tab change (uses flushSync for immediate feedback)
  const setActiveTabWithHistory = useCallback((tab: TabId) => {
    // Save current scroll position before switching
    if (typeof window !== "undefined") {
      scrollPositions[activeTab] = window.scrollY;
    }
    
    setPreviousTab(activeTab);
    
    // Use flushSync for immediate synchronous rendering
    flushSync(() => {
      setActiveTab(tab);
    });
    
    updateUrl(tab);
  }, [activeTab, updateUrl]);

  // Sync tab state from pathname (effect-triggered, no flushSync)
  useEffect(() => {
    if (!pathname) return;
    const path = pathname;
    let nextTab: TabId = "dashboard";
    if (path.startsWith("/dashboard") || path === "/") nextTab = "dashboard";
    else if (path.startsWith("/activity")) nextTab = "activity";
    else if (path.startsWith("/budgeting")) nextTab = "budgeting";
    else if (path.startsWith("/recurring")) nextTab = "recurring";
    else if (path.startsWith("/goals")) nextTab = "goals";
    else if (path.startsWith("/insights")) nextTab = "insights";
    else if (path.startsWith("/help") || path.startsWith("/learn")) nextTab = "help";
    else if (path.startsWith("/more") || path.startsWith("/settings") || path.startsWith("/profile")) nextTab = "more";

    if (nextTab !== activeTab) {
      // Save scroll position
      if (typeof window !== "undefined") {
        scrollPositions[activeTab] = window.scrollY;
      }
      setPreviousTab(activeTab);
      setActiveTab(nextTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: setActiveTabWithHistory, previousTab }}>
      {children}
    </TabsContext.Provider>
  );
}

interface TabPanelProps {
  tabId: TabId;
  children: ReactNode;
}

export function TabPanel({ tabId, children }: TabPanelProps) {
  const { activeTab, previousTab } = useTabs();
  const isActive = activeTab === tabId;
  const wasJustActivated = isActive && previousTab !== null && previousTab !== tabId;
  const hasRestoredRef = useRef(false);

  // Restore scroll position when this tab becomes active
  useEffect(() => {
    if (wasJustActivated && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositions[tabId]);
      });
    }
    
    if (!isActive) {
      hasRestoredRef.current = false;
    }
  }, [isActive, wasJustActivated, tabId]);

  return (
    <div
      style={{
        display: isActive ? "block" : "none",
      }}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
}

export function TabContainer({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
    </div>
  );
}
