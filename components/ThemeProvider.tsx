"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";

/**
 * TallyUp Theme System
 * 
 * Light-first design stance:
 * - Default = Light mode (no automatic dark mode on system preference)
 * - Additional themes: Dim (Beta), Estate (black+green), Clarity (white+blue)
 * - Cards always white, text always crisp for finance app trust
 */

type ThemeMode = "porcelain" | "light" | "dim" | "estate" | "clarity";

const THEME_CLASSES: ThemeMode[] = ["porcelain", "light", "dim", "estate", "clarity"];

/**
 * Navigation Customization
 * 
 * Users can show/hide certain pages from the main nav bar.
 * Hidden pages still accessible via More menu.
 */
export type CustomizableNavItem = "activity" | "budgeting" | "recurring" | "goals" | "insights" | "calendar" | "review" | "accounts" | "auto-sort" | "coach";

export const NAV_ITEM_CONFIG: { id: CustomizableNavItem; label: string; description: string }[] = [
  { id: "activity", label: "Activity", description: "Transaction history and log" },
  { id: "budgeting", label: "Budgeting", description: "Budget categories and spending" },
  { id: "recurring", label: "Recurring", description: "Recurring transactions" },
  { id: "goals", label: "Goals", description: "Savings goals tracking" },
  { id: "insights", label: "Insights", description: "Financial insights and trends" },
  { id: "calendar", label: "Calendar", description: "Calendar view of transactions" },
  { id: "review", label: "Review", description: "Weekly/monthly review" },
  { id: "accounts", label: "Accounts", description: "Connected accounts" },
  { id: "auto-sort", label: "Auto-Sort", description: "Auto-categorize transactions" },
  { id: "coach", label: "Coach", description: "AI financial coaching assistant" },
];

// Default visible items in nav bar
const DEFAULT_VISIBLE_NAV: CustomizableNavItem[] = ["activity", "budgeting", "recurring", "goals", "coach"];

const NAV_PREFS_KEY = "tallyup.navItems";

const THEME_KEY = "tallyup.theme";
const DEFAULT_THEME: ThemeMode = "porcelain";

/**
 * Injected into <head> and run before first paint. Reading localStorage during
 * render would either throw on the server or (worse) return a different value
 * than the client, producing a hydration mismatch and a theme flash. Applying
 * the class here keeps the server HTML and the client in agreement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});var a=${JSON.stringify(THEME_CLASSES)};if(!t||a.indexOf(t)===-1)t=${JSON.stringify(
  DEFAULT_THEME
)};var e=document.documentElement;a.forEach(function(c){e.classList.remove(c)});e.classList.add(t)}catch(_){}})();`;

/**
 * localStorage-backed store read through useSyncExternalStore.
 *
 * This is the piece that makes the provider SSR-safe: `getServerSnapshot`
 * returns the defaults so server HTML is deterministic, while `getSnapshot`
 * returns the persisted values on the client. React reconciles the difference
 * after hydration without a mismatch warning and without a setState-in-effect
 * cascade. Snapshots are memoised because useSyncExternalStore requires a
 * referentially stable result.
 */
const listeners = new Set<() => void>();

function emitStoreChange() {
  for (const listener of listeners) listener();
}

function subscribeToPrefs(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

let themeSnapshot: ThemeMode | undefined;
let themeSnapshotRaw: string | null = null;

function getThemeSnapshot(): ThemeMode {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(THEME_KEY);
  } catch {
    return DEFAULT_THEME;
  }
  if (raw !== themeSnapshotRaw || themeSnapshot === undefined) {
    themeSnapshotRaw = raw;
    themeSnapshot =
      raw && THEME_CLASSES.includes(raw as ThemeMode) ? (raw as ThemeMode) : DEFAULT_THEME;
  }
  return themeSnapshot;
}

function getThemeServerSnapshot(): ThemeMode {
  return DEFAULT_THEME;
}

let navSnapshot: CustomizableNavItem[] | undefined;
let navSnapshotRaw: string | null = null;

function getNavSnapshot(): CustomizableNavItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(NAV_PREFS_KEY);
  } catch {
    return DEFAULT_VISIBLE_NAV;
  }
  if (raw !== navSnapshotRaw || navSnapshot === undefined) {
    navSnapshotRaw = raw;
    if (!raw) {
      navSnapshot = DEFAULT_VISIBLE_NAV;
    } else {
      try {
        const parsed = JSON.parse(raw) as CustomizableNavItem[];
        const validated = parsed.filter((item) => NAV_ITEM_CONFIG.some((c) => c.id === item));
        // Migration: users with saved prefs predate the coach tab.
        if (!validated.includes("coach")) validated.push("coach");
        navSnapshot = validated;
      } catch {
        navSnapshot = DEFAULT_VISIBLE_NAV;
      }
    }
  }
  return navSnapshot;
}

function getNavServerSnapshot(): CustomizableNavItem[] {
  return DEFAULT_VISIBLE_NAV;
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  emitStoreChange();
}

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  visibleNavItems: CustomizableNavItem[];
  setVisibleNavItems: (items: CustomizableNavItem[]) => void;
  toggleNavItem: (item: CustomizableNavItem) => void;
  isNavItemVisible: (item: CustomizableNavItem) => boolean;
} | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToPrefs,
    getThemeSnapshot,
    getThemeServerSnapshot
  );
  const visibleNavItems = useSyncExternalStore(
    subscribeToPrefs,
    getNavSnapshot,
    getNavServerSnapshot
  );

  // Mirror the theme onto <html>. THEME_INIT_SCRIPT already applied the right
  // class before first paint, so this only matters for subsequent changes.
  useEffect(() => {
    THEME_CLASSES.forEach((cls) => document.documentElement.classList.remove(cls));
    document.documentElement.classList.add(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    writePref(THEME_KEY, newTheme);
  }, []);

  const setVisibleNavItems = useCallback((items: CustomizableNavItem[]) => {
    writePref(NAV_PREFS_KEY, JSON.stringify(items));
  }, []);

  const toggleNavItem = useCallback((item: CustomizableNavItem) => {
    const current = getNavSnapshot();
    const next = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    writePref(NAV_PREFS_KEY, JSON.stringify(next));
  }, []);

  const isNavItemVisible = useCallback((item: CustomizableNavItem) => {
    return visibleNavItems.includes(item);
  }, [visibleNavItems]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      visibleNavItems, 
      setVisibleNavItems, 
      toggleNavItem, 
      isNavItemVisible 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// Appearance options for Settings page
export const APPEARANCE_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: "porcelain", label: "Porcelain", description: "Porcelain + Ink — premium prismatic" },
  { value: "light", label: "Warm Sand", description: "Coastal daylight — sand, foam, sea" },
  { value: "dim", label: "Dim", description: "Reduced brightness for low-light" },
  { value: "estate", label: "Estate", description: "Black & green fintech style" },
  { value: "clarity", label: "Clarity", description: "White & blue fintech style" },
];
