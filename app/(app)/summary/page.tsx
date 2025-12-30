"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars } from "@/components/utils";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useTimeRange } from "@/components/TimeRangeProvider";
import { useQuickLog } from "@/components/log/QuickLogProvider";
import * as Lucide from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const COLORS = ["#2F6F85", "#10B981", "#F59E0B", "#6F9EA8", "#EC4899", "#C87A5A"];

export default function SummaryPage() {
  const { user } = useUser();
  const router = useRouter();
  const { open: openQuickLog } = useQuickLog();
  const { startDate, endDate, label, prevStartDate, prevEndDate, prevLabel } = useTimeRange();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as any[] | undefined;
  const prevEntries = useQuery(api.entries.listEntries, { startDate: prevStartDate, endDate: prevEndDate, limit: 1200 }) as any[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;

  // Get recent entries for mini-list (last 5)
  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);
  }, [entries]);

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

        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;

    const bucketRows = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const otherTotal = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [, v]) => s + v, 0);
    const bucketFinal = otherTotal > 0 ? [...bucketRows, ["Other", otherTotal] as const] : bucketRows;

    // Top category
    const topCategory = [...categorySpend.entries()].sort((a, b) => b[1] - a[1])[0];

    return { income, expense, net, bucketFinal, topCategory };
  }, [entries]);

  // Previous period for comparison
  const prevComputed = useMemo(() => {
    const all = prevEntries ?? [];
    let income = 0;
    let expense = 0;

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;
    }

    return { income, expense, net: income - expense };
  }, [prevEntries]);

  // Compute deltas
  const deltas = useMemo(() => {
    const incomeDelta = computed.income - prevComputed.income;
    const expenseDelta = computed.expense - prevComputed.expense;
    const netDelta = computed.net - prevComputed.net;
    return { income: incomeDelta, expense: expenseDelta, net: netDelta };
  }, [computed, prevComputed]);

  const reviewCount = inbox?.length ?? 0;

  function openLogSpent() {
    openQuickLog();
  }

  function openLogReceived() {
    openQuickLog();
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header Card with Title + Date Selector */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-h1" style={{ color: "var(--text)" }}>Home</h1>
          </div>
          <GlobalDateRangePicker />
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
                  {deltas.net !== 0 && prevEntries && (
                    <>
                      {deltas.net >= 0 ? (
                        <Lucide.TrendingUp className="h-4 w-4" style={{ color: "var(--success)" }} />
                      ) : (
                        <Lucide.TrendingDown className="h-4 w-4" style={{ color: "var(--danger)" }} />
                      )}
                      <span className="text-meta" style={{ color: deltas.net >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {deltas.net >= 0 ? "+" : ""}{centsToDollars(deltas.net)} vs {prevLabel.toLowerCase()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </div>

      <SignedIn>
        {entries && inbox && (
          <>
            {/* Quick Actions Row */}
            <div
              className="grid grid-cols-4 gap-2"
            >
              <button
                onClick={openLogSpent}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--danger-subtle)" }}
                >
                  <Lucide.ArrowUpRight className="h-5 w-5" style={{ color: "var(--danger)" }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Log spent</span>
              </button>

              <button
                onClick={openLogReceived}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--success-subtle)" }}
                >
                  <Lucide.ArrowDownLeft className="h-5 w-5" style={{ color: "var(--success)" }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Log received</span>
              </button>

              {reviewCount > 0 && (
                <Link
                  href="/review"
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-[var(--surface-subtle)]"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="relative flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--warning-subtle)" }}
                  >
                    <Lucide.AlertCircle className="h-5 w-5" style={{ color: "var(--warning)" }} />
                    <span
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "var(--warning)", color: "white" }}
                    >
                      {reviewCount > 9 ? "9+" : reviewCount}
                    </span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Review</span>
                </Link>
              )}

              <Link
                href="/activity?focus=search"
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--surface-subtle)" }}
                >
                  <Lucide.Search className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>Search</span>
              </Link>
            </div>

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
                {prevEntries && deltas.income !== 0 && (
                  <div className="text-[10px] mt-0.5" style={{ color: deltas.income >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {deltas.income >= 0 ? "+" : ""}{centsToDollars(deltas.income)}
                  </div>
                )}
              </div>
              <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
                <div className="text-micro mb-1">Spent</div>
                <div
                  className="text-xl font-semibold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {centsToDollars(computed.expense)}
                </div>
                {prevEntries && deltas.expense !== 0 && (
                  <div className="text-[10px] mt-0.5" style={{ color: deltas.expense <= 0 ? "var(--success)" : "var(--danger)" }}>
                    {deltas.expense >= 0 ? "+" : ""}{centsToDollars(deltas.expense)}
                  </div>
                )}
              </div>
              <Link href="/review" className="p-4 transition-colors hover:bg-[var(--surface-subtle)]" style={{ backgroundColor: "var(--surface)" }}>
                <div className="text-micro mb-1">Needs review</div>
                <div
                  className="text-xl font-semibold tabular-nums"
                  style={{ color: reviewCount > 0 ? "var(--warning)" : "var(--text-tertiary)" }}
                >
                  {reviewCount}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>entries</div>
              </Link>
            </div>

            {/* Needs Review Card - actionable */}
            {reviewCount > 0 && (
              <Link
                href="/review"
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
                  <div className="text-meta">Start review wizard →</div>
                </div>
                <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
              </Link>
            )}

            {/* Recent Entries Mini-list */}
            {recentEntries.length > 0 && (
              <div
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-h2" style={{ color: "var(--text)" }}>Recent</span>
                  <Link href="/activity" className="text-meta font-medium" style={{ color: "var(--accent)" }}>
                    See all →
                  </Link>
                </div>
                <div>
                  {recentEntries.map((e, i) => {
                    const isIncome = e.type === "income";
                    const amountColor = isIncome ? "var(--success)" : "var(--text)";
                    const amountPrefix = isIncome ? "+" : "−";

                    return (
                      <Link
                        key={e._id}
                        href={`/activity?edit=${e._id}`}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-subtle)] ${i > 0 ? "border-t" : ""}`}
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-body font-medium truncate" style={{ color: "var(--text)" }}>
                            {e.note || e.merchant || e.category || "Untitled"}
                          </div>
                          <div className="text-meta truncate" style={{ color: "var(--text-secondary)" }}>
                            {e.category || e.bucket || "Uncategorized"}
                            {e.tags?.length > 0 && ` · ${e.tags.slice(0, 2).join(", ")}`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div
                            className="text-body font-semibold tabular-nums"
                            style={{ color: amountColor }}
                          >
                            {amountPrefix}{centsToDollars(Math.abs(e.amountCents))}
                          </div>
                          <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                            {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Spending Breakdown with top category hint */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setBreakdownOpen(!breakdownOpen)}
                className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <div className="text-left">
                  <span className="text-h2 block" style={{ color: "var(--text)" }}>
                    Spending by Category
                  </span>
                  {computed.topCategory && !breakdownOpen && (
                    <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                      Top: {computed.topCategory[0]} — {centsToDollars(computed.topCategory[1])}
                    </span>
                  )}
                </div>
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
                          <Link
                            key={name}
                            href={`/activity?category=${encodeURIComponent(String(name))}`}
                            className="block space-y-1.5 transition-opacity hover:opacity-80"
                          >
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
                          </Link>
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
