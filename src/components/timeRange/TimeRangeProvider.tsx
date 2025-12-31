"use client";

import React, {
  ReactNode,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { resolveRange, getPreviousRange } from "@/src/lib/timeRange/resolve";
import {
  PresetSelectionKey,
  ResolvedRange,
  TimeRangeSelection,
} from "@/src/lib/timeRange/types";
import { TimeRangePickerModal } from "@/src/components/timeRange/TimeRangePickerModal";

export interface TimeRangeContextValue {
  selection: TimeRangeSelection;
  setSelection: (next: TimeRangeSelection) => void;
  resolvedRange: ResolvedRange;
  previousRange: ResolvedRange;
  label: string;
  prevLabel: string;
  isDefault: boolean;
  isPickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  openPicker: () => void;
}

export const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

const STORAGE_KEY = "tallyup.timeRange.selection.v1";
const DEFAULT_SELECTION: TimeRangeSelection = { kind: "preset", key: "this_month" };

const PRESET_LABELS: Record<PresetSelectionKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
  last_year: "Last Year",
};

function todayYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPresetKey(value: string): value is PresetSelectionKey {
  return (
    value === "today" ||
    value === "yesterday" ||
    value === "this_week" ||
    value === "last_week" ||
    value === "this_month" ||
    value === "last_month" ||
    value === "this_year" ||
    value === "last_year"
  );
}

function normalizeSelection(selection: TimeRangeSelection): TimeRangeSelection {
  if (selection.kind === "preset") return selection;
  if (!isValidDateString(selection.from) || !isValidDateString(selection.to)) {
    const today = todayYYYYMMDD();
    return { kind: "custom", from: today, to: today };
  }
  if (selection.from <= selection.to) return selection;
  return { kind: "custom", from: selection.to, to: selection.from };
}

function parseStoredSelection(raw: string | null): TimeRangeSelection | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.kind === "preset" && isPresetKey(parsed.key)) {
      return { kind: "preset", key: parsed.key };
    }
    if (
      parsed?.kind === "custom" &&
      typeof parsed.from === "string" &&
      typeof parsed.to === "string" &&
      isValidDateString(parsed.from) &&
      isValidDateString(parsed.to)
    ) {
      return { kind: "custom", from: parsed.from, to: parsed.to };
    }
  } catch {}
  return null;
}

function formatShortDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(date);
}

function getSelectionLabel(selection: TimeRangeSelection): string {
  if (selection.kind === "preset") {
    return PRESET_LABELS[selection.key] ?? "Custom Range";
  }
  if (!selection.from || !selection.to) return "Custom Range";
  const from = formatShortDate(selection.from);
  const to = formatShortDate(selection.to);
  return `Custom: ${from}–${to}`;
}

function getPrevLabel(selection: TimeRangeSelection): string {
  if (selection.kind === "custom") return "Previous Period";
  switch (selection.key) {
    case "today":
      return "Yesterday";
    case "yesterday":
      return "Day Before";
    case "this_week":
      return "Last Week";
    case "last_week":
      return "Week Before";
    case "this_month":
      return "Last Month";
    case "last_month":
      return "Month Before";
    case "this_year":
      return "Last Year";
    case "last_year":
      return "Year Before";
    default:
      return "Previous Period";
  }
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const initialSelection = useMemo(() => {
    if (typeof window === "undefined") {
      return { selection: DEFAULT_SELECTION, hasStored: false };
    }
    const stored = parseStoredSelection(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      return { selection: stored, hasStored: true };
    }
    return { selection: DEFAULT_SELECTION, hasStored: false };
  }, []);

  const [selection, setSelectionState] = useState<TimeRangeSelection>(
    initialSelection.selection
  );
  const [isPickerOpen, setPickerOpen] = useState(false);
  const hasPersistedRef = useRef(initialSelection.hasStored);

  const setSelection = useCallback((next: TimeRangeSelection) => {
    hasPersistedRef.current = true;
    setSelectionState(normalizeSelection(next));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasPersistedRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  }, [selection]);

  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const resolvedRange = useMemo(
    () => resolveRange(selection, now, timezone),
    [selection, now, timezone]
  );

  const previousRange = useMemo(
    () => getPreviousRange(selection, now),
    [selection, now]
  );

  const label = useMemo(() => getSelectionLabel(selection), [selection]);
  const prevLabel = useMemo(() => getPrevLabel(selection), [selection]);
  const isDefault = selection.kind === "preset" && selection.key === "this_month";

  const openPicker = useCallback(() => setPickerOpen(true), []);

  const value = useMemo(
    () => ({
      selection,
      setSelection,
      resolvedRange,
      previousRange,
      label,
      prevLabel,
      isDefault,
      isPickerOpen,
      setPickerOpen,
      openPicker,
    }),
    [
      selection,
      setSelection,
      resolvedRange,
      previousRange,
      label,
      prevLabel,
      isDefault,
      isPickerOpen,
      setPickerOpen,
      openPicker,
    ]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
      <TimeRangePickerModal
        open={isPickerOpen}
        selection={selection}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => {
          setSelection(next);
          setPickerOpen(false);
        }}
      />
    </TimeRangeContext.Provider>
  );
}
