"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext<{ theme: "light" | "dark"; toggle: () => void } | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with a deterministic default so server and initial client render match.
  // We will read the saved preference on mount and update via effect to avoid hydration mismatches.
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // On mount, read saved preference (or system preference) and apply it.
  useEffect(() => {
    try {
      const s = localStorage.getItem("theme");
      if (s === "dark" || s === "light") {
        setTheme(s);
        return;
      }
      // Fallback: try system preference
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } catch {}
  }, []);

  // Persist theme and update document class whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
