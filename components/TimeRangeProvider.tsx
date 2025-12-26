"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
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
}

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

const STORAGE_KEY = "tallyup.timeRange";

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
  // Initialize from localStorage or default to 'week'
  const [preset, setPresetState] = useState<DateRangePreset>(() => {
    if (typeof window === "undefined") return "week";
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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.customTo || todayYYYYMMDD();
      }
    } catch {}
    return todayYYYYMMDD();
  });

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset, customFrom, customTo })
      );
    }
  }, [preset, customFrom, customTo]);

  const setPreset = useCallback((p: DateRangePreset) => {
    setPresetState(p);
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setPresetState("custom");
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
      prevStartDate: previousPeriod.startDate,
      prevEndDate: previousPeriod.endDate,
      prevLabel: previousPeriod.label,
    }),
    [preset, setPreset, customFrom, customTo, setCustomRange, currentRange, previousPeriod]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}
