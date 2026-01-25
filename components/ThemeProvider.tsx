"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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
export type CustomizableNavItem = "activity" | "budgeting" | "recurring" | "goals" | "insights" | "calendar" | "review" | "accounts" | "auto-sort";

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
];

// Default visible items in nav bar
const DEFAULT_VISIBLE_NAV: CustomizableNavItem[] = ["activity", "budgeting", "recurring", "goals", "insights"];

const NAV_PREFS_KEY = "tallyup.navItems";

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  visibleNavItems: CustomizableNavItem[];
  setVisibleNavItems: (items: CustomizableNavItem[]) => void;
  toggleNavItem: (item: CustomizableNavItem) => void;
  isNavItemVisible: (item: CustomizableNavItem) => boolean;
} | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light-first: default to light, never auto-switch to dark
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("tallyup.theme") as ThemeMode | null;
      if (saved && THEME_CLASSES.includes(saved)) return saved;
      return "porcelain";
    } catch {
      return "porcelain";
    }
  });

  // Navigation customization state
  const [visibleNavItems, setVisibleNavItemsState] = useState<CustomizableNavItem[]>(() => {
    try {
      const saved = localStorage.getItem(NAV_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CustomizableNavItem[];
        // Validate items
        return parsed.filter((item) => NAV_ITEM_CONFIG.some((c) => c.id === item));
      }
      return DEFAULT_VISIBLE_NAV;
    } catch {
      return DEFAULT_VISIBLE_NAV;
    }
  });

  // Apply theme to document
  useEffect(() => {
    // Remove all theme classes first
    THEME_CLASSES.forEach((cls) => document.documentElement.classList.remove(cls));
    // Add the current theme class
    document.documentElement.classList.add(theme);
  }, [theme]);

  function setTheme(newTheme: ThemeMode) {
    setThemeState(newTheme);
    try {
      localStorage.setItem("tallyup.theme", newTheme);
    } catch {}
  }

  const setVisibleNavItems = useCallback((items: CustomizableNavItem[]) => {
    setVisibleNavItemsState(items);
    try {
      localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(items));
    } catch {}
  }, []);

  const toggleNavItem = useCallback((item: CustomizableNavItem) => {
    setVisibleNavItemsState((prev) => {
      const next = prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item];
      try {
        localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
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
