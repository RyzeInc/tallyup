"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LogPage from "@/app/(app)/log/page";
import InboxPage from "@/app/(app)/inbox/page";
import HistoryPage from "@/app/(app)/history/page";
import SummaryPage from "@/app/(app)/summary/page";
import ProfilePage from "@/app/(app)/profile/page";

export type TabKey = "log" | "inbox" | "history" | "summary" | "profile";
const hrefToKey: Record<string, TabKey> = {
  "/log": "log",
  "/inbox": "inbox",
  "/history": "history",
  "/summary": "summary",
  "/profile": "profile",
};
const keyToHref: Record<TabKey, string> = {
  log: "/log",
  inbox: "/inbox",
  history: "/history",
  summary: "/summary",
  profile: "/profile",
};

const TabsContext = createContext<{
  current: TabKey;
  navigate: (k: TabKey) => void;
} | null>(null);

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within TabsProvider");
  return ctx;
}

export default function TabShell() {
  const pathname = usePathname();
  const router = useRouter();
  const initial = (hrefToKey[pathname ?? "/log"] as TabKey) ?? "log";
  const [current, setCurrent] = useState<TabKey>(initial);
  const animatingRef = useRef(false);

  // scroll positions per tab
  const scrollMap = useRef<Record<TabKey, number>>({ log: 0, inbox: 0, history: 0, summary: 0, profile: 0 });
  const logRef = useRef<HTMLDivElement | null>(null);
  const inboxRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const containerRefs = useMemo<Record<TabKey, React.RefObject<HTMLDivElement | null>>>(() => ({
    log: logRef,
    inbox: inboxRef,
    history: historyRef,
    summary: summaryRef,
    profile: profileRef,
  }), []);

  // prefetch other routes off the main thread to make tab taps feel instant
  // NOTE: avoid aggressive fetch() of full routes (can trigger SSR of pages like /history)
  useEffect(() => {
    try {
      const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
      idle(() => {
        router.prefetch("/log");
        router.prefetch("/inbox");
        router.prefetch("/history");
        router.prefetch("/summary");
        router.prefetch("/profile");
      });
    } catch {}
  }, [router]);

  useEffect(() => {
    // if pathname changes (deep link), sync current tab
    if (!pathname) return;
    const k = (hrefToKey[pathname] as TabKey) ?? "log";
    if (k !== current) setCurrent(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    // restore scroll for visible container
    const r = containerRefs[current].current;
    if (r) r.scrollTop = scrollMap.current[current] ?? 0;
  }, [current, containerRefs]);

  function navigate(k: TabKey) {
    if (k === current) return;
    // save current scroll top
    const curEl = containerRefs[current].current;
    if (curEl) scrollMap.current[current] = curEl.scrollTop;

    setCurrent(k);

    // push URL without triggering full route change
    try {
      window.history.pushState({}, "", keyToHref[k]);
    } catch {
      // ignore
    }

    // animation guard matching CSS duration (shorter for snappier feel)
    animatingRef.current = true;
    setTimeout(() => (animatingRef.current = false), 160);
  }

  return (
    <TabsContext.Provider value={{ current, navigate }}>
      <div className="tab-shell">
        <TabPanel key="log" id="log" active={current === "log"} ref={containerRefs.log} role="region">
          <LogPage />
        </TabPanel>
        <TabPanel key="inbox" id="inbox" active={current === "inbox"} ref={containerRefs.inbox} role="region">
          <InboxPage />
        </TabPanel>
        <TabPanel key="history" id="history" active={current === "history"} ref={containerRefs.history} role="region">
          <HistoryPage />
        </TabPanel>
        <TabPanel key="summary" id="summary" active={current === "summary"} ref={containerRefs.summary} role="region">
          <SummaryPage />
        </TabPanel>
        <TabPanel key="profile" id="profile" active={current === "profile"} ref={containerRefs.profile} role="region">
          <ProfilePage />
        </TabPanel>      </div>
      <style jsx>{`
        .tab-shell { position: relative; min-height: 60vh; }
      `}</style>
    </TabsContext.Provider>
  );
}

const TabPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { id: string; active: boolean }>(
  ({ id, active, children, ...rest }, ref) => {
    // preserve DOM mount, hide via transform/opacity
    return (
      <div
        ref={ref}
        id={id}
        {...rest}
        className={`tab-panel ${active ? "active" : "inactive"}`}
        style={{
          position: active ? "relative" : "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          transition: "transform 120ms cubic-bezier(.2,.9,.2,1), opacity 120ms",
          transform: active ? "translateX(0)" : "translateX(3%)",
          opacity: active ? 1 : 0,
          pointerEvents: active ? "auto" : "none",
          willChange: "transform, opacity",
        }}
      >
        {children}
      </div>
    );
  }
);
TabPanel.displayName = "TabPanel";
