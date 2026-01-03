"use client";

import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type InboxItem = Doc<"recurringInbox">;
type Rule = Doc<"recurringRules">;

interface InboxTabRedesignedProps {
  inboxItems: InboxItem[] | undefined;
  rules: Rule[] | undefined;
  onViewRule: (ruleId: string) => void;
}

export default function InboxTabRedesigned({ inboxItems, rules, onViewRule }: InboxTabRedesignedProps) {
  const toast = useToast();
  const resolveInbox = useMutation(api.recurring.resolveRecurringInbox);
  const dismissInbox = useMutation(api.recurring.dismissRecurringInbox);

  if (!inboxItems) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--surface)" }}
          />
        ))}
      </div>
    );
  }

  if (inboxItems.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.CheckCircle2 className="h-7 w-7" style={{ color: "var(--success)" }} />}
        title="All caught up!"
        subtitle="No recurring decisions need your attention right now."
      />
    );
  }

  const handleResolve = async (item: InboxItem, resolution?: Record<string, unknown>) => {
    try {
      await resolveInbox({ id: item._id, resolution });
      toast.success("Resolved");
    } catch {
      toast.error("Failed to resolve");
    }
  };

  const handleDismiss = async (item: InboxItem) => {
    try {
      await dismissInbox({ id: item._id });
      toast.success("Dismissed");
    } catch {
      toast.error("Failed to dismiss");
    }
  };

  // Group by type
  const grouped = {
    confirm_match: inboxItems.filter((i) => i.type === "confirm_match"),
    missed_payment: inboxItems.filter((i) => i.type === "missed_payment"),
    price_changed: inboxItems.filter((i) => i.type === "price_changed"),
    cadence_drift: inboxItems.filter((i) => i.type === "cadence_drift"),
    needs_details: inboxItems.filter((i) => i.type === "needs_details"),
  };

  return (
    <div className="space-y-4">
      {grouped.missed_payment.length > 0 && (
        <InboxSection
          title="Missed payments"
          subtitle="These expected charges weren't logged"
          color="var(--error)"
          icon={Lucide.AlertTriangle}
          items={grouped.missed_payment}
          rules={rules}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onViewRule={onViewRule}
        />
      )}
      {grouped.confirm_match.length > 0 && (
        <InboxSection
          title="Confirm matches"
          subtitle="Multiple possible matches found"
          color="var(--warning)"
          icon={Lucide.HelpCircle}
          items={grouped.confirm_match}
          rules={rules}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onViewRule={onViewRule}
        />
      )}
      {grouped.price_changed.length > 0 && (
        <InboxSection
          title="Price changes"
          subtitle="Amount differs from expected"
          color="var(--warning)"
          icon={Lucide.TrendingUp}
          items={grouped.price_changed}
          rules={rules}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onViewRule={onViewRule}
        />
      )}
      {grouped.cadence_drift.length > 0 && (
        <InboxSection
          title="Cadence drift"
          subtitle="Timing doesn't match expected pattern"
          color="var(--text-secondary)"
          icon={Lucide.Calendar}
          items={grouped.cadence_drift}
          rules={rules}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onViewRule={onViewRule}
        />
      )}
      {grouped.needs_details.length > 0 && (
        <InboxSection
          title="Needs details"
          subtitle="Missing information for matching"
          color="var(--text-secondary)"
          icon={Lucide.FileQuestion}
          items={grouped.needs_details}
          rules={rules}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onViewRule={onViewRule}
        />
      )}
    </div>
  );
}

function InboxSection({
  title,
  subtitle,
  color,
  icon: Icon,
  items,
  rules,
  onResolve,
  onDismiss,
  onViewRule,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  items: InboxItem[];
  rules: Rule[] | undefined;
  onResolve: (item: InboxItem, resolution?: Record<string, unknown>) => void;
  onDismiss: (item: InboxItem) => void;
  onViewRule: (ruleId: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <div>
          <div className="text-sm font-semibold" style={{ color }}>
            {title}
          </div>
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {subtitle}
          </div>
        </div>
        <div
          className="ml-auto px-1.5 py-0.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {items.length}
        </div>
      </div>

      <div
        className="rounded-xl border divide-y"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {items.map((item) => (
          <InboxItemRow
            key={item._id}
            item={item}
            rule={rules?.find((r) => r._id === item.ruleId)}
            onResolve={onResolve}
            onDismiss={onDismiss}
            onViewRule={onViewRule}
          />
        ))}
      </div>
    </div>
  );
}

function InboxItemRow({
  item,
  rule,
  onResolve,
  onDismiss,
  onViewRule,
}: {
  item: InboxItem;
  rule?: Rule;
  onResolve: (item: InboxItem, resolution?: Record<string, unknown>) => void;
  onDismiss: (item: InboxItem) => void;
  onViewRule: (ruleId: string) => void;
}) {
  const reason = getReasonText(item);

  return (
    <div className="px-4 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {rule?.displayName ?? rule?.name ?? "Unknown rule"}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {reason}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {item.type === "confirm_match" && (
            <button
              onClick={() =>
                onResolve(item, {
                  ruleId: item.ruleId,
                  entryId: item.entryId,
                  expectedChargeId: item.expectedChargeId,
                })
              }
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "var(--success)", color: "#fff" }}
            >
              Confirm
            </button>
          )}
          {item.type === "missed_payment" && (
            <button
              onClick={() => onResolve(item)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "var(--primary)", color: "#fff" }}
            >
              Mark resolved
            </button>
          )}
          {item.ruleId && (
            <button
              onClick={() => onViewRule(item.ruleId!)}
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: "var(--surface-2)" }}
              title="View rule"
            >
              <Lucide.Settings2 className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
          <button
            onClick={() => onDismiss(item)}
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: "var(--surface-2)" }}
            title="Dismiss"
          >
            <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function getReasonText(item: InboxItem): string {
  const payload = item.payload as Record<string, unknown> | undefined;

  switch (item.type) {
    case "confirm_match":
      return "Multiple transactions could match this rule. Please confirm the correct one.";
    case "missed_payment":
      const date = payload?.expectedDate
        ? new Date(payload.expectedDate as number).toLocaleDateString()
        : "Unknown date";
      return `Expected charge on ${date} was not logged.`;
    case "price_changed":
      return "The amount differs from the expected value.";
    case "cadence_drift":
      return "This charge arrived at an unexpected time.";
    case "needs_details":
      return "Missing information needed to match this recurring charge.";
    default:
      return "This item needs your attention.";
  }
}
