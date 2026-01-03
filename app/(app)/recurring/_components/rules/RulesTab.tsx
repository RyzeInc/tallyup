"use client";

import type { Doc } from "convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";

type Rule = Doc<"recurringRules">;
type ExpectedCharge = Doc<"expectedCharges">;

export default function RulesTab({
  rules,
  expectedCharges,
  onCreate,
  onEdit,
}: {
  rules: Rule[] | undefined;
  expectedCharges: ExpectedCharge[] | undefined;
  onCreate: () => void;
  onEdit: (ruleId: string) => void;
}) {
  if (!rules) {
    return <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>;
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.Repeat className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No recurring rules"
        subtitle="Create a recurring rule from a transaction to track it."
        action={
          <button
            onClick={onCreate}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            New recurring rule
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Recurring rules
        </div>
        <button
          onClick={onCreate}
          className="text-xs font-medium px-2 py-1 rounded-lg"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
        >
          New
        </button>
      </div>
      {rules.map((rule) => (
        <div
          key={rule._id}
          className="rounded-xl border p-3 flex items-center justify-between"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {rule.displayName ?? rule.name ?? rule.category ?? "Recurring rule"}
            </div>
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {cadenceDetail(rule)}
              {nextDueLabel(rule, expectedCharges) ? ` · Next: ${nextDueLabel(rule, expectedCharges)}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {amountLabel(rule) && (
              <div className="text-xs font-medium tabular-nums" style={{ color: "var(--text)" }}>
                {amountLabel(rule)}
              </div>
            )}
            <button
              onClick={() => onEdit(rule._id)}
              className="px-2 py-1 rounded-lg text-xs"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            >
              Edit
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function amountLabel(rule: Rule): string | null {
  const cents = rule.amountPolicy?.amountCents ?? rule.amountCents;
  if (!cents) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function cadenceDetail(rule: Rule): string {
  const cadence = rule.cadence?.kind ?? rule.cadenceType ?? rule.intervalType ?? "monthly";
  const anchor = rule.cadence?.anchorDate
    ? new Date(rule.cadence.anchorDate)
    : rule.cadenceAnchor
    ? new Date(rule.cadenceAnchor)
    : null;
  if (!anchor || Number.isNaN(anchor.getTime())) {
    return `${cadence} (start date needed)`;
  }
  if (cadence === "weekly" || cadence === "biweekly") {
    const weekday = anchor.toLocaleDateString(undefined, { weekday: "long" });
    return `${cadence} · ${weekday}`;
  }
  if (cadence === "yearly") {
    const md = anchor.toLocaleDateString(undefined, { month: "long", day: "numeric" });
    return `${cadence} · ${md}`;
  }
  return `${cadence} · Day ${anchor.getDate()}`;
}

function nextDueLabel(rule: Rule, expectedCharges?: ExpectedCharge[]): string | null {
  if (!expectedCharges?.length) return null;
  const candidates = expectedCharges.filter((c) => c.ruleId === rule._id && (c.state === "upcoming" || c.state === "due"));
  if (!candidates.length) return null;
  const next = candidates.sort((a, b) => a.expectedDate - b.expectedDate)[0];
  return new Date(next.expectedDate).toLocaleDateString();
}
