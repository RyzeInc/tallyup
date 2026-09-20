"use client";
import { usePeriodEntries } from "@/components/usePeriodEntries";
import { countsInCashflow, reportingAmount } from "@/lib/finance/semantics";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars } from "@/components/utils";
import * as Lucide from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface MonthData {
  month: number; // 0-11
  year: number;
  income: number; // cents
  expense: number; // cents
  net: number; // cents
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Quarter header styles using CSS custom properties
const QUARTER_HEADER_STYLES: Record<number, React.CSSProperties> = {
  0: { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" },
  1: { backgroundColor: "var(--success)", color: "#ffffff" },
  2: { backgroundColor: "var(--warning)", color: "#ffffff" },
  3: { backgroundColor: "var(--chart-6, #C87A5A)", color: "#ffffff" },
};

function getQuarterHeaderStyle(month: number): React.CSSProperties {
  return QUARTER_HEADER_STYLES[Math.floor(month / 3)];
}

// ─────────────────────────────────────────────────────────────
// Utility: Generate month key for lookups
// ─────────────────────────────────────────────────────────────
function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

// ─────────────────────────────────────────────────────────────
// Money Display Component
// ─────────────────────────────────────────────────────────────
function MoneyValue({ 
  cents, 
  colorize = false,
  size = "normal",
  isNet = false,
}: { 
  cents: number; 
  colorize?: boolean;
  size?: "normal" | "large";
  isNet?: boolean; // Use --net color instead of --success for positive values
}) {
  const isNegative = cents < 0;
  const formatted = centsToDollars(Math.abs(cents));
  const sign = isNegative ? "-" : "";
  
  let colorStyle: React.CSSProperties = { color: "var(--text)" };
  if (colorize) {
    if (isNegative) {
      colorStyle = { color: "var(--danger)" };
    } else if (cents > 0) {
      // Use --net for net values, --success for income
      colorStyle = { color: isNet ? "var(--net)" : "var(--success)" };
    }
  }
  
  return (
    <span 
      style={{ 
        ...colorStyle,
        fontSize: size === "large" ? "1.25rem" : "0.8125rem",
        fontWeight: size === "large" ? 600 : 500,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {sign}{formatted}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Month/Year Selector Component
// ─────────────────────────────────────────────────────────────
function MonthYearSelector({ 
  month,
  year, 
  onChange,
  minDate,
  maxDate,
  onTodayClick,
}: { 
  month: number;
  year: number; 
  onChange: (month: number, year: number) => void;
  minDate: { month: number; year: number };
  maxDate: { month: number; year: number };
  onTodayClick: () => void;
}) {
  const canGoPrev = year > minDate.year || (year === minDate.year && month > minDate.month);
  const canGoNext = year < maxDate.year || (year === maxDate.year && month < maxDate.month);
  
  const goPrev = () => {
    if (!canGoPrev) return;
    if (month === 0) {
      onChange(11, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };
  
  const goNext = () => {
    if (!canGoNext) return;
    if (month === 11) {
      onChange(0, year + 1);
    } else {
      onChange(month + 1, year);
    }
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
        onClick={goPrev}
        disabled={!canGoPrev}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-full, 9999px)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          cursor: canGoPrev ? "pointer" : "not-allowed",
          opacity: canGoPrev ? 1 : 0.4,
          transition: "all 150ms ease",
        }}
      >
        <Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text)" }} />
      </button>
      
      <button
        onClick={onTodayClick}
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
          minWidth: 140,
          textAlign: "center",
        }}
        className="hover:bg-[var(--surface-2)]"
        title="Click to go to today"
      >
        {MONTH_NAMES[month]} {year}
      </button>
      
      <button
        onClick={goNext}
        disabled={!canGoNext}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-full, 9999px)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          cursor: canGoNext ? "pointer" : "not-allowed",
          opacity: canGoNext ? 1 : 0.4,
          transition: "all 150ms ease",
        }}
      >
        <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text)" }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Single Month Card (Collapsed View)
