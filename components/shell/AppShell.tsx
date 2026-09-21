"use client";

import { ReactNode } from "react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { TimeRangeProvider } from "@/components/TimeRangeProvider";

/**
 * AppShell - chrome only.
 *
 * Page content arrives as `children` from the real Next.js route, so pages
 * server-render, stream, and use their own `loading.tsx`. The shell no longer
 * mounts every page itself.
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
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

export { TopBar };

export default function AppShell({ children }: { children: React.ReactNode }) {
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
        position: "relative",
      }}
    >
      {/* Theme-aware atmosphere overlay - starts below header band */}
      <div
        className="atmosphere-overlay pointer-events-none"
        style={{
          position: "absolute",
          top: "var(--topbar-height, 120px)",
          left: 0,
          right: 0,
          height: "var(--atmosphere-height, 160px)",
          background: "var(--atmosphere-overlay, transparent)",
          opacity: 0.5,
          zIndex: 0,
        }}
        aria-hidden="true"
      />
      <TopNav />
      <div
        className="mx-auto flex-1 w-full"
        style={{
          maxWidth: "var(--content-max-width-wide)",
          paddingLeft: "var(--page-padding)",
          paddingRight: "var(--page-padding)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        <main
          className="pt-4 flex-1 overflow-auto flex flex-col"
          style={{
            // Room for the fixed bottom nav on mobile, plus the home indicator.
            paddingBottom:
              "calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-clearance, 24px))",
          }}
        >
          <TimeRangeProvider>{children}</TimeRangeProvider>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
