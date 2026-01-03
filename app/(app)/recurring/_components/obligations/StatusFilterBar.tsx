"use client";

import * as Lucide from "lucide-react";
import { useState } from "react";

export type StatusFilter = "all" | "due" | "upcoming" | "matched" | "missed" | "needs_review";
export type RangePreset = "7d" | "30d" | "60d" | "90d";

interface StatusFilterBarProps {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  range: RangePreset;
  onRangeChange: (range: RangePreset) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts?: {
    all: number;
    due: number;
    upcoming: number;
    matched: number;
    missed: number;
    needs_review: number;
  };
}

const STATUS_OPTIONS: Array<{ id: StatusFilter; label: string; color?: string }> = [
  { id: "all", label: "All" },
  { id: "due", label: "Due", color: "var(--warning)" },
  { id: "upcoming", label: "Upcoming" },
  { id: "matched", label: "Logged", color: "var(--success)" },
  { id: "missed", label: "Missed", color: "var(--error)" },
  { id: "needs_review", label: "Needs review", color: "var(--warning)" },
];

const RANGE_OPTIONS: Array<{ id: RangePreset; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "60d", label: "60 days" },
  { id: "90d", label: "90 days" },
];

export default function StatusFilterBar({
  status,
  onStatusChange,
  range,
  onRangeChange,
  searchQuery,
  onSearchChange,
  counts,
}: StatusFilterBarProps) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Main filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status pills */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = status === opt.id;
            const count = counts?.[opt.id];
            return (
              <button
                key={opt.id}
                onClick={() => onStatusChange(opt.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  backgroundColor: isActive
                    ? opt.color
                      ? opt.color
                      : "var(--primary)"
                    : "var(--surface-2)",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                }}
              >
                {opt.label}
                {count !== undefined && count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "var(--surface)",
                      color: isActive ? "#fff" : "var(--text-tertiary)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Range selector */}
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as RangePreset)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium outline-none cursor-pointer"
          style={{
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Search toggle */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: showSearch ? "var(--primary)" : "var(--surface-2)",
            color: showSearch ? "#fff" : "var(--text-secondary)",
          }}
        >
          <Lucide.Search className="h-4 w-4" />
        </button>
      </div>

      {/* Search bar (conditional) */}
      {showSearch && (
        <div className="relative">
          <Lucide.Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--text-tertiary)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search obligations..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--surface)]"
            >
              <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