// ─────────────────────────────────────────────────────────────
function SingleMonthCard({ 
  data, 
  onExpand 
}: { 
  data: MonthData; 
  onExpand: () => void;
}) {
  const quarterStyle = getQuarterHeaderStyle(data.month);
  
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
      <button
        onClick={onExpand}
        style={{
          width: "100%",
          padding: "12px 16px",
          ...quarterStyle,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "1rem" }}>
          {MONTH_NAMES[data.month]} {data.year}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", opacity: 0.9 }}>
          <span style={{ fontSize: "0.75rem" }}>View All Months</span>
          <Lucide.ChevronRight className="h-4 w-4" />
        </div>
      </button>

      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
              Income
            </span>
            <MoneyValue cents={data.income} colorize size="large" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "right" }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
              Expenses
            </span>
            <MoneyValue cents={-data.expense} colorize size="large" />
          </div>
        </div>

        <div 
          style={{ 
            marginTop: "12px", 
            paddingTop: "12px", 
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            Net
          </span>
          <MoneyValue cents={data.net} colorize size="large" isNet />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Multi-Month View (Expanded - shows 12 or 24 months)
// ─────────────────────────────────────────────────────────────
function MultiMonthView({ 
  monthsData,
  viewMonths,
  onViewChange,
  onCollapse,
}: { 
  monthsData: MonthData[];
  viewMonths: 12 | 24;
  onViewChange: (months: 12 | 24) => void;
  onCollapse: () => void;
}) {
  // Calculate totals for visible months
  const totals = React.useMemo(() => {
    return monthsData.reduce(
      (acc, m) => ({
        income: acc.income + m.income,
        expense: acc.expense + m.expense,
        net: acc.net + m.net,
      }),
      { income: 0, expense: 0, net: 0 }
    );
  }, [monthsData]);

  // Group months into rows of 3
  const monthRows: MonthData[][] = [];
  for (let i = 0; i < monthsData.length; i += 3) {
    monthRows.push(monthsData.slice(i, i + 3));
  }

  // Determine date range label
  const firstMonth = monthsData[0];
  const lastMonth = monthsData[monthsData.length - 1];
  const rangeLabel = firstMonth && lastMonth
    ? `${MONTH_ABBREV[firstMonth.month]} ${firstMonth.year} – ${MONTH_ABBREV[lastMonth.month]} ${lastMonth.year}`
    : "Net Income";

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
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          backgroundColor: "var(--surface-2, var(--surface))",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={onCollapse}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: "var(--text)",
          }}
        >
          <Lucide.ChevronLeft className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
            {rangeLabel}
          </span>
        </button>
        
        {/* View toggle */}
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => onViewChange(12)}
            style={{
              padding: "4px 10px",
              fontSize: "0.75rem",
              fontWeight: viewMonths === 12 ? 600 : 500,
              borderRadius: "var(--radius-sm, 6px)",
              border: "none",
              cursor: "pointer",
              backgroundColor: viewMonths === 12 ? "var(--primary)" : "var(--surface)",
              color: viewMonths === 12 ? "var(--primary-foreground)" : "var(--text-secondary)",
              transition: "all 150ms ease",
            }}
          >
            12 Mo
          </button>
          <button
            onClick={() => onViewChange(24)}
            style={{
              padding: "4px 10px",
              fontSize: "0.75rem",
              fontWeight: viewMonths === 24 ? 600 : 500,
              borderRadius: "var(--radius-sm, 6px)",
              border: "none",
              cursor: "pointer",
              backgroundColor: viewMonths === 24 ? "var(--primary)" : "var(--surface)",
              color: viewMonths === 24 ? "var(--primary-foreground)" : "var(--text-secondary)",
              transition: "all 150ms ease",
            }}
          >
            24 Mo
          </button>
        </div>
      </div>

      {/* Month Grid */}
      <div style={{ padding: "8px", maxHeight: "60vh", overflowY: "auto" }}>
        {monthRows.map((row, rowIndex) => {
          // Determine quarter color based on first month in row
          const firstMonthInRow = row[0];
          const quarterStyle = firstMonthInRow 
            ? QUARTER_HEADER_STYLES[Math.floor(firstMonthInRow.month / 3)]
            : QUARTER_HEADER_STYLES[0];
          
          return (
            <div key={rowIndex} style={{ marginBottom: rowIndex < monthRows.length - 1 ? "8px" : 0 }}>
              {/* Month Headers */}
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                  ...quarterStyle,
                  borderRadius: "6px 6px 0 0",
                }}
              >
                {row.map((m) => (
                  <div
                    key={monthKey(m.year, m.month)}
                    style={{
                      padding: "8px 4px",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                    }}
                  >
                    {MONTH_ABBREV[m.month]} {String(m.year).slice(2)}
                  </div>
                ))}
              </div>

              {/* Income Row */}
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                  backgroundColor: "var(--surface)",
                  borderLeft: "1px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                {row.map((m) => (
                  <div
                    key={`income-${monthKey(m.year, m.month)}`}
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      borderRight: "1px solid var(--border)",
                    }}
                  >
                    <MoneyValue cents={m.income} colorize />
                  </div>
                ))}
              </div>

              {/* Expense Row */}
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                  backgroundColor: "var(--surface)",
                  borderLeft: "1px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                {row.map((m) => (
                  <div
                    key={`expense-${monthKey(m.year, m.month)}`}
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      borderRight: "1px solid var(--border)",
                    }}
                  >
                    <MoneyValue cents={-m.expense} colorize />
                  </div>
                ))}
              </div>

              {/* Net Row */}
              <div 
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                  backgroundColor: "var(--surface-2, var(--surface))",
                  borderLeft: "1px solid var(--border)",
                  borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  borderRadius: "0 0 6px 6px",
                }}
              >
                {row.map((m) => (
                  <div
                    key={`net-${monthKey(m.year, m.month)}`}
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      borderRight: "1px solid var(--border)",
                      fontWeight: 500,
                    }}
                  >
                    <MoneyValue cents={m.net} colorize isNet />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals Footer */}
      <div 
        style={{ 
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--surface-2, var(--surface))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontWeight: 500, color: "var(--text)", fontSize: "0.875rem" }}>
            Total Income ({viewMonths} mo)
          </span>
          <MoneyValue cents={totals.income} colorize />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontWeight: 500, color: "var(--text)", fontSize: "0.875rem" }}>
            Total Expenses ({viewMonths} mo)
          </span>
          <MoneyValue cents={-totals.expense} colorize />
        </div>

        <div 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            paddingTop: "8px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.9375rem" }}>
            Net Income ({viewMonths} mo)
          </span>
          <MoneyValue cents={totals.net} colorize size="large" isNet />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component - Self-contained with data fetching (24 months)
