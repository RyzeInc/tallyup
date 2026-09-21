"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Navigation for the app's primary destinations.
 *
 * This replaces the previous PersistentTabs shell, which mounted every page
 * through `next/dynamic({ ssr: false })` inside a single route. That design
 * disabled server rendering app-wide, loaded each page module twice (once via
 * the route tree, once via the dynamic import), unmounted "persistent" tabs on
 * every switch, and made every `loading.tsx` in the app dead code.
 *
 * Each destination is now a real route. `useTabs()` keeps the old call
 * signature so existing call sites work unchanged, but `setActiveTab` performs
 * a genuine client-side navigation and `activeTab` is derived from the URL.
 */
export type TabId =
  | "dashboard"
  | "activity"
  | "budgeting"
  | "recurring"
  | "goals"
  | "insights"
  | "help"
  | "more"
  | "calendar"
  | "review"
  | "accounts"
  | "auto-sort"
  | "coach";

export const TAB_HREF: Record<TabId, string> = {
  dashboard: "/dashboard",
  activity: "/activity",
  budgeting: "/budgeting",
  recurring: "/recurring",
  goals: "/goals",
  insights: "/insights",
  help: "/help",
  more: "/more",
  calendar: "/calendar",
  review: "/review",
  accounts: "/accounts",
  "auto-sort": "/auto-sort",
  coach: "/coach",
};

/** Longest-prefix match so nested routes highlight their parent tab. */
export function tabFromPathname(pathname: string | null | undefined): TabId {
  if (!pathname || pathname === "/") return "dashboard";
  if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) return "more";
  if (pathname.startsWith("/learn")) return "help";
  if (pathname.startsWith("/transfers")) return "accounts";
  if (pathname.startsWith("/log")) return "activity";

  let best: TabId = "dashboard";
  let bestLength = 0;
  for (const [tab, href] of Object.entries(TAB_HREF) as [TabId, string][]) {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > bestLength) {
      best = tab;
      bestLength = href.length;
    }
  }
  return best;
}

export function useTabs() {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = useMemo(() => tabFromPathname(pathname), [pathname]);

  const setActiveTab = useCallback(
    (tab: TabId) => {
      const href = TAB_HREF[tab];
      if (href && href !== pathname) router.push(href);
    },
    [router, pathname]
  );

  return { activeTab, setActiveTab };
}
