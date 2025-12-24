"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import EntryCard from "@/components/EntryCard";
import RecurringModal from "@/components/RecurringModal";
import { EntryType, startOfMonthLocalTs, startOfWeekLocalTs, todayYYYYMMDD, yyyymmddToLocalMidnightTs } from "@/components/utils";

export default function HistoryPage() {
  const [type, setType] = useState<"all" | EntryType>("all");
  const [bucket, setBucket] = useState<string>("");

  const [range, setRange] = useState<"week" | "month" | "custom">("month");
  const [from, setFrom] = useState(todayYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());

  const deleteEntry = useMutation(api.entries.deleteEntry);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (range === "week") return { startDate: startOfWeekLocalTs(now), endDate: Date.now() + 1 };
    if (range === "month") return { startDate: startOfMonthLocalTs(now), endDate: Date.now() + 1 };
    const s = yyyymmddToLocalMidnightTs(from);
    const e = yyyymmddToLocalMidnightTs(to) + 24 * 60 * 60 * 1000;
    return { startDate: Math.min(s, e), endDate: Math.max(s, e) };
  }, [range, from, to]);

  const entries = useQuery(api.entries.listEntries, {
    type: type === "all" ? undefined : type,
    bucket: bucket.trim() ? bucket : undefined,
    startDate,
    endDate,
    limit: 400,
  }) as any[] | undefined;

  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div>
      <div className="mb-4">
        <div className="text-2xl font-semibold tracking-tight">History</div>
        <div className="mt-1 text-sm text-neutral-400">Filter + delete.</div>
      </div>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 mb-3">Sign in to view history.</div>
          <SignInButton mode="modal">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-900">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setType("all")} className={pill(type === "all")}>All</button>
            <button onClick={() => setType("expense")} className={pill(type === "expense")}>Expense</button>
            <button onClick={() => setType("income")} className={pill(type === "income")}>Income</button>
          </div>

          <input
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="Filter by bucket (optional)"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none focus:border-neutral-600"
          />

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setRange("week")} className={pill(range === "week")}>This Week</button>
            <button onClick={() => setRange("month")} className={pill(range === "month")}>This Month</button>
            <button onClick={() => setRange("custom")} className={pill(range === "custom")}>Custom</button>
          </div>

          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateInput()} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateInput()} />
            </div>
          ) : null}
        </div>

        {!entries ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-300">
            No entries in this range.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <EntryCard
                key={e._id}
                entry={e}
                rightSlot={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelected(e)}
                      className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600"
                    >
                      Make recurring
                    </button>

                    <button
                      onClick={() => deleteEntry({ id: e._id })}
                      className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-200 hover:border-neutral-600"
                    >
                      Delete
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {selected ? <RecurringModal entry={selected} onClose={() => setSelected(null)} onCreated={(id) => setSelected(null)} /> : null}
      </SignedIn>
    </div>
  );
}

function pill(active: boolean) {
  return [
    "rounded-xl border px-3 py-2 text-xs font-semibold",
    active ? "bg-white text-neutral-900 border-white" : "bg-neutral-950/40 border-neutral-800 text-neutral-200 hover:border-neutral-600",
  ].join(" ");
}
function dateInput() {
  return "w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none focus:border-neutral-600";
}
