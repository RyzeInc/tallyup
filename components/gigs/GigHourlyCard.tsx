"use client";

import * as Lucide from "lucide-react";
import { centsToDollars } from "@/components/utils";
import { InfoTip, COMMON_TIPS } from "@/components/help/InfoTip";

/**
 * GigHourlyCard - Displays aggregated hourly rates by gig platform group
 * 
 * Shows earnings, hours, and effective hourly rate for rideshare, delivery,
 * freelance, and other gig work categories.
 */

interface GigGroupSummary {
  group: string;
  platforms: string[];
  earningsCents: number;
  hours: number;
  entries: number;
  hourlyRateCents: number;
}

interface GigHourlySummary {
  hasData: boolean;
  groups: GigGroupSummary[];
  totals: {
    totalEarningsCents: number;
    totalHours: number;
    averageHourlyRateCents: number;
  };
}

interface GigHourlyCardProps {
  data: GigHourlySummary | null | undefined;
  isLoading?: boolean;
}

// Icons and labels for gig groups
const GIG_GROUP_CONFIG: Record<string, { 
  label: string; 
  icon: keyof typeof Lucide;
  color: string;
}> = {
  rideshare: { label: "Rideshare", icon: "Car", color: "var(--accent)" },
  delivery: { label: "Delivery", icon: "Package", color: "var(--success)" },
  freelance: { label: "Freelance", icon: "Briefcase", color: "var(--chart-3)" },
  rental: { label: "Rental", icon: "Home", color: "var(--chart-4)" },
  other: { label: "Other", icon: "Wallet", color: "var(--chart-5)" },
};

function getGroupConfig(group: string) {
  return GIG_GROUP_CONFIG[group] || GIG_GROUP_CONFIG.other;
}

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHourlyRate(cents: number): string {
  return `${centsToDollars(cents)}/hr`;
}

function formatDollars(cents: number): string {
  const abs = Math.abs(cents);
  const val = (abs / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${val}`;
}

export function GigHourlyCard({ data, isLoading }: GigHourlyCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="h-6 w-32 rounded animate-pulse"
            style={{ backgroundColor: "var(--surface-subtle)" }}
          />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ backgroundColor: "var(--surface-subtle)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lucide.Clock
              className="w-5 h-5"
              style={{ color: "var(--text-tertiary)" }}
            />
            <h3 className="font-medium" style={{ color: "var(--text)" }}>
              Gig Hourly Rates
            </h3>
            <InfoTip {...COMMON_TIPS.hourlyRate} size={14} />
          </div>
        </div>
        <p
          className="text-sm text-center py-6"
          style={{ color: "var(--text-tertiary)" }}
        >
          No gig work with hours tracked yet.
          <br />
          <span className="text-xs">
            Add hours when logging gig income to see your effective hourly rate.
          </span>
        </p>
      </div>
    );
  }

  const { groups, totals } = data;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lucide.Clock
            className="w-5 h-5"
            style={{ color: "var(--accent)" }}
          />
          <h3 className="font-medium" style={{ color: "var(--text)" }}>
            Gig Hourly Rates
          </h3>
          <InfoTip {...COMMON_TIPS.hourlyRate} size={14} />
        </div>
        <div className="text-right">
          <p
            className="text-lg font-semibold"
            style={{ color: "var(--accent)" }}
          >
            {formatHourlyRate(totals.averageHourlyRateCents)}
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            avg across all
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div
        className="grid grid-cols-2 gap-4 mb-4 py-3 px-3 rounded-xl"
        style={{ backgroundColor: "var(--surface-subtle)" }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Total Earned
          </p>
          <p className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {formatDollars(totals.totalEarningsCents)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Total Hours
          </p>
          <p className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {formatHours(totals.totalHours)}
          </p>
        </div>
      </div>

      {/* Group breakdown */}
      <div className="space-y-3">
        {groups.map((group) => {
          const config = getGroupConfig(group.group);
          const Icon = Lucide[config.icon] as React.ComponentType<{
            className?: string;
            style?: React.CSSProperties;
          }>;

          return (
            <div
              key={group.group}
              className="flex items-center gap-3 py-3 px-3 rounded-xl"
              style={{ backgroundColor: "var(--surface-subtle)" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium" style={{ color: "var(--text)" }}>
                  {config.label}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                  {group.platforms.join(", ")} • {group.entries} trips
                </p>
              </div>
              <div className="text-right">
                <p
                  className="font-semibold"
                  style={{ color: config.color }}
                >
                  {formatHourlyRate(group.hourlyRateCents)}
                </p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {formatHours(group.hours)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GigHourlyCard;
