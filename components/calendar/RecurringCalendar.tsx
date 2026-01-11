"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars } from "@/components/utils";
import * as Lucide from "lucide-react";
import RuleEditorDialog from "@/app/(app)/recurring/_components/rules/RuleEditorDialog";

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
// Event Item (shows name and amount in cell)
// ─────────────────────────────────────────────────────────────
function formatPreviewName(name: string, maxLen = 20) {
  if (!name) return "";
  if (name.length <= maxLen) return name;
  const words = name.split(/\s+/);
  // try to include as many words as fit within maxLen, but at least one whole word
  let out = words[0];
  if (out.length >= maxLen) {
    // first word too long — truncate the word
    return out.slice(0, Math.max(8, maxLen - 1)) + "…";
  }
  for (let i = 1; i < words.length; i++) {
    const candidate = out + " " + words[i];
    if (candidate.length <= maxLen) out = candidate;
    else break;
  }
  if (out.length === name.length) return out;
  return out + "…";
}

function EventItem({ 
  rule, 
  isMobile, 
  isDesktop,
  onClick,
}: { 
  rule: RecurringRule; 
  isMobile?: boolean; 
  isDesktop?: boolean;
  onClick?: () => void;
}) {
  const isIncome = rule.type === "income";
  const name = rule.displayName || rule.name || rule.category || "Recurring";
  const preview = formatPreviewName(name, isDesktop ? 28 : isMobile ? 18 : 20);
  
  // Build tooltip with name and amount
  const amountStr = rule.amountCents 
    ? `${rule.type === "expense" ? "-" : "+"}${centsToDollars(rule.amountCents)}`
    : "";
  const tooltip = amountStr ? `${name}\n${amountStr}` : name;
  
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        display: "block",
        padding: isDesktop ? "8px 10px" : isMobile ? "6px 8px" : "4px 6px",
        borderRadius: 8,
        backgroundColor: isIncome ? "rgba(34, 197, 94, 0.04)" : "rgba(239, 68, 68, 0.04)",
        borderLeft: `2px solid ${isIncome ? "var(--success)" : "var(--danger)"}`,
        fontSize: isDesktop ? "0.875rem" : "0.75rem",
        lineHeight: 1.08,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "background 150ms ease",
      }}
      title={tooltip}
      className={onClick ? "hover:opacity-80" : ""}
    >
      <span
        style={{
          color: "var(--text)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
      >
        {preview}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Day Cell (shows transaction details)
// ─────────────────────────────────────────────────────────────
function DayCell({ 
  calendarDay, 
  onSelect,
  isMobile,
  isDesktop,
}: { 
  calendarDay: CalendarDay;
  onSelect: (day: CalendarDay) => void;
  isMobile?: boolean;
  isDesktop?: boolean;
}) {
  const { day, isCurrentMonth, isToday, events } = calendarDay;
  const cellPad = isDesktop ? 10 : isMobile ? 4 : 6;
  
  return (
    <div
      onClick={() => events.length > 0 && onSelect(calendarDay)}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: cellPad,
        minHeight: 0,
        height: "100%",
        backgroundColor: isToday ? "var(--accent-subtle)" : "transparent",
        border: isToday ? "2px solid var(--primary)" : "1px solid var(--border)",
        borderRadius: "var(--radius-sm, 8px)",
        cursor: events.length > 0 ? "pointer" : "default",
        transition: "all 150ms ease",
        opacity: isCurrentMonth ? 1 : 0.35,
        overflow: "hidden",
      }}
      className={events.length > 0 ? "hover:bg-[var(--surface-2)]" : ""}
    >
      {/* Day number */}
      <span
        style={{
          fontSize: isDesktop ? "0.95rem" : "0.6875rem",
          fontWeight: isToday ? 800 : 600,
          color: isToday ? "var(--primary)" : "var(--text-secondary)",
          marginBottom: isDesktop ? 10 : 6,
          alignSelf: "flex-start",
        }}
      >
        {day}
      </span>
      
      {/* Event items */}
      {events.length > 0 && (
        <div 
          style={{ 
            display: "flex", 
            flexDirection: "column",
            gap: isDesktop ? 8 : isMobile ? 4 : 5,
            flex: 1,
            overflow: "hidden",
          }}
        >
          {events.slice(0, isDesktop ? 4 : 2).map((rule, i) => (
            <EventItem key={i} rule={rule} isMobile={isMobile} isDesktop={isDesktop} />
          ))}
          {events.length > (isDesktop ? 4 : 2) && (
            <span 
              style={{ 
                fontSize: "0.625rem", 
                color: "var(--text-tertiary)",
                fontWeight: 500,
                paddingLeft: 6,
              }}
            >
              +{events.length - (isDesktop ? 4 : 2)} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Day Detail Dialog (centered modal instead of bottom sheet)
// ─────────────────────────────────────────────────────────────
function DayDetailDialog({ 
  day, 
  onClose,
  onEditRule,
}: { 
  day: CalendarDay; 
  onClose: () => void;
  onEditRule: (rule: RecurringRule) => void;
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
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
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
      
      {/* Dialog */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          maxHeight: "80vh",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--card-radius, 16px)",
          padding: "var(--space-5, 20px)",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: 20,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {day.events.map((rule, i) => (
            <button
              key={i}
              onClick={() => onEditRule(rule)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                backgroundColor: "var(--surface-2)",
                borderRadius: "var(--radius-sm, 10px)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                transition: "all 150ms ease",
                textAlign: "left",
                width: "100%",
              }}
              className="hover:bg-[var(--surface-subtle)]"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: rule.type === "income" ? "var(--success)" : "var(--danger)",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.9375rem" }}>
                    {rule.displayName || rule.name || rule.category || "Recurring"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "capitalize" }}>
                    {rule.cadenceType || rule.cadence?.kind || "Monthly"}
                  </div>
                </div>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
              </div>
            </button>
          ))}
        </div>
        
        {/* Hint */}
        <p style={{ 
          fontSize: "0.75rem", 
          color: "var(--text-tertiary)", 
          textAlign: "center",
          marginTop: 16,
        }}>
          Click a transaction to edit
        </p>
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
  const [selectedRule, setSelectedRule] = React.useState<RecurringRule | null>(null);
  const [viewMode, setViewMode] = React.useState<string>("month");
  const [isMobile, setIsMobile] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  
  // Fetch active recurring rules
  const rules = useQuery(api.recurring.listRecurringRules, {}) as RecurringRule[] | undefined;

  // detect mobile
  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w <= 640);
      setIsDesktop(w >= 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  
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
        boxShadow: isDesktop ? "none" : "var(--shadow-card)",
        width: "100%",
        height: isDesktop ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Header with month selector */}
      <div 
        style={{ 
          padding: isDesktop ? "16px 24px" : "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <MonthYearSelector
            month={month}
            year={year}
            onChange={(m, y) => {
              setMonth(m);
              setYear(y);
            }}
          />

          {/* View selector - responsive */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(isMobile ? ["agenda", "day", "3-day", "month"] : ["day", "week", "month"]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: viewMode === v ? "1px solid var(--primary)" : "1px solid var(--border)",
                  background: viewMode === v ? "var(--primary)" : "var(--surface)",
                  color: viewMode === v ? "var(--primary-foreground)" : "var(--text)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                {v === "3-day" ? "3-Day" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Weekday headers - hide for day/agenda view */}
      {(viewMode === "month" || viewMode === "week" || viewMode === "3-day") && (
        <div 
          style={{ 
            display: "grid", 
            gridTemplateColumns: viewMode === "week" || viewMode === "3-day" 
              ? `repeat(${viewMode === "3-day" ? 3 : 7}, 1fr)` 
              : "repeat(7, 1fr)",
            padding: isDesktop ? "12px 12px 8px" : "8px 8px 4px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {(viewMode === "3-day" ? WEEKDAYS.slice(0, 3) : WEEKDAYS).map((day) => (
            <div
              key={day}
              style={{
                textAlign: "center",
                fontSize: isDesktop ? "0.8125rem" : "0.6875rem",
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
      )}
      
      {/* Calendar views */}
      {(() => {
        // Agenda view (mobile)
        if (viewMode === "agenda") {
          return (
            <div style={{ padding: isDesktop ? 16 : 12 }}>
              {calendarDays.filter(d => d.isCurrentMonth && d.events.length > 0).map((d, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: isDesktop ? "1rem" : "0.875rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                    {d.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {d.events.map((rule, i) => (
                      <div
                        key={i}
                        style={{
                          padding: isDesktop ? '12px 16px' : '10px 12px',
                          borderRadius: 10,
                          background: 'var(--surface-2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          borderLeft: `3px solid ${rule.type === 'income' ? 'var(--success)' : 'var(--danger)'}`,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: isDesktop ? '1rem' : '0.9375rem' }}>
                          {rule.displayName || rule.name || rule.category}
                        </div>
                        {rule.amountCents && (
                          <div style={{ color: rule.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: isDesktop ? '1rem' : '0.9375rem' }}>
                            {rule.type === 'expense' ? '-' : '+'}{centsToDollars(rule.amountCents)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {calendarDays.filter(d => d.isCurrentMonth && d.events.length > 0).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
                  No recurring transactions this month
                </div>
              )}
            </div>
          );
        }

        // Day view (single day - today or selected)
        if (viewMode === "day") {
          const todayCell = calendarDays.find(d => d.isToday) || calendarDays.find(d => d.isCurrentMonth);
          if (!todayCell) return null;
          return (
            <div style={{ padding: isDesktop ? 20 : 12 }}>
              <div style={{ fontSize: isDesktop ? "1.125rem" : "1rem", fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                {todayCell.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              {todayCell.events.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {todayCell.events.map((rule, i) => (
                    <div
                      key={i}
                      style={{
                        padding: isDesktop ? '14px 18px' : '12px 14px',
                        borderRadius: 10,
                        background: 'var(--surface-2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        borderLeft: `4px solid ${rule.type === 'income' ? 'var(--success)' : 'var(--danger)'}`,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: isDesktop ? '1.0625rem' : '1rem' }}>
                        {rule.displayName || rule.name || rule.category}
                      </div>
                      {rule.amountCents && (
                        <div style={{ color: rule.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: isDesktop ? '1.0625rem' : '1rem' }}>
                          {rule.type === 'expense' ? '-' : '+'}{centsToDollars(rule.amountCents)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
                  No recurring transactions today
                </div>
              )}
            </div>
          );
        }

        // Week view (7 days starting from Sunday of current week)
        if (viewMode === "week") {
          const todayIdx = calendarDays.findIndex(d => d.isToday);
          const startIdx = todayIdx >= 0 ? todayIdx - (today.getDay()) : 0;
          const weekDays = calendarDays.slice(Math.max(0, startIdx), Math.max(0, startIdx) + 7);
          return (
            <div 
              style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: isDesktop ? 8 : 4,
                padding: isDesktop ? 16 : 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              {weekDays.map((day, i) => (
                <DayCell
                  key={i}
                  calendarDay={day}
                  onSelect={setSelectedDay}
                  isMobile={isMobile}
                  isDesktop={isDesktop}
                />
              ))}
            </div>
          );
        }

        // 3-Day view (mobile: today + 2 days)
        if (viewMode === "3-day") {
          const todayIdx = calendarDays.findIndex(d => d.isToday);
          const startIdx = todayIdx >= 0 ? todayIdx : 0;
          const threeDays = calendarDays.slice(startIdx, startIdx + 3);
          return (
            <div 
              style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 4,
                padding: 8,
              }}
            >
              {threeDays.map((day, i) => (
                <DayCell
                  key={i}
                  calendarDay={day}
                  onSelect={setSelectedDay}
                  isMobile={isMobile}
                  isDesktop={isDesktop}
                />
              ))}
            </div>
          );
        }

        // Month view (default)
        return (
          <div 
            style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(7, 1fr)",
              gridTemplateRows: isDesktop ? "repeat(6, 1fr)" : undefined,
              gap: isDesktop ? 8 : 4,
              padding: isDesktop ? 16 : 8,
              flex: 1,
              minHeight: 0,
            }}
          >
            {calendarDays.map((day, i) => (
              <DayCell
                key={i}
                calendarDay={day}
                onSelect={setSelectedDay}
                isMobile={isMobile}
                isDesktop={isDesktop}
              />
            ))}
          </div>
        );
      })()}
      
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
              color: monthlyTotals.net >= 0 ? "var(--net)" : "var(--danger)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {monthlyTotals.net >= 0 ? "+" : ""}{centsToDollars(monthlyTotals.net)}
          </div>
        </div>
      </div>
      
      {/* Day detail dialog */}
      {selectedDay && (
        <DayDetailDialog
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onEditRule={(rule) => {
            setSelectedDay(null);
            setSelectedRule(rule);
          }}
        />
      )}
      
      {/* Rule editor dialog */}
      <RuleEditorDialog
        open={!!selectedRule}
        onClose={() => setSelectedRule(null)}
        rule={selectedRule as import("convex/_generated/dataModel").Doc<"recurringRules"> | undefined}
      />
    </div>
  );
}

export default RecurringCalendar;
