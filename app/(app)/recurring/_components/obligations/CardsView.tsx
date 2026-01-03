"use client";

import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";
import type { EnrichedCharge } from "./types";
import { getStatusColor, getStatusLabel, formatDueDate, groupChargesByDate, groupChargesByCategory } from "./types";
import QuickActions from "./QuickActions";
import EmptyState from "@/components/ui/EmptyState";
import { useState } from "react";

type GroupBy = "date" | "category";

interface CardsViewProps {
  charges: EnrichedCharge[];
  isLoading?: boolean;
  onLogNow: (charge: EnrichedCharge) => void;
  onLinkExisting: (charge: EnrichedCharge) => void;
  onSkip: (charge: EnrichedCharge) => void;
  onMoveDate: (charge: EnrichedCharge) => void;
  onViewRule: (charge: EnrichedCharge) => void;
  onCardClick?: (charge: EnrichedCharge) => void;
}

export default function CardsView({
  charges,
  isLoading,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  onCardClick,
}: CardsViewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("date");

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--surface)" }}
          />
        ))}
      </div>
    );
  }

  if (!charges.length) {
    return (
      <EmptyState
        icon={<Lucide.LayoutGrid className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No obligations found"
        subtitle="Obligations matching your filters will appear here."
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Group toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Group by:</span>
        <button
          onClick={() => setGroupBy("date")}
          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: groupBy === "date" ? "var(--primary)" : "var(--surface-2)",
            color: groupBy === "date" ? "#fff" : "var(--text-secondary)",
          }}
        >
          Date
        </button>
        <button
          onClick={() => setGroupBy("category")}
          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: groupBy === "category" ? "var(--primary)" : "var(--surface-2)",
            color: groupBy === "category" ? "#fff" : "var(--text-secondary)",
          }}
        >
          Category
        </button>
      </div>

      {/* Cards grid */}
      {groupBy === "date" ? (
        <DateGroupedCards
          charges={charges}
          onLogNow={onLogNow}
          onLinkExisting={onLinkExisting}
          onSkip={onSkip}
          onMoveDate={onMoveDate}
          onViewRule={onViewRule}
          onCardClick={onCardClick}
        />
      ) : (
        <CategoryGroupedCards
          charges={charges}
          onLogNow={onLogNow}
          onLinkExisting={onLinkExisting}
          onSkip={onSkip}
          onMoveDate={onMoveDate}
          onViewRule={onViewRule}
          onCardClick={onCardClick}
        />
      )}
    </div>
  );
}

function DateGroupedCards({
  charges,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  onCardClick,
}: Omit<CardsViewProps, "isLoading">) {
  const grouped = groupChargesByDate(charges);
  const sections = [
    { key: "overdue", label: "Overdue", items: grouped.overdue, color: "var(--error)" },
    { key: "today", label: "Today", items: grouped.today, color: "var(--primary)" },
    { key: "thisWeek", label: "This week", items: grouped.thisWeek, color: "var(--text)" },
    { key: "nextTwoWeeks", label: "Next 2 weeks", items: grouped.nextTwoWeeks, color: "var(--text-secondary)" },
    { key: "later", label: "Later", items: grouped.later, color: "var(--text-tertiary)" },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="text-sm font-semibold"
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {section.items.map((charge) => (
              <ObligationCard
                key={charge._id}
                charge={charge}
                onLogNow={onLogNow}
                onLinkExisting={onLinkExisting}
                onSkip={onSkip}
                onMoveDate={onMoveDate}
                onViewRule={onViewRule}
                onClick={onCardClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryGroupedCards({
  charges,
  onLogNow,
  onLinkExisting,
  onSkip,
  onMoveDate,
  onViewRule,
  onCardClick,
}: Omit<CardsViewProps, "isLoading">) {
  const grouped = groupChargesByCategory(charges);
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {sortedCategories.map((category) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-3">
            <CategoryBadge category={category} />
            <div
              className="px-1.5 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-tertiary)" }}
            >
              {grouped[category].length}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {grouped[category].map((charge) => (
              <ObligationCard
                key={charge._id}
                charge={charge}
                onLogNow={onLogNow}
                onLinkExisting={onLinkExisting}
                onSkip={onSkip}
                onMoveDate={onMoveDate}
                onViewRule={onViewRule}
                onClick={onCardClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ObligationCard({
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
  const Icon = (charge.category && icons[charge.category]) || Lucide.Receipt;

  return (
    <div
      onClick={() => onClick?.(charge)}
      className="rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer relative group"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header row: Icon + Status */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <Icon className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: statusColor }}
            title={getStatusLabel(charge.state)}
          />
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Name */}
      <div className="text-sm font-medium truncate mb-1" style={{ color: "var(--text)" }}>
        {charge.name}
      </div>

      {/* Due date */}
      <div className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
        {due.weekday} • {due.day}
      </div>

      {/* Amount (big) */}
      <div className="text-xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
        {charge.amountCents ? formatMoney(charge.amountCents) : "Varies"}
      </div>

      {/* Footer: Institution */}
      <div className="text-xs mt-2 truncate" style={{ color: "var(--text-tertiary)" }}>
        {charge.institutionName ?? charge.accountName ?? "No account"}
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
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
    Uncategorized: Lucide.HelpCircle,
  };
  const Icon = icons[category] || Lucide.Tag;

  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: "var(--text-secondary)" }}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {category}
      </span>
    </div>
  );
}
