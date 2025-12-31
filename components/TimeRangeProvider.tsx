"use client";

import React, {
  ReactNode,
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangePreset, getDateRangeFromPreset, todayYYYYMMDD } from "./utils";

interface TimeRangeContextValue {
  preset: DateRangePreset;
  setPreset: (p: DateRangePreset) => void;
  customFrom: string;
  customTo: string;
  setCustomRange: (from: string, to: string) => void;
  startDate: number;
  endDate: number;
  label: string;
  // Previous period for comparisons
  prevStartDate: number;
  prevEndDate: number;
  prevLabel: string;
  // Timezone (default America/New_York)
  timezone: string;
  setTimezone: (tz: string) => void;
}

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

const STORAGE_KEY = "tallyup.timeRange";
const DEFAULT_TIMEZONE = "America/New_York";

// Pages where time range should NOT sync to URL (independent time range)
const INDEPENDENT_TIME_PAGES = ["/dashboard", "/home"];

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx)
    throw new Error("useTimeRange must be used within TimeRangeProvider");
  return ctx;
}

// Compute previous period based on current preset
function getPreviousPeriod(
  preset: DateRangePreset,
  customFrom: string,
  customTo: string
): { startDate: number; endDate: number; label: string } {
  const now = new Date();

  switch (preset) {
    case "today": {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return { startDate: start, endDate: end, label: "Yesterday" };
    }

    case "yesterday": {
      const dayBefore = new Date(now);
      dayBefore.setDate(dayBefore.getDate() - 2);
      const start = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return { startDate: start, endDate: end, label: "Day before" };
    }

    case "week": {
      const range = getDateRangeFromPreset("last-week");
      return { ...range, label: "Last Week" };
    }

    case "last-week": {
      // Two weeks ago
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const dayOfWeek = twoWeeksAgo.getDay();
      const diff = (dayOfWeek + 6) % 7;
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - diff);
      twoWeeksAgo.setHours(0, 0, 0, 0);
      const start = twoWeeksAgo.getTime();
      const end = start + 7 * 24 * 60 * 60 * 1000;
      return { startDate: start, endDate: end, label: "2 Weeks Ago" };
    }

    case "month": {
      const range = getDateRangeFromPreset("last-month");
      return { ...range, label: "Last Month" };
    }

    case "last-month": {
      const twoMonthsAgo = new Date(now);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      twoMonthsAgo.setDate(1);
      twoMonthsAgo.setHours(0, 0, 0, 0);
      const start = twoMonthsAgo.getTime();
      const endDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      return { startDate: start, endDate, label: "2 Months Ago" };
    }

    case "year": {
      const range = getDateRangeFromPreset("last-year");
      return { ...range, label: "Last Year" };
    }

    case "last-year": {
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      twoYearsAgo.setMonth(0, 1);
      twoYearsAgo.setHours(0, 0, 0, 0);
      const start = twoYearsAgo.getTime();
      const end = new Date(now.getFullYear() - 1, 0, 1).getTime();
      return { startDate: start, endDate: end, label: "2 Years Ago" };
    }

    case "custom":
    default: {
      // For custom, compute same-length previous period
      const current = getDateRangeFromPreset("custom", customFrom, customTo);
      const duration = current.endDate - current.startDate;
      const prevEnd = current.startDate;
      const prevStart = prevEnd - duration;
      return { startDate: prevStart, endDate: prevEnd, label: "Previous Period" };
    }
  }
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if current page should use independent time range
  const isIndependentPage = INDEPENDENT_TIME_PAGES.some(p => pathname?.startsWith(p));
  const urlPreset = searchParams?.get("range");
  const urlFrom = searchParams?.get("from");
  const urlTo = searchParams?.get("to");
  
  // Initialize from URL params, then localStorage, then default
  const [preset, setPresetState] = useState<DateRangePreset>(() => {
    if (typeof window === "undefined") return "week";
    
    // Try URL first (for shareable links)
    const urlPreset = searchParams?.get("range") as DateRangePreset | null;
    if (urlPreset && isValidPreset(urlPreset)) {
      return urlPreset;
    }
    
    // Then localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.preset || "week";
      }
    } catch {}
    return "week";
  });

  const [customFrom, setCustomFrom] = useState(() => {
    if (typeof window === "undefined") return todayYYYYMMDD();
    
    // Try URL first
    const urlFrom = searchParams?.get("from");
    if (urlFrom && isValidDateString(urlFrom)) {
      return urlFrom;
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.customFrom || todayYYYYMMDD();
      }
    } catch {}
    return todayYYYYMMDD();
  });

  const [customTo, setCustomTo] = useState(() => {
    if (typeof window === "undefined") return todayYYYYMMDD();
    
    // Try URL first
    const urlTo = searchParams?.get("to");
    if (urlTo && isValidDateString(urlTo)) {
      return urlTo;
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.customTo || todayYYYYMMDD();
      }
    } catch {}
    return todayYYYYMMDD();
  });

  const [timezone, setTimezone] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TIMEZONE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.timezone || DEFAULT_TIMEZONE;
      }
    } catch {}
    return DEFAULT_TIMEZONE;
  });

  const effectivePreset = useMemo(() => {
    if (urlPreset && isValidPreset(urlPreset)) return urlPreset;
    return preset;
  }, [urlPreset, preset]);

  const effectiveFrom = useMemo(() => {
    if (urlPreset === "custom" && urlFrom && isValidDateString(urlFrom)) return urlFrom;
    return customFrom;
  }, [urlPreset, urlFrom, customFrom]);

  const effectiveTo = useMemo(() => {
    if (urlPreset === "custom" && urlTo && isValidDateString(urlTo)) return urlTo;
    return customTo;
  }, [urlPreset, urlTo, customTo]);

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset, customFrom, customTo, timezone })
      );
    }
  }, [preset, customFrom, customTo, timezone]);

  // Sync to URL when time range changes (except on independent pages)
  const prevUrlRef = React.useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined" || isIndependentPage) return;

    const params = new URLSearchParams(searchParams?.toString() || "");

    // Set range params
    params.set("range", effectivePreset);
    if (effectivePreset === "custom") {
      params.set("from", effectiveFrom);
      params.set("to", effectiveTo);
    } else {
      params.delete("from");
      params.delete("to");
    }

    const newUrl = `${pathname}?${params.toString()}`;

    // Avoid infinite loops
    if (newUrl !== prevUrlRef.current) {
      prevUrlRef.current = newUrl;
      router.replace(newUrl, { scroll: false });
    }
  }, [effectivePreset, effectiveFrom, effectiveTo, pathname, isIndependentPage, router, searchParams]);

  const setPreset = useCallback((p: DateRangePreset) => {
    setPresetState(p);
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    // Validate: end must not be before start
    if (from > to) {
      console.warn("Invalid range: end before start");
      return;
    }
    setCustomFrom(from);
    setCustomTo(to);
    setPresetState("custom");
  }, []);

  const currentRange = useMemo(() => {
    return getDateRangeFromPreset(effectivePreset, effectiveFrom, effectiveTo);
  }, [effectivePreset, effectiveFrom, effectiveTo]);

  const previousPeriod = useMemo(() => {
    return getPreviousPeriod(effectivePreset, effectiveFrom, effectiveTo);
  }, [effectivePreset, effectiveFrom, effectiveTo]);

  const value: TimeRangeContextValue = useMemo(
    () => ({
      preset: effectivePreset,
      setPreset,
      customFrom: effectiveFrom,
      customTo: effectiveTo,
      setCustomRange,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      label: currentRange.label,
      prevStartDate: previousPeriod.startDate,
      prevEndDate: previousPeriod.endDate,
      prevLabel: previousPeriod.label,
      timezone,
      setTimezone,
    }),
    [effectivePreset, setPreset, effectiveFrom, effectiveTo, setCustomRange, currentRange, previousPeriod, timezone]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}

// Helper: validate preset value
function isValidPreset(value: string): value is DateRangePreset {
  return [
    "today", "yesterday", "week", "last-week", 
    "month", "last-month", "year", "last-year", "custom"
  ].includes(value);
}

// Helper: validate date string (YYYY-MM-DD)
function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
