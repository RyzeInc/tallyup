import { PresetSelectionKey, ResolvedRange, TimeRangeSelection } from "./types";

function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekLocal(date: Date): Date {
  const d = startOfDayLocal(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYearLocal(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function parseYYYYMMDD(value: string): Date | null {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function resolvePresetRange(key: PresetSelectionKey, now: Date): ResolvedRange {
  switch (key) {
    case "today": {
      const from = startOfDayLocal(now);
      return { from, to: addDaysLocal(from, 1) };
    }
    case "yesterday": {
      const to = startOfDayLocal(now);
      return { from: addDaysLocal(to, -1), to };
    }
    case "this_week": {
      const from = startOfWeekLocal(now);
      return { from, to: addDaysLocal(from, 7) };
    }
    case "last_week": {
      const to = startOfWeekLocal(now);
      return { from: addDaysLocal(to, -7), to };
    }
    case "this_month": {
      const from = startOfMonthLocal(now);
      const next = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      return { from, to: next };
    }
    case "last_month": {
      const to = startOfMonthLocal(now);
      const from = new Date(to.getFullYear(), to.getMonth() - 1, 1);
      return { from, to };
    }
    case "this_year": {
      const from = startOfYearLocal(now);
      return { from, to: new Date(from.getFullYear() + 1, 0, 1) };
    }
    case "last_year": {
      const to = startOfYearLocal(now);
      return { from: new Date(to.getFullYear() - 1, 0, 1), to };
    }
    default: {
      const from = startOfDayLocal(now);
      return { from, to: addDaysLocal(from, 1) };
    }
  }
}

export function resolveRange(selection: TimeRangeSelection, now: Date): ResolvedRange {
  if (selection.kind === "preset") {
    return resolvePresetRange(selection.key, now);
  }

  const fromDate = parseYYYYMMDD(selection.from) ?? startOfDayLocal(now);
  const toDate = parseYYYYMMDD(selection.to) ?? startOfDayLocal(now);
  const from = startOfDayLocal(fromDate);
  const to = addDaysLocal(startOfDayLocal(toDate), 1);

  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }

  return { from: to, to: from };
}

export function getPreviousRange(selection: TimeRangeSelection, now: Date): ResolvedRange {
  if (selection.kind === "preset") {
    switch (selection.key) {
      case "today":
        return resolvePresetRange("yesterday", now);
      case "yesterday": {
        const to = startOfDayLocal(now);
        const from = addDaysLocal(to, -2);
        return { from, to: addDaysLocal(to, -1) };
      }
      case "this_week":
        return resolvePresetRange("last_week", now);
      case "last_week": {
        const thisWeek = startOfWeekLocal(now);
        const to = addDaysLocal(thisWeek, -7);
        const from = addDaysLocal(to, -7);
        return { from, to };
      }
      case "this_month":
        return resolvePresetRange("last_month", now);
      case "last_month": {
        const thisMonth = startOfMonthLocal(now);
        const to = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
        const from = new Date(to.getFullYear(), to.getMonth() - 1, 1);
        return { from, to };
      }
      case "this_year":
        return resolvePresetRange("last_year", now);
      case "last_year": {
        const thisYear = startOfYearLocal(now);
        const to = new Date(thisYear.getFullYear() - 1, 0, 1);
        const from = new Date(to.getFullYear() - 1, 0, 1);
        return { from, to };
      }
      default:
        return resolvePresetRange("today", now);
    }
  }

  const current = resolveRange(selection, now);
  const duration = current.to.getTime() - current.from.getTime();
  const prevTo = new Date(current.from.getTime());
  const prevFrom = new Date(prevTo.getTime() - duration);
  return { from: prevFrom, to: prevTo };
}
