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
import { useRouter, useSearchParams } from "next/navigation";
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
  timeRange: { preset: DateRangePreset; start?: string; end?: string };
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

// Single global time range shared across tabs

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx)
    throw new Error("useTimeRange must be used within TimeRangeProvider");
  return ctx;
}

function getPreviousPeriod(
  preset: DateRangePreset,
  customFrom: string,
  customTo: string
): { startDate: number; endDate: number; label: string } {
  const now = new Date();

  switch (preset) {
    case "THIS_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const endDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startDate: start, endDate, label: "Last Month" };
    }

    case "LAST_30": {
      const current = getDateRangeFromPreset("LAST_30");
      const duration = current.endDate - current.startDate;
      const endDate = current.startDate;
      return { startDate: endDate - duration, endDate, label: "Previous 30 Days" };
    }

    case "CUSTOM":
    default: {
      // For custom, compute same-length previous period
      const current = getDateRangeFromPreset("CUSTOM", customFrom, customTo);
      const duration = current.endDate - current.startDate;
      const prevEnd = current.startDate;
      const prevStart = prevEnd - duration;
      return { startDate: prevStart, endDate: prevEnd, label: "Previous Period" };
    }
  }
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize from URL params, then localStorage, then default
  const [preset, setPresetState] = useState<DateRangePreset>(() => {
    if (typeof window === "undefined") return "THIS_MONTH";
    
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
        return parsed.preset || "THIS_MONTH";
      }
    } catch {}
    return "THIS_MONTH";
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

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset, customFrom, customTo, timezone })
      );
    }
  }, [preset, customFrom, customTo, timezone]);

  // Sync to URL when time range changes
  const prevUrlRef = React.useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const params = new URLSearchParams(searchParams?.toString() || "");
    
    // Set range params
    params.set("range", preset);
    if (preset === "CUSTOM") {
      params.set("from", customFrom);
      params.set("to", customTo);
    } else {
      params.delete("from");
      params.delete("to");
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    
    // Avoid infinite loops
    if (newUrl !== prevUrlRef.current) {
      prevUrlRef.current = newUrl;
      router.replace(newUrl, { scroll: false });
    }
  }, [preset, customFrom, customTo, router, searchParams]);

  // Read from URL when navigating (for shareable links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const urlPreset = searchParams?.get("range") as DateRangePreset | null;
    if (urlPreset && isValidPreset(urlPreset) && urlPreset !== preset) {
      setPresetState(urlPreset);
    }
    
    if (urlPreset === "CUSTOM") {
      const urlFrom = searchParams?.get("from");
      const urlTo = searchParams?.get("to");
      if (urlFrom && isValidDateString(urlFrom) && urlFrom !== customFrom) {
        setCustomFrom(urlFrom);
      }
      if (urlTo && isValidDateString(urlTo) && urlTo !== customTo) {
        setCustomTo(urlTo);
      }
    }
  }, [searchParams, preset, customFrom, customTo]);

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
    setPresetState("CUSTOM");
  }, []);

  const currentRange = useMemo(() => {
    return getDateRangeFromPreset(preset, customFrom, customTo);
  }, [preset, customFrom, customTo]);

  const previousPeriod = useMemo(() => {
    return getPreviousPeriod(preset, customFrom, customTo);
  }, [preset, customFrom, customTo]);

  const value: TimeRangeContextValue = useMemo(
    () => ({
      preset,
      setPreset,
      customFrom,
      customTo,
      setCustomRange,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      label: currentRange.label,
      timeRange: {
        preset,
        start: new Date(currentRange.startDate).toISOString(),
        end: new Date(currentRange.endDate).toISOString(),
      },
      prevStartDate: previousPeriod.startDate,
      prevEndDate: previousPeriod.endDate,
      prevLabel: previousPeriod.label,
      timezone,
      setTimezone,
    }),
    [preset, setPreset, customFrom, customTo, setCustomRange, currentRange, previousPeriod, timezone]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}

// Helper: validate preset value
function isValidPreset(value: string): value is DateRangePreset {
  return ["THIS_MONTH", "LAST_30", "CUSTOM"].includes(value);
}

// Helper: validate date string (YYYY-MM-DD)
function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
