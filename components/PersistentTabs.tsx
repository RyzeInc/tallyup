"use client";

import { ReactNode, createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type TabId = "overview" | "activity" | "insights" | "log";

interface TabsContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  previousTab: TabId | null;
}

const TabsContext = createContext<TabsContextValue | null>(null);

// Store scroll positions per tab (persists across re-renders)
const scrollPositions: Record<TabId, number> = {
  overview: 0,
  activity: 0,
  insights: 0,
  log: 0,
};

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within PersistentTabsProvider");
  return ctx;
}

export function PersistentTabsProvider({ children }: { children: ReactNode }) {
  // Initialize tab based on current pathname, default to log
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "log";
    const path = window.location.pathname;
    if (path.startsWith("/overview")) return "overview";
    if (path.startsWith("/activity")) return "activity";
    if (path.startsWith("/insights")) return "insights";
    if (path.startsWith("/log")) return "log";
    return "log"; // default to log
  });
  
  const [previousTab, setPreviousTab] = useState<TabId | null>(null);

  // Update URL without navigation when tab changes, but keep domain clean
  const setActiveTabWithHistory = useCallback((tab: TabId) => {
    // Save current scroll position before switching
    if (typeof window !== "undefined") {
      scrollPositions[activeTab] = window.scrollY;
    }
    
    setPreviousTab(activeTab);
    setActiveTab(tab);
    
    // Keep URL at root domain without showing routes
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, [activeTab]);

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
