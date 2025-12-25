"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars, todayYYYYMMDD, getDateRangeFromPreset, DateRangePreset } from "@/components/utils";
import DateRangeControl from "@/components/activity/DateRangeControl";
import ChartBarStacked from "@/components/ui/ChartBarStacked";
import { TrendingUp, TrendingDown, PieChart, BarChart3 } from "lucide-react";

const COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#94a3b8"];

export default function InsightsPage() {
  const [mode, setMode] = useState<DateRangePreset>("month");
  const [from, setFrom] = useState(todayYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());

  const { startDate, endDate, label } = useMemo(() => {
    return getDateRangeFromPreset(mode, from, to);
  }, [mode, from, to]);

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as any[] | undefined;

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;

    const bucketSpend = new Map<string, number>();
    const categorySpend = new Map<string, number>();
    const daySpend = new Map<string, number>();

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;

      if (e.type === "expense") {
        const b = (e.bucket ?? "Other").trim() || "Other";
        bucketSpend.set(b, (bucketSpend.get(b) ?? 0) + e.amountCents);

        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);

        // Group by day
        const day = new Date(e.date).toLocaleDateString("en-US", { weekday: "short" });
        daySpend.set(day, (daySpend.get(day) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;

    const bucketRows = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]);
    const topCats = [...categorySpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { income, expense, net, bucketRows, topCats };
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Insights
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Trends and breakdowns
          </p>
        </div>
        <DateRangeControl
          range={mode}
          setRange={(r) => setMode(r as DateRangePreset)}
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
        />
      </div>

      <SignedOut>
        <div
          className="rounded-xl border p-6 text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to view insights
          </div>
          <SignInButton mode="modal">
            <button
              className="rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {!entries ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-xl border p-3"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                  Income
                </div>
                <div
                  className="mt-1 text-lg font-semibold tabular-nums"
                  style={{ color: "var(--success)", fontFeatureSettings: "'tnum' 1" }}
                >
                  {centsToDollars(computed.income)}
                </div>
              </div>
              <div
                className="rounded-xl border p-3"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                  Expenses
                </div>
                <div
                  className="mt-1 text-lg font-semibold tabular-nums"
                  style={{ color: "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                >
                  {centsToDollars(computed.expense)}
                </div>
              </div>
              <div
                className="rounded-xl border p-3"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                  Net
                </div>
                <div
                  className="mt-1 text-lg font-semibold tabular-nums"
                  style={{ color: computed.net >= 0 ? "var(--success)" : "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                >
                  {computed.net >= 0 ? "+" : ""}{centsToDollars(computed.net)}
                </div>
              </div>
            </div>

            {/* Spending by Space */}
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Spending by Space
                </span>
              </div>

              {computed.bucketRows.length === 0 ? (
                <div className="text-sm py-4 text-center" style={{ color: "var(--text-secondary)" }}>
                  No spending data yet
                </div>
              ) : (
                <div className="space-y-3">
                  {computed.bucketRows.map(([name, v], i) => {
                    const total = computed.bucketRows.reduce((s, [, val]) => s + val, 0) || 1;
                    const pct = Math.round((v / total) * 100);
                    return (
                      <div key={name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span style={{ color: "var(--text)" }}>{name}</span>
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                              {pct}%
                            </span>
                          </div>
                          <span style={{ color: "var(--text)" }} className="tabular-nums font-medium">
                            {centsToDollars(v)}
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ backgroundColor: "var(--surface-subtle)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

              {/* Stacked bar chart (timeline by category) */}
              <div>
                <ChartBarStacked />
              </div>

            {/* Top Categories */}
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Top Categories
                </span>
              </div>

              {computed.topCats.length === 0 ? (
                <div className="text-sm py-4 text-center" style={{ color: "var(--text-secondary)" }}>
                  No category data yet
                </div>
              ) : (
                <div className="space-y-2">
                  {computed.topCats.map(([cat, v], idx) => (
                    <div key={cat} className="flex items-center justify-between text-sm py-1.5">
                      <div className="flex items-center gap-2" style={{ color: "var(--text)" }}>
                        <span className="w-5 text-right" style={{ color: "var(--text-tertiary)" }}>
                          {idx + 1}.
                        </span>
                        <span>{cat}</span>
                      </div>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>
                        {centsToDollars(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SignedIn>
    </div>
  );
}
