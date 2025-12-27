"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

const ThemeContext = createContext<{
  theme: "light" | "dark";
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
} | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // mode = user preference (system, light, dark)
  // theme = resolved actual theme (light, dark)
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // On mount, read saved preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tallyup.themeMode") as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    } catch {}
  }, []);

  // Resolve actual theme based on mode and system preference
  useEffect(() => {
    function resolveTheme() {
      if (mode === "system") {
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        return prefersDark ? "dark" : "light";
      }
      return mode;
    }

    const resolved = resolveTheme();
    setTheme(resolved);

    // Apply to document
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Listen for system preference changes when in system mode
    if (mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? "dark" : "light";
        setTheme(newTheme);
        if (newTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [mode]);

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    try {
      localStorage.setItem("tallyup.themeMode", newMode);
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
