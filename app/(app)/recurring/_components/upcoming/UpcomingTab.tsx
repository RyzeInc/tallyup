"use client";

import type { Doc } from "convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";

type ExpectedCharge = Doc<"expectedCharges">;

export default function UpcomingTab({
  expectedCharges,
}: {
  expectedCharges: ExpectedCharge[] | undefined;
}) {
  if (!expectedCharges) {
    return <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>;
  }

  if (expectedCharges.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.CalendarClock className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No upcoming charges"
        subtitle="Upcoming expected charges will appear here once rules are active."
      />
    );
  }

  return (
    <div className="space-y-2">
      {expectedCharges.map((charge) => (
        <div
          key={charge._id}
          className="rounded-xl border p-3 flex items-center justify-between"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Expected charge
            </div>
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {new Date(charge.expectedDate).toLocaleDateString()}
            </div>
          </div>
          <div className="text-xs font-medium capitalize" style={{ color: "var(--text-secondary)" }}>
            {charge.state}
          </div>
        </div>
      ))}
    </div>
  );
}
