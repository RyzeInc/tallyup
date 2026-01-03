"use client";

import { useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";
import type { EnrichedCharge } from "./types";
import { getStatusColor, getStatusLabel } from "./types";
import EmptyState from "@/components/ui/EmptyState";

interface CalendarViewProps {
  charges: EnrichedCharge[];
  isLoading?: boolean;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
}

export default function CalendarView({
  charges,
  isLoading,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { days, chargesByDay } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Next month days to fill grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Group charges by day
    const byDay = new Map<string, EnrichedCharge[]>();
    for (const charge of charges) {
      const d = new Date(charge.expectedDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(charge);
    }

    return { days, chargesByDay: byDay };
  }, [currentMonth, charges]);

  const selectedCharges = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return chargesByDay.get(key) ?? [];
  }, [selectedDate, chargesByDay]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4 animate-pulse"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="h-64" />
      </div>
    );
  }

  if (!charges.length) {
    return (
      <EmptyState
        icon={<Lucide.Calendar className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No obligations found"
        subtitle="Obligations matching your filters will appear here."
        compact
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Calendar grid */}
      <div
        className="flex-1 rounded-xl border overflow-hidden"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Month navigation */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          >
            <Lucide.ChevronLeft className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          >
            <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-xs font-medium text-center py-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map(({ date, isCurrentMonth }, i) => {
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const dayCharges = chargesByDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected =
              selectedDate &&
              date.getFullYear() === selectedDate.getFullYear() &&
              date.getMonth() === selectedDate.getMonth() &&
              date.getDate() === selectedDate.getDate();

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`min-h-[80px] md:min-h-[100px] p-1.5 border-b border-r text-left transition-colors ${
                  isCurrentMonth ? "" : "opacity-40"
                } ${isSelected ? "ring-2 ring-[var(--primary)] ring-inset" : ""}`}
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: isToday ? "var(--primary-subtle)" : undefined,
                }}
              >
                {/* Day number */}
                <div
                  className={`text-xs font-medium mb-1 ${
                    isToday ? "text-[var(--primary)] font-bold" : ""
                  }`}
                  style={{ color: isToday ? "var(--primary)" : "var(--text-secondary)" }}
                >
                  {date.getDate()}
                </div>

                {/* Charge chips */}
                <div className="space-y-0.5">
                  {dayCharges.slice(0, 2).map((charge) => (
                    <CalendarChip key={charge._id} charge={charge} />
                  ))}
                  {dayCharges.length > 2 && (
                    <div
                      className="text-[10px] font-medium px-1.5 py-0.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      +{dayCharges.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day sheet (side panel) */}
      {selectedDate && (
        <DaySheet
          date={selectedDate}
          charges={selectedCharges}
          onClose={() => setSelectedDate(null)}
          onLogNow={onLogNow}
          onLinkExisting={onLinkExisting}
          onSkip={onSkip}
          onMoveDate={onMoveDate}
          onViewRule={onViewRule}
        />
      )}
    </div>
  );
}

function CalendarChip({ charge }: { charge: EnrichedCharge }) {
  const statusColor = getStatusColor(charge.state);
  const isLogged = charge.state === "matched";

  return (
    <div
      className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate flex items-center gap-1"
      style={{
        backgroundColor: `${statusColor}15`,
        color: statusColor,
      }}
    >
      {isLogged && <Lucide.Check className="h-2.5 w-2.5 flex-shrink-0" />}
      <span className="truncate">{charge.name}</span>
      {charge.amountCents && (
        <span className="flex-shrink-0 tabular-nums">
          {formatMoney(charge.amountCents, { compact: true })}
        </span>
      )}
    </div>
  );
}

function DaySheet({
  date,
  charges,
  onClose,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
}: {
  date: Date;
  charges: EnrichedCharge[];
  onClose: () => void;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
}) {
  return (
    <div
      className="lg:w-80 rounded-xl border"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {date.toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
        >
          <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {charges.length === 0 ? (
          <div className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>
            No obligations on this day
          </div>
        ) : (
          charges.map((charge) => (
            <DaySheetItem
              key={charge._id}
              charge={charge}
              onLogNow={onLogNow}
              onLinkExisting={onLinkExisting}
              onSkip={onSkip}
              onMoveDate={onMoveDate}
              onViewRule={onViewRule}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DaySheetItem({
  charge,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
}: {
  charge: EnrichedCharge;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
}) {
  const statusColor = getStatusColor(charge.state);
  void onMoveDate; // Reserved for future "Move date" feature

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
            {charge.name}
          </div>
          <div
            className="text-xs flex items-center gap-1 mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {getStatusLabel(charge.state)}
            </span>
            {charge.category && <span>• {charge.category}</span>}
          </div>
        </div>
        <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
          {charge.amountCents ? formatMoney(charge.amountCents) : "Varies"}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        {charge.state !== "matched" && (
          <>
            <button
              onClick={() => onLogNow(charge)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--primary)", color: "#fff" }}
            >
              <Lucide.Plus className="h-3 w-3" />
              Log
            </button>
            <button
              onClick={() => onLinkExisting(charge)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <Lucide.Link className="h-3 w-3" />
              Link
            </button>
          </>
        )}
        <button
          onClick={() => onSkip(charge)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          title="Skip"
          disabled={charge.state === "matched" || charge.state === "skipped"}
        >
          <Lucide.SkipForward className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
        </button>
        <button
          onClick={() => onViewRule(charge)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          title="View rule"
        >
          <Lucide.Settings2 className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>
    </div>
  );
}
