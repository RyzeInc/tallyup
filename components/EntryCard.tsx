"use client";

import { centsToDollars } from "./utils";
import { useOptimisticLinks } from "./OptimisticLinksProvider";

export default function EntryCard({
  entry,
  rightSlot,
  children,
}: {
  entry: any;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const isExpense = entry.type === "expense";
  const { has } = useOptimisticLinks();
  const isOptimistic = has(entry._id);

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--card-foreground)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">
            <span style={{ color: isExpense ? "var(--destructive-foreground)" : "var(--success-foreground)", fontWeight: 600 }}>
              {isExpense ? "-" : "+"}
              {centsToDollars(entry.amountCents)}
            </span>
            {(entry.recurringRuleId || isOptimistic) ? (
              <span className="ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--success)", color: "var(--success-foreground)" }}>Pattern</span>
            ) : null}
          </div>
          <div className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <span className="font-medium">{entry.bucket}</span>
            {entry.category ? (
              <span className="text-neutral-400"> · {entry.category}</span>
            ) : (
              <span className="text-neutral-500"> · Needs review</span>
            )}
          </div>
          {entry.note ? <div className="mt-1 text-xs text-neutral-500">{entry.note}</div> : null}
        </div>
        {rightSlot}
      </div>

      {entry.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.tags.map((t: string) => (
            <span
              key={t}
              className="rounded-full border px-2 py-0.5 text-[11px]"
              style={{ borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--muted-foreground)" }}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
