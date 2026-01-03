"use client";

import type { Doc } from "convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";

type Rule = Doc<"recurringRules">;
type ExpectedCharge = Doc<"expectedCharges">;

export default function InsightsTab({
  rules,
  expectedCharges,
}: {
  rules: Rule[] | undefined;
  expectedCharges: ExpectedCharge[] | undefined;
}) {
  if (!rules || !expectedCharges) {
    return <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>;
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.LineChart className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="Insights need data"
        subtitle="Create a recurring rule to start seeing trends."
      />
    );
  }

  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Insights coming online
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
        {rules.length} rules • {expectedCharges.length} expected charges in range
      </div>
    </div>
  );
}
