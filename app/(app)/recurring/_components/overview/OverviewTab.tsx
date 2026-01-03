"use client";

import type { Doc } from "convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";

type Rule = Doc<"recurringRules">;
type ExpectedCharge = Doc<"expectedCharges">;
type InboxItem = Doc<"recurringInbox">;

export default function OverviewTab({
  rules,
  expectedCharges,
  inboxItems,
}: {
  rules: Rule[] | undefined;
  expectedCharges: ExpectedCharge[] | undefined;
  inboxItems: InboxItem[] | undefined;
}) {
  const activeRules = (rules ?? []).filter(r => (r.status ?? "active") === "active");
  const dueSoon = (expectedCharges ?? []).filter(e => e.state === "due").length;
  const missed = (expectedCharges ?? []).filter(e => e.state === "missed").length;
  const inboxOpen = inboxItems?.length ?? 0;

  if (!rules) {
    return <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>;
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.Repeat className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No recurring rules yet"
        subtitle="Create a recurring rule from a transaction to get started."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Active rules" value={activeRules.length} icon={Lucide.Repeat} />
      <SummaryCard title="Due soon" value={dueSoon} icon={Lucide.CalendarClock} />
      <SummaryCard title="Missed" value={missed} icon={Lucide.AlertTriangle} />
      <SummaryCard title="Inbox" value={inboxOpen} icon={Lucide.Inbox} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-3"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--surface-2)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
      </div>
      <div>
        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{title}</div>
        <div className="text-base font-semibold" style={{ color: "var(--text)" }}>{value}</div>
      </div>
    </div>
  );
}
