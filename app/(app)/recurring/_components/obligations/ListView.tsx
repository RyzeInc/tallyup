"use client";

import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";
import type { EnrichedCharge } from "./types";
import { getStatusColor, getStatusLabel, formatDueDate, groupChargesByDate } from "./types";
import QuickActions from "./QuickActions";
import EmptyState from "@/components/ui/EmptyState";

interface ListViewProps {
  charges: EnrichedCharge[];
  isLoading?: boolean;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
  onRowClick?: (charge: EnrichedCharge) => void;
}

export default function ListView({
  charges,
  isLoading,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  onRowClick,
}: ListViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--surface)" }}
          />
        ))}
      </div>
    );
  }

  if (!charges.length) {
    return (
      <EmptyState
        icon={<Lucide.CalendarCheck className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No obligations found"
        subtitle="Obligations matching your filters will appear here."
        compact
      />
    );
  }

  const grouped = groupChargesByDate(charges);
  const sections = [
    { key: "overdue", label: "Overdue", items: grouped.overdue, color: "var(--error)" },
    { key: "today", label: "Today", items: grouped.today, color: "var(--primary)" },
    { key: "thisWeek", label: "This week", items: grouped.thisWeek, color: "var(--text)" },
    { key: "nextTwoWeeks", label: "Next 2 weeks", items: grouped.nextTwoWeeks, color: "var(--text-secondary)" },
    { key: "later", label: "Later", items: grouped.later, color: "var(--text-tertiary)" },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key}>
          {/* Section header */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: section.color }}
            >
              {section.label}
            </div>
            <div
              className="px-1.5 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-tertiary)" }}
            >
              {section.items.length}
            </div>
          </div>

          {/* Desktop table view */}
          <div
            className="hidden md:block rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--surface-2)" }}>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-tertiary)", width: "32px" }}>
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-tertiary)", width: "120px" }}>
                    Due
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: "var(--text-tertiary)", width: "100px" }}>
                    Amount
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-tertiary)", width: "160px" }}>
                    Account
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-tertiary)", width: "48px" }}>
                    
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((charge) => (
                  <ListRowDesktop
                    key={charge._id}
                    charge={charge}
                    onLogNow={onLogNow}
                    onLinkExisting={onLinkExisting}
                    onSkip={onSkip}
                    onMoveDate={onMoveDate}
                    onViewRule={onViewRule}
                    onClick={onRowClick}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list view */}
          <div className="md:hidden space-y-2">
            {section.items.map((charge) => (
              <ListRowMobile
                key={charge._id}
                charge={charge}
                onLogNow={onLogNow}
                onLinkExisting={onLinkExisting}
                onSkip={onSkip}
                onMoveDate={onMoveDate}
                onViewRule={onViewRule}
                onClick={onRowClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListRowDesktop({
  charge,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  onClick,
}: {
  charge: EnrichedCharge;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
  onClick?: (charge: EnrichedCharge) => void;
}) {
  const due = formatDueDate(charge.expectedDate);

  return (
    <tr
      onClick={() => onClick?.(charge)}
      className="border-t transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Status */}
      <td className="px-4 py-3">
        <StatusDot state={charge.state} />
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <CategoryIcon category={charge.category} />
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {charge.name}
            </div>
            {charge.category && (
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {charge.category}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Due */}
      <td className="px-4 py-3">
        <div className="text-sm" style={{ color: "var(--text)" }}>
          {due.short}
        </div>
        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {due.weekday} • {due.day}
        </div>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right">
        <div className="text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
          {charge.amountCents ? formatMoney(charge.amountCents) : "Varies"}
        </div>
        {charge.amountMode === "variable" && (
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Variable
          </div>
        )}
      </td>

      {/* Account */}
      <td className="px-4 py-3">
        <div className="text-sm" style={{ color: "var(--text)" }}>
          {charge.institutionName ?? charge.accountName ?? "—"}
        </div>
        {charge.accountLast4 && (
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            ••{charge.accountLast4}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <QuickActions
          charge={charge}
          onLogNow={onLogNow}
          onLinkExisting={onLinkExisting}
          onSkip={onSkip}
          onMoveDate={onMoveDate}
          onViewRule={onViewRule}
        />
      </td>
    </tr>
  );
}

function ListRowMobile({
  charge,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  onClick,
}: {
  charge: EnrichedCharge;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
  onClick?: (charge: EnrichedCharge) => void;
}) {
  const due = formatDueDate(charge.expectedDate);
  const statusColor = getStatusColor(charge.state);
  // statusColor used below for status dot

  return (
    <div
      onClick={() => onClick?.(charge)}
      className="rounded-xl border p-3 transition-colors active:bg-[var(--surface-2)] cursor-pointer relative"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-3">
        {/* Icon + Status */}
        <div className="relative flex-shrink-0">
          <CategoryIcon category={charge.category} size="lg" />
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ backgroundColor: statusColor, borderColor: "var(--surface)" }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Name — Amount */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
              {charge.name}
            </div>
            <div className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--text)" }}>
              {charge.amountCents ? formatMoney(charge.amountCents) : "Varies"}
            </div>
          </div>

          {/* Line 2: Due • Institution • Status */}
          <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <span>{due.short}</span>
            <span>•</span>
            <span className="truncate">{charge.institutionName ?? charge.accountName ?? "No account"}</span>
            <span>•</span>
            <span
              className="px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {getStatusLabel(charge.state)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          <QuickActions
            charge={charge}
            onLogNow={onLogNow}
            onLinkExisting={onLinkExisting}
            onSkip={onSkip}
            onMoveDate={onMoveDate}
            onViewRule={onViewRule}
          />
        </div>
      </div>
    </div>
  );
}

function StatusDot({ state }: { state: EnrichedCharge["state"] }) {
  const color = getStatusColor(state);
  const Icon =
    state === "matched"
      ? Lucide.CheckCircle2
      : state === "due"
      ? Lucide.Clock
      : state === "missed"
      ? Lucide.AlertTriangle
      : state === "skipped"
      ? Lucide.SkipForward
      : Lucide.Circle;

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{ backgroundColor: `${color}15` }}
    >
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
  );
}

function CategoryIcon({ category, size = "md" }: { category?: string; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const iconSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Housing: Lucide.Home,
    Utilities: Lucide.Zap,
    Insurance: Lucide.Shield,
    Subscriptions: Lucide.RefreshCw,
    Transportation: Lucide.Car,
    Food: Lucide.UtensilsCrossed,
    Health: Lucide.Heart,
    Entertainment: Lucide.Film,
    Education: Lucide.GraduationCap,
    Debt: Lucide.CreditCard,
  };

  const Icon = (category && icons[category]) || Lucide.Receipt;

  return (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center`}
      style={{ backgroundColor: "var(--surface-2)" }}
    >
      <Icon className={iconSize} style={{ color: "var(--text-tertiary)" }} />
    </div>
  );
}
