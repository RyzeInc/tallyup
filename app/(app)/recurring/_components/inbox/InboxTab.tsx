"use client";

import type { Doc } from "convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";

type InboxItem = Doc<"recurringInbox">;

export default function InboxTab({ inboxItems }: { inboxItems: InboxItem[] | undefined }) {
  if (!inboxItems) {
    return <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>;
  }

  if (inboxItems.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.CheckCircle2 className="h-7 w-7" style={{ color: "var(--success)" }} />}
        title="All caught up"
        subtitle="No recurring decisions need your attention."
      />
    );
  }

  return (
    <div className="space-y-2">
      {inboxItems.map((item) => (
        <div
          key={item._id}
          className="rounded-xl border p-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {labelForType(item.type)}
            </div>
            <div className="text-xs capitalize" style={{ color: "var(--text-tertiary)" }}>
              {item.status}
            </div>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Created {new Date(item.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function labelForType(type: string): string {
  switch (type) {
    case "confirm_match":
      return "Confirm recurring link";
    case "price_changed":
      return "Price changed";
    case "missed_payment":
      return "Missed payment";
    case "cadence_drift":
      return "Cadence drift";
    case "needs_details":
      return "Needs details";
    default:
      return "Recurring inbox";
  }
}
