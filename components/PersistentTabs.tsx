"use client";

import { ReactNode, createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type TabId = "overview" | "activity" | "insights" | "log";

interface TabsContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

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

  // Update URL without navigation when tab changes, but keep domain clean
  const setActiveTabWithHistory = useCallback((tab: TabId) => {
    setActiveTab(tab);
    // Keep URL at root domain without showing routes
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, []);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: setActiveTabWithHistory }}>
      {children}
    </TabsContext.Provider>
  );
}

interface TabPanelProps {
  tabId: TabId;
  children: ReactNode;
}

export function TabPanel({ tabId, children }: TabPanelProps) {
  const { activeTab } = useTabs();
  const isActive = activeTab === tabId;
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef<number>(0);

  // Preserve scroll position when tab becomes inactive
  useEffect(() => {
    if (!isActive && containerRef.current) {
      scrollPosRef.current = containerRef.current.scrollTop;
    }
  }, [isActive]);

  // Restore scroll position when tab becomes active
  useEffect(() => {
    if (isActive && containerRef.current && scrollPosRef.current > 0) {
      containerRef.current.scrollTop = scrollPosRef.current;
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        display: isActive ? "block" : "none",
        height: "100%",
        overflow: "auto",
      }}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
}

export function TabContainer({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: "100%", position: "relative" }}>
      {children}
    </div>
  );
}
