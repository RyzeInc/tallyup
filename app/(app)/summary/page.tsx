"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars, startOfMonthLocalTs, startOfWeekLocalTs } from "@/components/utils";

type RangeMode = "week" | "month";
const COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#94a3b8"];

export default function SummaryPage() {
  const [mode, setMode] = useState<RangeMode>("week");

  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date();
    if (mode === "week") return { startDate: startOfWeekLocalTs(now), endDate: Date.now() + 1, label: "This Week" };
    return { startDate: startOfMonthLocalTs(now), endDate: Date.now() + 1, label: "This Month" };
  }, [mode]);

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as any[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;

    const bucketSpend = new Map<string, number>();
    const categorySpend = new Map<string, number>();

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;

      if (e.type === "expense") {
        const b = (e.bucket ?? "Other").trim() || "Other";
        bucketSpend.set(b, (bucketSpend.get(b) ?? 0) + e.amountCents);

        const c = (e.category ?? "Unlabeled").trim() || "Unlabeled";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;

    const bucketRows = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const otherTotal = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [, v]) => s + v, 0);
    const bucketFinal = otherTotal > 0 ? [...bucketRows, ["Other", otherTotal] as const] : bucketRows;

    const topCats = [...categorySpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { income, expense, net, bucketFinal, topCats };
  }, [entries]);

  const donut = useMemo(() => {
    const total = computed.bucketFinal.reduce((s, [, v]) => s + v, 0) || 1;
    let acc = 0;
    const stops = computed.bucketFinal.map(([, v], i) => {
      const start = acc;
      acc += (v / total) * 360;
      return `${COLORS[i % COLORS.length]} ${start}deg ${acc}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [computed.bucketFinal]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Summary</div>
          <div className="mt-1 text-sm text-neutral-400">Your micro-dashboard.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode("week")} className={pill(mode === "week")} style={mode === "week" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" } : undefined}>This Week</button>
          <button onClick={() => setMode("month")} className={pill(mode === "month")} style={mode === "month" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" } : undefined}>This Month</button>
        </div>
      </div>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 mb-3">Sign in to view summary.</div>
          <SignInButton mode="modal">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {!entries || !inbox ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile title="Received" value={centsToDollars(computed.income)} sub={label} accent="emerald" />
              <Tile title="Spent" value={centsToDollars(computed.expense)} sub={label} accent="rose" />
              <Tile title="Net" value={centsToDollars(computed.net)} sub={label} accent="sky" />
              <Tile title="Needs Review" value={`${inbox.length}`} sub="entries" accent="amber" />
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
              <div className="text-sm font-semibold">Spending by Bucket</div>
              <div className="mt-3 flex gap-4">
                <div className="h-32 w-32 rounded-full border border-neutral-800" style={{ backgroundImage: donut }} />
                <div className="flex-1 space-y-2">
                  {computed.bucketFinal.map(([name, v], i) => (
                    <div key={name} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-neutral-200">{name}</span>
                      </div>
                      <span className="text-neutral-300">{centsToDollars(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Top Spending Categories</div>
                <div className="text-xs text-neutral-500">{label}</div>
              </div>
              <div className="mt-3 space-y-2">
                {computed.topCats.length === 0 ? (
                  <div className="text-sm text-neutral-400">No spending yet.</div>
                ) : (
                  computed.topCats.map(([c, v], idx) => (
                    <div key={c} className="flex items-center justify-between text-sm">
                      <div className="text-neutral-200">
                        <span className="text-neutral-500 mr-2">{idx + 1}.</span>
                        {c}
                      </div>
                      <div className="text-neutral-300">{centsToDollars(v)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </SignedIn>
    </div>
  );
}

function pill(active: boolean) {
  return [
    "rounded-xl border px-3 py-2 text-xs font-semibold",
    active ? "" : "bg-neutral-900/30 border-neutral-800 text-neutral-200 hover:border-neutral-600",
  ].join(" ");
}

function Tile({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  accent: "emerald" | "rose" | "sky" | "amber";
}) {
  const accentStyle =
    accent === "emerald" ? { color: "var(--success-foreground)" } :
    accent === "rose" ? { color: "#d1617a" } :
    accent === "sky" ? { color: "#60a5fa" } :
    { color: "#f59e0b" };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }}>
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-2 text-xl font-semibold" style={accentStyle}>{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}
