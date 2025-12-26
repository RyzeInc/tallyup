"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import { centsToDollars } from "@/components/utils";
import GlobalDateRangePicker from "@/components/GlobalDateRangePicker";
import { useTimeRange } from "@/components/TimeRangeProvider";
import ChartBarStacked from "@/components/ui/ChartBarStacked";
import Link from "next/link";

const COLORS = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];

type ViewMode = "spent" | "received" | "net";
type GroupBy = "category" | "context";

export default function InsightsPage() {
  const { startDate, endDate, label, prevStartDate, prevEndDate, prevLabel } = useTimeRange();
  const [viewMode, setViewMode] = useState<ViewMode>("spent");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as any[] | undefined;
  const prevEntries = useQuery(api.entries.listEntries, { startDate: prevStartDate, endDate: prevEndDate, limit: 1200 }) as any[] | undefined;

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;

    const categorySpend = new Map<string, number>();
    const categoryIncome = new Map<string, number>();
    const contextSpend = new Map<string, number>();
    const daySpend = new Map<string, number>();

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") {
        income += e.amountCents;
        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categoryIncome.set(c, (categoryIncome.get(c) ?? 0) + e.amountCents);
      } else {
        expense += e.amountCents;
        const c = (e.category ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(c, (categorySpend.get(c) ?? 0) + e.amountCents);

        // Context tags
        if (e.tags?.length) {
          for (const tag of e.tags) {
            contextSpend.set(tag, (contextSpend.get(tag) ?? 0) + e.amountCents);
          }
        } else {
          contextSpend.set("Untagged", (contextSpend.get("Untagged") ?? 0) + e.amountCents);
        }

        // Group by day
        const day = new Date(e.date).toLocaleDateString("en-US", { weekday: "short" });
        daySpend.set(day, (daySpend.get(day) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;

    const topExpenseCats = [...categorySpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topIncomeCats = [...categoryIncome.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topContexts = [...contextSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return { income, expense, net, topExpenseCats, topIncomeCats, topContexts, categorySpend, categoryIncome };
  }, [entries]);

  // Previous period for comparisons
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
  const deltas = useMemo(() => ({
    income: computed.income - prevComputed.income,
    expense: computed.expense - prevComputed.expense,
    net: computed.net - prevComputed.net,
  }), [computed, prevComputed]);

  // Get the data to show based on view mode and grouping
  const breakdownData = useMemo(() => {
    if (viewMode === "received") {
      return computed.topIncomeCats;
    }
    if (groupBy === "context") {
      return computed.topContexts;
    }
    return computed.topExpenseCats;
  }, [viewMode, groupBy, computed]);

  const breakdownTotal = useMemo(() => {
    return breakdownData.reduce((s, [, v]) => s + v, 0);
  }, [breakdownData]);

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
        <GlobalDateRangePicker showAllPresets />
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
            {/* View Mode Toggle */}
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-xl"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {[
                { key: "spent" as ViewMode, label: "Spent", icon: Lucide.ArrowUpRight },
                { key: "received" as ViewMode, label: "Received", icon: Lucide.ArrowDownLeft },
                { key: "net" as ViewMode, label: "Net", icon: Lucide.TrendingUp },
              ].map(({ key, label: lbl, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    viewMode === key ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : ""
                  }`}
                  style={{ color: viewMode === key ? undefined : "var(--text)" }}
                >
                  <Icon className="h-4 w-4" />
                  {lbl}
                </button>
              ))}
            </div>

            {/* Summary cards with deltas */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className={`rounded-xl border p-3 transition-colors ${viewMode === "received" ? "ring-2 ring-[var(--accent)]" : ""}`}
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                  Received
                </div>
                <div
                  className="mt-1 text-lg font-semibold tabular-nums"
                  style={{ color: "var(--success)", fontFeatureSettings: "'tnum' 1" }}
                >
                  {centsToDollars(computed.income)}
                </div>
                {prevEntries && deltas.income !== 0 && (
                  <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: deltas.income >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {deltas.income >= 0 ? <Lucide.TrendingUp className="h-3 w-3" /> : <Lucide.TrendingDown className="h-3 w-3" />}
                    {deltas.income >= 0 ? "+" : ""}{centsToDollars(deltas.income)}
                  </div>
                )}
              </div>
              <div
                className={`rounded-xl border p-3 transition-colors ${viewMode === "spent" ? "ring-2 ring-[var(--accent)]" : ""}`}
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                  Spent
                </div>
                <div
                  className="mt-1 text-lg font-semibold tabular-nums"
                  style={{ color: "var(--danger)", fontFeatureSettings: "'tnum' 1" }}
                >
                  {centsToDollars(computed.expense)}
                </div>
                {prevEntries && deltas.expense !== 0 && (
                  <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: deltas.expense <= 0 ? "var(--success)" : "var(--danger)" }}>
                    {deltas.expense <= 0 ? <Lucide.TrendingDown className="h-3 w-3" /> : <Lucide.TrendingUp className="h-3 w-3" />}
                    {deltas.expense >= 0 ? "+" : ""}{centsToDollars(deltas.expense)}
                  </div>
                )}
              </div>
              <div
                className={`rounded-xl border p-3 transition-colors ${viewMode === "net" ? "ring-2 ring-[var(--accent)]" : ""}`}
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
                {prevEntries && deltas.net !== 0 && (
                  <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: deltas.net >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {deltas.net >= 0 ? <Lucide.TrendingUp className="h-3 w-3" /> : <Lucide.TrendingDown className="h-3 w-3" />}
                    {deltas.net >= 0 ? "+" : ""}{centsToDollars(deltas.net)}
                  </div>
                )}
              </div>
            </div>

            {/* Breakdown Card */}
            {viewMode !== "net" && (
              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lucide.PieChart className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {viewMode === "spent" ? "Spending" : "Income"} by {groupBy === "category" ? "Category" : "Context"}
                    </span>
                  </div>
                  {viewMode === "spent" && (
                    <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: "var(--surface-subtle)" }}>
                      <button
                        onClick={() => setGroupBy("category")}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          groupBy === "category" ? "bg-[var(--surface)] shadow-sm" : ""
                        }`}
                        style={{ color: "var(--text)" }}
                      >
                        Category
                      </button>
                      <button
                        onClick={() => setGroupBy("context")}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          groupBy === "context" ? "bg-[var(--surface)] shadow-sm" : ""
                        }`}
                        style={{ color: "var(--text)" }}
                      >
                        Context
                      </button>
                    </div>
                  )}
                </div>

                {breakdownData.length === 0 ? (
                  <div className="text-sm py-4 text-center" style={{ color: "var(--text-secondary)" }}>
                    No data yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {breakdownData.map(([name, v], i) => {
                      const pct = Math.round((v / (breakdownTotal || 1)) * 100);
                      return (
                        <Link
                          key={name}
                          href={`/activity?${groupBy === "category" ? "category" : "tag"}=${encodeURIComponent(name)}`}
                          className="block space-y-1.5 transition-opacity hover:opacity-80"
                        >
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
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Timeline chart */}
            {viewMode !== "net" && (
              <div>
                <ChartBarStacked />
              </div>
            )}

            {/* Top Categories / Sources (tappable) */}
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Lucide.BarChart3 className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Top {viewMode === "received" ? "Sources" : "Categories"}
                </span>
              </div>

              {breakdownData.length === 0 ? (
                <div className="text-sm py-4 text-center" style={{ color: "var(--text-secondary)" }}>
                  No data yet
                </div>
              ) : (
                <div className="space-y-2">
                  {breakdownData.slice(0, 5).map(([cat, v], idx) => (
                    <Link
                      key={cat}
                      href={`/activity?category=${encodeURIComponent(cat)}`}
                      className="flex items-center justify-between text-sm py-1.5 transition-opacity hover:opacity-80"
                    >
                      <div className="flex items-center gap-2" style={{ color: "var(--text)" }}>
                        <span className="w-5 text-right" style={{ color: "var(--text-tertiary)" }}>
                          {idx + 1}.
                        </span>
                        <span>{cat}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>
                          {centsToDollars(v)}
                        </span>
                        <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      </div>
                    </Link>
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
