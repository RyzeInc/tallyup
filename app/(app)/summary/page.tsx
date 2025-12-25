"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars, startOfMonthLocalTs, startOfWeekLocalTs, todayYYYYMMDD, yyyymmddToLocalMidnightTs } from "@/components/utils";
import DateRangeControl from "@/components/activity/DateRangeControl";
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import Link from "next/link";

type RangeMode = "today" | "week" | "month" | "custom";
const COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#94a3b8"];

export default function SummaryPage() {
  const [mode, setMode] = useState<RangeMode>("week");
  const [from, setFrom] = useState(todayYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date();
    if (mode === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { startDate: start, endDate: Date.now() + 1, label: "Today" };
    }
    if (mode === "week") return { startDate: startOfWeekLocalTs(now), endDate: Date.now() + 1, label: "This Week" };
    if (mode === "month") return { startDate: startOfMonthLocalTs(now), endDate: Date.now() + 1, label: "This Month" };
    // custom
    const s = yyyymmddToLocalMidnightTs(from);
    const e = yyyymmddToLocalMidnightTs(to) + 24 * 60 * 60 * 1000;
    return { startDate: Math.min(s, e), endDate: Math.max(s, e), label: `${from} – ${to}` };
  }, [mode, from, to]);

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as any[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;

    const bucketSpend = new Map<string, number>();

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;

      if (e.type === "expense") {
        const b = (e.bucket ?? "Other").trim() || "Other";
        bucketSpend.set(b, (bucketSpend.get(b) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;

    const bucketRows = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const otherTotal = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [, v]) => s + v, 0);
    const bucketFinal = otherTotal > 0 ? [...bucketRows, ["Other", otherTotal] as const] : bucketRows;

    return { income, expense, net, bucketFinal };
  }, [entries]);

  const reviewCount = inbox?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header with date range chip */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Overview
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Your financial snapshot
          </p>
        </div>
        <DateRangeControl
          range={mode}
          setRange={(r) => setMode(r as RangeMode)}
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
            Sign in to view your summary
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
        {!entries || !inbox ? (
          <div className="space-y-3">
            <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            </div>
          </div>
        ) : (
          <>
            {/* Hero Net Card */}
            <div
              className="rounded-xl border p-6"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Net
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{
                    color: computed.net >= 0 ? "var(--success)" : "var(--danger)",
                    fontFeatureSettings: "'tnum' 1",
                  }}
                >
                  {computed.net >= 0 ? "+" : ""}{centsToDollars(computed.net)}
                </span>
                <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {label}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1">
                {computed.net >= 0 ? (
                  <TrendingUp className="h-4 w-4" style={{ color: "var(--success)" }} />
                ) : (
                  <TrendingDown className="h-4 w-4" style={{ color: "var(--danger)" }} />
                )}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {computed.net >= 0 ? "You're in the green" : "More out than in"}
                </span>
              </div>
            </div>

            {/* Secondary: Received / Spent */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Received
                </div>
                <div
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: "var(--success)", fontFeatureSettings: "'tnum' 1" }}
                >
                  +{centsToDollars(computed.income)}
                </div>
              </div>
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Spent
                </div>
                <div
                  className="mt-1 text-xl font-semibold tabular-nums"
                  style={{ color: "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                >
                  -{centsToDollars(computed.expense)}
                </div>
              </div>
            </div>

            {/* Review Alert - only show if items need review */}
            {reviewCount > 0 && (
              <Link
                href="/activity?review=1"
                className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ backgroundColor: "var(--warning-subtle)", borderColor: "var(--warning)" }}
              >
                <AlertCircle className="h-5 w-5" style={{ color: "var(--warning)" }} />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {reviewCount} {reviewCount === 1 ? "entry needs" : "entries need"} review
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Tap to categorize
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
              </Link>
            )}

            {/* Collapsible Spending Breakdown */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <button
                onClick={() => setBreakdownOpen(!breakdownOpen)}
                className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Spending breakdown
                </span>
                {breakdownOpen ? (
                  <ChevronDown className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                ) : (
                  <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                )}
              </button>

              {breakdownOpen && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                  {computed.bucketFinal.length === 0 ? (
                    <div className="pt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                      No spending yet.
                    </div>
                  ) : (
                    <div className="pt-3 space-y-2">
                      {computed.bucketFinal.map(([name, v], i) => {
                        const total = computed.bucketFinal.reduce((s, [, val]) => s + val, 0) || 1;
                        const pct = Math.round((v / total) * 100);
                        return (
                          <div key={name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                />
                                <span style={{ color: "var(--text)" }}>{name}</span>
                              </div>
                              <span style={{ color: "var(--text)" }} className="tabular-nums">
                                {centsToDollars(v)}
                              </span>
                            </div>
                            <div
                              className="h-1.5 rounded-full overflow-hidden"
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

                  <Link
                    href="/insights"
                    className="block text-center text-sm font-medium pt-2"
                    style={{ color: "var(--accent)" }}
                  >
                    View all insights →
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </SignedIn>
    </div>
  );
}
