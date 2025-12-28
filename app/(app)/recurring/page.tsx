"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { useTabs } from "@/components/PersistentTabs";

export default function RecurringPage() {
  const { setActiveTab } = useTabs();
  const rules = useQuery((api as any).recurring.listRecurringRules as any) as any[] | undefined;

  return (
    <div>
      <PageHeader
        title="Patterns"
        subtitle="Saved patterns you've confirmed"
      />

      {!rules ? (
        <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Lucide.Repeat className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="No patterns yet"
          subtitle="Create patterns from your transactions to track recurring expenses and income automatically."
          action={
            <button
              onClick={() => setActiveTab("activity")}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
            >
              View Transactions
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: r.type === "income" ? "var(--success-subtle)" : "var(--surface-2)" }}
                >
                  <Lucide.Repeat className="h-5 w-5" style={{ color: r.type === "income" ? "var(--success)" : "var(--text-tertiary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {r.displayName ?? r.name ?? r.category ?? "Unnamed"}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {r.cadenceType ?? r.intervalType ?? "Monthly"} · {r.autolinkEnabled ? "Auto-applied" : "Manual"}
                  </div>
                </div>
                {r.amountCents && (
                  <div className="text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
                    ${(r.amountCents / 100).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
