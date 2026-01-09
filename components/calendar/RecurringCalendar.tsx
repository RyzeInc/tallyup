"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars } from "@/components/utils";
import * as Lucide from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface RecurringRule {
  _id: string;
  displayName?: string;
  name?: string;
  category?: string;
  bucket?: string;
  type: "expense" | "income";
  amountCents?: number;
  cadenceType?: string;
  cadenceAnchor?: string;
  cadence?: {
    kind: string;
    anchorDate?: number;
    intervalDays?: number;
  };
  status?: string;
  active: boolean;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: RecurringRule[];
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ─────────────────────────────────────────────────────────────
// Calendar Utilities
// ─────────────────────────────────────────────────────────────
function getMonthDays(year: number, month: number): CalendarDay[] {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();
  
  const days: CalendarDay[] = [];
  
  // Previous month padding
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startPadding - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    days.push({
      date: new Date(year, month - 1, day),
      day,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    days.push({
      date,
      day,
      isCurrentMonth: true,
      isToday,
      events: [],
    });
  }
  
  // Next month padding (fill to complete 6 rows = 42 cells)
  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day++) {
    days.push({
      date: new Date(year, month + 1, day),
      day,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }
  
  return days;
}

function getDayOfMonth(rule: RecurringRule): number | null {
  // Try to extract day of month from cadenceAnchor
  if (rule.cadenceAnchor) {
    const day = parseInt(rule.cadenceAnchor, 10);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      return day;
    }
    if (rule.cadenceAnchor === "last-day") {
      return -1; // Special marker for last day
    }
  }
  
  // Try from cadence.anchorDate
  if (rule.cadence?.anchorDate) {
    const date = new Date(rule.cadence.anchorDate);
    return date.getDate();
  }
  
  return null;
}

function matchesDay(rule: RecurringRule, calendarDay: CalendarDay): boolean {
  const cadenceType = rule.cadenceType || rule.cadence?.kind;
  const dayOfMonth = getDayOfMonth(rule);
  
  if (!cadenceType) return false;
  
  const day = calendarDay.date.getDate();
  const lastDayOfMonth = new Date(
    calendarDay.date.getFullYear(),
    calendarDay.date.getMonth() + 1,
    0
  ).getDate();
  
  switch (cadenceType) {
    case "monthly":
      if (dayOfMonth === -1) {
        // Last day of month
        return day === lastDayOfMonth;
      }
      if (dayOfMonth) {
        // Handle months with fewer days
        const targetDay = Math.min(dayOfMonth, lastDayOfMonth);
        return day === targetDay;
      }
      return false;
      
    case "biweekly":
    case "weekly":
      // For weekly/biweekly, we'd need the anchor weekday
      // For now, approximate using anchorDate
      if (rule.cadence?.anchorDate) {
        const anchorDate = new Date(rule.cadence.anchorDate);
        return calendarDay.date.getDay() === anchorDate.getDay();
      }
      return false;
      
    case "quarterly":
      // Every 3 months on same day
      if (dayOfMonth) {
        const targetDay = Math.min(dayOfMonth, lastDayOfMonth);
        if (day !== targetDay) return false;
        const month = calendarDay.date.getMonth();
        // Check if this month is a quarter month (0, 3, 6, 9 or 2, 5, 8, 11 etc)
        return month % 3 === 0; // Simplified: assumes Jan, Apr, Jul, Oct
      }
      return false;
      
    case "yearly":
      // Once per year on anchor date
      if (rule.cadence?.anchorDate) {
        const anchorDate = new Date(rule.cadence.anchorDate);
        return (
          calendarDay.date.getMonth() === anchorDate.getMonth() &&
          calendarDay.date.getDate() === anchorDate.getDate()
        );
      }
      return false;
      
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Month/Year Selector
// ─────────────────────────────────────────────────────────────
function MonthYearSelector({ 
  month, 
  year, 
  onChange 
}: { 
  month: number; 
  year: number; 
  onChange: (month: number, year: number) => void;
}) {
  const goToPrev = () => {
    if (month === 0) {
      onChange(11, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };
  
  const goToNext = () => {
    if (month === 11) {
      onChange(0, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };
  
  const goToToday = () => {
    const today = new Date();
    onChange(today.getMonth(), today.getFullYear());
  };
  
  return (
    <div 
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        gap: "var(--space-2, 8px)",
      }}
    >
      <button
        onClick={goToPrev}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-full, 9999px)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
      >
        <Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text)" }} />
      </button>
      
      <button
        onClick={goToToday}
        style={{ 
          fontSize: "1.125rem", 
          fontWeight: 600, 
          color: "var(--text)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 12px",
          borderRadius: "var(--radius-sm, 8px)",
          transition: "background 150ms ease",
        }}
        className="hover:bg-[var(--surface-2)]"
      >
        {MONTH_NAMES[month]} {year}
      </button>
      
      <button
        onClick={goToNext}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-full, 9999px)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
      >
        <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text)" }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Event Dot/Pill
// ─────────────────────────────────────────────────────────────
function EventDot({ rule }: { rule: RecurringRule }) {
  const isIncome = rule.type === "income";
  
  return (
    <div
      title={rule.displayName || rule.name || rule.category || "Recurring"}
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: isIncome ? "var(--success)" : "var(--danger)",
        flexShrink: 0,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Day Cell
// ─────────────────────────────────────────────────────────────
function DayCell({ 
  calendarDay, 
  onSelect 
}: { 
  calendarDay: CalendarDay;
  onSelect: (day: CalendarDay) => void;
}) {
  const { day, isCurrentMonth, isToday, events } = calendarDay;
  
  return (
    <button
      onClick={() => events.length > 0 && onSelect(calendarDay)}
      disabled={events.length === 0}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "4px 2px",
        minHeight: 48,
        backgroundColor: isToday ? "var(--accent-subtle)" : "transparent",
        border: "none",
        borderRadius: "var(--radius-sm, 8px)",
        cursor: events.length > 0 ? "pointer" : "default",
        transition: "background 150ms ease",
        opacity: isCurrentMonth ? 1 : 0.35,
      }}
      className={events.length > 0 ? "hover:bg-[var(--surface-2)]" : ""}
    >
      <span
        style={{
          fontSize: "0.8125rem",
          fontWeight: isToday ? 700 : 500,
          color: isToday ? "var(--primary)" : "var(--text)",
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          backgroundColor: isToday ? "var(--primary)" : "transparent",
          ...(isToday && { color: "var(--primary-foreground)" }),
        }}
      >
        {day}
      </span>
      
      {/* Event dots */}
      {events.length > 0 && (
        <div 
          style={{ 
            display: "flex", 
            gap: 2, 
            marginTop: 2,
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: "100%",
          }}
        >
          {events.slice(0, 3).map((rule, i) => (
            <EventDot key={i} rule={rule} />
          ))}
          {events.length > 3 && (
            <span style={{ fontSize: "0.5rem", color: "var(--text-tertiary)" }}>
              +{events.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Day Detail Modal/Sheet
// ─────────────────────────────────────────────────────────────
function DayDetailSheet({ 
  day, 
  onClose 
}: { 
  day: CalendarDay; 
  onClose: () => void;
}) {
  const dateStr = day.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
      />
      
      {/* Sheet */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 500,
          maxHeight: "70vh",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--card-radius, 16px) var(--card-radius, 16px) 0 0",
          padding: "var(--space-4, 16px)",
          paddingBottom: "calc(var(--space-4, 16px) + env(safe-area-inset-bottom, 0px))",
          overflowY: "auto",
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            backgroundColor: "var(--border)",
            borderRadius: 2,
            margin: "0 auto 16px",
          }}
        />
        
        {/* Header */}
        <div 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text)" }}>
            {dateStr}
          </h3>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--surface-2)",
              cursor: "pointer",
            }}
          >
            <Lucide.X className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        
        {/* Events List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {day.events.map((rule, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px",
                backgroundColor: "var(--surface-2)",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: rule.type === "income" ? "var(--success)" : "var(--danger)",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: "0.9375rem" }}>
                    {rule.displayName || rule.name || rule.category || "Recurring"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "capitalize" }}>
                    {rule.cadenceType || rule.cadence?.kind || "Monthly"}
                  </div>
                </div>
              </div>
              
              {rule.amountCents && (
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    color: rule.type === "income" ? "var(--success)" : "var(--danger)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {rule.type === "expense" ? "-" : "+"}{centsToDollars(rule.amountCents)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export function RecurringCalendar() {
  const today = new Date();
  const [month, setMonth] = React.useState(today.getMonth());
  const [year, setYear] = React.useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = React.useState<CalendarDay | null>(null);
  
  // Fetch active recurring rules
  const rules = useQuery(api.recurring.listRecurringRules, {}) as RecurringRule[] | undefined;
  
  // Build calendar with events placed on appropriate days
  const calendarDays = React.useMemo(() => {
    const days = getMonthDays(year, month);
    
    if (!rules) return days;
    
    // Place each rule on its matching days
    for (const rule of rules) {
      if (!rule.active) continue;
      if (rule.status === "cancelled" || rule.status === "archived") continue;
      
      for (const day of days) {
        if (day.isCurrentMonth && matchesDay(rule, day)) {
          day.events.push(rule);
        }
      }
    }
    
    return days;
  }, [year, month, rules]);
  
  // Calculate monthly totals from recurring rules
  const monthlyTotals = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    
    for (const day of calendarDays) {
      if (!day.isCurrentMonth) continue;
      for (const rule of day.events) {
        if (rule.amountCents) {
          if (rule.type === "income") {
            income += rule.amountCents;
          } else {
            expense += rule.amountCents;
          }
        }
      }
    }
    
    return { income, expense, net: income - expense };
  }, [calendarDays]);
  
  return (
    <div 
      style={{ 
        backgroundColor: "var(--surface)",
        borderRadius: "var(--card-radius, 12px)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header with month selector */}
      <div 
        style={{ 
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <MonthYearSelector
          month={month}
          year={year}
          onChange={(m, y) => {
            setMonth(m);
            setYear(y);
          }}
        />
      </div>
      
      {/* Weekday headers */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(7, 1fr)",
          padding: "8px 8px 4px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          padding: "8px",
        }}
      >
        {calendarDays.map((day, i) => (
          <DayCell
            key={i}
            calendarDay={day}
            onSelect={setSelectedDay}
          />
        ))}
      </div>
      
      {/* Monthly summary */}
      <div 
        style={{ 
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--surface-2, var(--surface))",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 2 }}>
            Income
          </div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
            {centsToDollars(monthlyTotals.income)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 2 }}>
            Expenses
          </div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
            {centsToDollars(monthlyTotals.expense)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 2 }}>
            Net
          </div>
          <div 
            style={{ 
              fontSize: "0.9375rem", 
              fontWeight: 600, 
              color: monthlyTotals.net >= 0 ? "var(--success)" : "var(--danger)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {monthlyTotals.net >= 0 ? "+" : ""}{centsToDollars(monthlyTotals.net)}
          </div>
        </div>
      </div>
      
      {/* Day detail sheet */}
      {selectedDay && (
        <DayDetailSheet
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

export default RecurringCalendar;
