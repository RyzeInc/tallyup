"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars, todayYYYYMMDD, getDateRangeFromPreset, DateRangePreset } from "@/components/utils";
import DateRangeControl from "@/components/activity/DateRangeControl";
import * as Lucide from "lucide-react";
import Link from "next/link";

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

export default function SummaryPage() {
  const { user } = useUser();
  const [mode, setMode] = useState<DateRangePreset>("week");
  const [from, setFrom] = useState(todayYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const { startDate, endDate, label } = useMemo(() => {
    return getDateRangeFromPreset(mode, from, to);
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
    <div className="space-y-6 pb-4">
      {/* Header Card with Title + Date Selector */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-h1" style={{ color: "var(--text)" }}>Home</h1>
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
          <div className="text-center py-6">
            <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign in to view your finances
            </div>
            <SignInButton mode="modal">
              <button
                className="rounded-lg px-5 py-2.5 font-semibold text-sm"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!entries || !inbox ? (
            <div className="space-y-4">
              <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              </div>
            </div>
          ) : (
            <>
              {/* Hero: Net Amount */}
              <div className="mb-4">
                <div className="text-micro mb-1">{label}&apos;s net</div>
                <div
                  className="text-kpi tabular-nums"
                  style={{ color: computed.net >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {computed.net >= 0 ? "+" : ""}{centsToDollars(computed.net)}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {computed.net >= 0 ? (
                    <Lucide.TrendingUp className="h-4 w-4" style={{ color: "var(--success)" }} />
                  ) : (
                    <Lucide.TrendingDown className="h-4 w-4" style={{ color: "var(--danger)" }} />
                  )}
                  <span className="text-meta" style={{ color: "var(--success)" }}>
                    {computed.net >= 0 ? "↗ You're ahead" : "↘ More out than in"}
                  </span>
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </div>

      <SignedIn>
        {entries && inbox && (
          <>
            {/* Stats Row: Received / Spent / Needs Review */}
            <div
              className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--border)" }}
            >
              <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
                <div className="text-micro mb-1">Received</div>
                <div
                  className="text-xl font-semibold tabular-nums"
                  style={{ color: "var(--success)" }}
                >
                  {centsToDollars(computed.income)}
                </div>
                <div className="text-meta">{label}</div>
              </div>
              <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
                <div className="text-micro mb-1">Spent</div>
                <div
                  className="text-xl font-semibold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {centsToDollars(computed.expense)}
                </div>
                <div className="text-meta">{label}</div>
              </div>
              <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
                <div className="text-micro mb-1">Needs review</div>
                <div
                  className="text-xl font-semibold tabular-nums"
                  style={{ color: reviewCount > 0 ? "var(--warning)" : "var(--text-tertiary)" }}
                >
                  {reviewCount}
                </div>
                <div className="text-meta">entries</div>
              </div>
            </div>

            {/* Attention Needed Card */}
            {reviewCount > 0 && (
              <Link
                href="/activity?review=1"
                className="flex items-center gap-4 rounded-xl p-4 transition-colors hover:opacity-90"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--warning-subtle)" }}
                >
                  <Lucide.AlertCircle className="h-5 w-5" style={{ color: "var(--warning)" }} />
                </div>
                <div className="flex-1">
                  <div className="text-body font-semibold" style={{ color: "var(--text)" }}>
                    {reviewCount} {reviewCount === 1 ? "entry needs" : "entries need"} review
                  </div>
                  <div className="text-meta">Tap to categorize</div>
                </div>
                <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
              </Link>
            )}

            {/* Spending Breakdown (Collapsible) */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setBreakdownOpen(!breakdownOpen)}
                className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <span className="text-h2" style={{ color: "var(--text)" }}>
                  Spending breakdown
                </span>
                {breakdownOpen ? (
                  <Lucide.ChevronDown className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                ) : (
                  <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                )}
              </button>

              {breakdownOpen && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                  {computed.bucketFinal.length === 0 ? (
                    <div className="pt-4 text-meta">No spending yet.</div>
                  ) : (
                    <div className="pt-3 space-y-3">
                      {computed.bucketFinal.map(([name, v], i) => {
                        const total = computed.bucketFinal.reduce((s, [, val]) => s + val, 0) || 1;
                        const pct = Math.round((v / total) * 100);
                        return (
                          <div key={name} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                />
                                <span className="text-body" style={{ color: "var(--text)" }}>{name}</span>
                              </div>
                              <span className="text-body tabular-nums font-semibold" style={{ color: "var(--text)" }}>
                                {centsToDollars(v)}
                              </span>
                            </div>
                            <div
                              className="h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: "var(--surface-subtle)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Link
                    href="/insights"
                    className="block text-center text-meta font-semibold pt-2"
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
