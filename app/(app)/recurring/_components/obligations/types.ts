import type { Id } from "convex/_generated/dataModel";

export type ChargeState = "upcoming" | "due" | "matched" | "missed" | "skipped";

export interface EnrichedCharge {
  _id: Id<"expectedCharges">;
  ruleId: Id<"recurringRules">;
  expectedDate: number;
  expectedAmountCents?: number;
  state: ChargeState;
  matchedEntryId?: Id<"entries">;
  // Enriched fields
  name: string;
  type: "expense" | "income";
  category?: string;
  amountCents?: number;
  amountMode: string;
  cadenceKind: string;
  accountName?: string;
  institutionName?: string;
  accountLast4?: string;
  ruleStatus: string;
  autolinkEnabled: boolean;
}

export function getStatusColor(state: ChargeState): string {
  switch (state) {
    case "matched":
      return "var(--success)";
    case "due":
      return "var(--warning)";
    case "missed":
      return "var(--error)";
    case "upcoming":
      return "var(--text-tertiary)";
    case "skipped":
      return "var(--text-tertiary)";
    default:
      return "var(--text-tertiary)";
  }
}

export function getStatusLabel(state: ChargeState): string {
  switch (state) {
    case "matched":
      return "Logged";
    case "due":
      return "Due";
    case "missed":
      return "Missed";
    case "upcoming":
      return "Upcoming";
    case "skipped":
      return "Skipped";
    default:
      return state;
  }
}

export function getStatusIcon(state: ChargeState): string {
  switch (state) {
    case "matched":
      return "CheckCircle2";
    case "due":
      return "Clock";
    case "missed":
      return "AlertTriangle";
    case "upcoming":
      return "CalendarClock";
    case "skipped":
      return "SkipForward";
    default:
      return "Circle";
  }
}

export function formatDueDate(timestamp: number): { full: string; short: string; weekday: string; day: number } {
  const date = new Date(timestamp);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((dateMidnight - todayMidnight) / (24 * 60 * 60 * 1000));

  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: "short" });

  let short: string;
  if (diffDays === 0) {
    short = "Today";
  } else if (diffDays === 1) {
    short = "Tomorrow";
  } else if (diffDays === -1) {
    short = "Yesterday";
  } else if (diffDays > 0 && diffDays <= 7) {
    short = weekday;
  } else {
    short = `${month} ${day}`;
  }

  const full = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return { full, short, weekday, day };
}

export function groupChargesByDate(charges: EnrichedCharge[]): {
  overdue: EnrichedCharge[];
  today: EnrichedCharge[];
  thisWeek: EnrichedCharge[];
  nextTwoWeeks: EnrichedCharge[];
  later: EnrichedCharge[];
} {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const twoWeeksEnd = new Date(todayStart);
  twoWeeksEnd.setDate(twoWeeksEnd.getDate() + 14);

  const result = {
    overdue: [] as EnrichedCharge[],
    today: [] as EnrichedCharge[],
    thisWeek: [] as EnrichedCharge[],
    nextTwoWeeks: [] as EnrichedCharge[],
    later: [] as EnrichedCharge[],
  };

  for (const charge of charges) {
    const date = charge.expectedDate;
    if (date < todayStart.getTime() && charge.state !== "matched" && charge.state !== "skipped") {
      result.overdue.push(charge);
    } else if (date >= todayStart.getTime() && date < todayEnd.getTime()) {
      result.today.push(charge);
    } else if (date >= todayEnd.getTime() && date < weekEnd.getTime()) {
      result.thisWeek.push(charge);
    } else if (date >= weekEnd.getTime() && date < twoWeeksEnd.getTime()) {
      result.nextTwoWeeks.push(charge);
    } else if (date >= twoWeeksEnd.getTime()) {
      result.later.push(charge);
    }
  }

  return result;
}

export function groupChargesByCategory(charges: EnrichedCharge[]): Record<string, EnrichedCharge[]> {
  const groups: Record<string, EnrichedCharge[]> = {};
  for (const charge of charges) {
    const key = charge.category ?? "Uncategorized";
    if (!groups[key]) groups[key] = [];
    groups[key].push(charge);
  }
  return groups;
}