// ─────────────────────────────────────────────────────────────
export interface NetIncomeCalendarProps {
  /** Initial expanded state (for dashboard widget persistence) */
  defaultExpanded?: boolean;
  /** Initial view months (12 or 24) */
  defaultViewMonths?: 12 | 24;
  /** Callback when expanded state changes (for dashboard widget persistence) */
  onExpandedChange?: (expanded: boolean) => void;
  /** Callback when view months changes (for dashboard widget persistence) */
  onViewMonthsChange?: (months: 12 | 24) => void;
}

export function NetIncomeCalendar({
  defaultExpanded = false,
  defaultViewMonths = 12,
  onExpandedChange,
  onViewMonthsChange,
}: NetIncomeCalendarProps = {}) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);
  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [viewMonths, setViewMonths] = React.useState<12 | 24>(defaultViewMonths);

  // Calculate date range for 24 months of data (2 years back from current date)
  const dataStartDate = React.useMemo(() => {
    const d = new Date(currentYear, currentMonth - 23, 1);
    return d.getTime();
  }, [currentYear, currentMonth]);
  
  const dataEndDate = React.useMemo(() => {
    // End of current month
    const d = new Date(currentYear, currentMonth + 1, 1);
    return d.getTime();
  }, [currentYear, currentMonth]);
  
  // Fetch entries for the full 24-month range
  const entries = usePeriodEntries(dataStartDate, dataEndDate);

  // Build a map of all months with data
  const monthDataMap = React.useMemo(() => {
    const map = new Map<string, MonthData>();
    
    if (!entries) return map;
    
    // Aggregate entries by month
    for (const e of entries) {
      if (!countsInCashflow(e)) continue;
      if (e.type === "transfer") continue;
      
      const d = new Date(e.date);
      const month = d.getMonth();
      const year = d.getFullYear();
      const key = monthKey(year, month);
      
      if (!map.has(key)) {
        map.set(key, { month, year, income: 0, expense: 0, net: 0 });
      }
      
      const data = map.get(key)!;
      if (e.type === "income") {
        data.income += reportingAmount(e);
      } else if (e.type === "expense") {
        data.expense += reportingAmount(e);
      }
    }
    
    // Calculate net for each month
    for (const data of map.values()) {
      data.net = data.income - data.expense;
    }
    
    return map;
  }, [entries]);

  // Get data for a specific month (or create empty)
  const getMonthData = React.useCallback((year: number, month: number): MonthData => {
    const key = monthKey(year, month);
    return monthDataMap.get(key) ?? { month, year, income: 0, expense: 0, net: 0 };
  }, [monthDataMap]);

  // Get the currently selected month's data
  const selectedMonthData = React.useMemo(() => {
    return getMonthData(selectedYear, selectedMonth);
  }, [getMonthData, selectedYear, selectedMonth]);

  // Generate array of months for expanded view (12 or 24 months ending at selected month)
  const expandedMonthsData = React.useMemo(() => {
    const months: MonthData[] = [];
    let y = selectedYear;
    let m = selectedMonth;
    
    // Go back (viewMonths - 1) months, then build forward
    for (let i = 0; i < viewMonths - 1; i++) {
      m--;
      if (m < 0) {
        m = 11;
        y--;
      }
    }
    
    // Now build the array from start to selected month
    for (let i = 0; i < viewMonths; i++) {
      months.push(getMonthData(y, m));
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    
    return months;
  }, [getMonthData, selectedYear, selectedMonth, viewMonths]);

  // Date boundaries for navigation (24 months back to current)
  const minDate = React.useMemo(() => {
    let m = currentMonth - 23;
    let y = currentYear;
    while (m < 0) {
      m += 12;
      y--;
    }
    return { month: m, year: y };
  }, [currentMonth, currentYear]);
  
  const maxDate = React.useMemo(() => {
    return { month: currentMonth, year: currentYear };
  }, [currentMonth, currentYear]);

  // Go to today
  const goToToday = () => {
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}>
      {/* Month/Year Selector */}
      <MonthYearSelector
        month={selectedMonth}
        year={selectedYear}
        onChange={(m, y) => {
          setSelectedMonth(m);
          setSelectedYear(y);
        }}
        minDate={minDate}
        maxDate={maxDate}
        onTodayClick={goToToday}
      />
      
      {/* Calendar View */}
      {isExpanded ? (
        <MultiMonthView
          monthsData={expandedMonthsData}
          viewMonths={viewMonths}
          onViewChange={(months) => {
            setViewMonths(months);
            onViewMonthsChange?.(months);
          }}
          onCollapse={() => {
            setIsExpanded(false);
            onExpandedChange?.(false);
          }}
        />
      ) : (
        <SingleMonthCard
          data={selectedMonthData}
          onExpand={() => {
            setIsExpanded(true);
            onExpandedChange?.(true);
          }}
        />
      )}
    </div>
  );
}

export default NetIncomeCalendar;
