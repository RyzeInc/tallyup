"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * TallyUp Theme System
 * 
 * Light-first design stance:
 * - Default = Light mode (no automatic dark mode on system preference)
 * - Dark mode available as "Dim (Beta)" in Settings → Appearance
 * - Cards always white, text always crisp for finance app trust
 */

type ThemeMode = "light" | "dim";

const ThemeContext = createContext<{
  theme: "light" | "dim";
  setTheme: (mode: ThemeMode) => void;
} | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light-first: default to light, never auto-switch to dark
  const [theme, setThemeState] = useState<ThemeMode>("light");

  // On mount, read saved preference (but only allow dim if explicitly set)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tallyup.theme") as ThemeMode | null;
      if (saved === "dim") {
        setThemeState("dim");
      }
      // Always default to light otherwise
    } catch {}
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (theme === "dim") {
      document.documentElement.classList.add("dim");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dim");
      document.documentElement.classList.add("light");
    }
  }, [theme]);

  function setTheme(newTheme: ThemeMode) {
    setThemeState(newTheme);
    try {
      localStorage.setItem("tallyup.theme", newTheme);
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
  { value: "light", label: "Light", description: "Default, optimized for readability" },
  { value: "dim", label: "Dim (Beta)", description: "Reduced brightness for low-light" },
];
