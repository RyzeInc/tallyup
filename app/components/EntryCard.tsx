"use client";

import { centsToDollars } from "./utils";

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
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">
            <span className={isExpense ? "text-rose-400" : "text-emerald-400"}>
              {isExpense ? "-" : "+"}
              {centsToDollars(entry.amountCents)}
            </span>
          </div>
          <div className="mt-1 text-sm text-neutral-300">
            <span className="font-medium">{entry.bucket}</span>
            {entry.category ? (
              <span className="text-neutral-400"> · {entry.category}</span>
            ) : (
              <span className="text-neutral-500"> · Unlabeled</span>
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
              className="rounded-full border border-neutral-800 bg-neutral-950/40 px-2 py-0.5 text-[11px] text-neutral-300"
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
