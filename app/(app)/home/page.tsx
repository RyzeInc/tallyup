"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { centsToDollars } from "@/components/utils";
import * as Lucide from "lucide-react";
import Link from "next/link";
import EditEntryModal from "@/components/EditEntryModal";
import { useQuickLog } from "@/components/log/QuickLogProvider";
import PageHeader from "@/components/ui/PageHeader";
import { useTimeRange } from "@/components/TimeRangeProvider";
import { toQueryArgs } from "@/src/lib/timeRange/toQueryArgs";
import TimeRangeControl from "@/components/TimeRangeControl";
import TimeRangeBadge from "@/components/TimeRangeBadge";

/**
 * Home Tab - Clean, confident first impression
 * 
 * Structure:
 * 1. Compact time range selector in header
 * 2. Balance Summary Card (Net as hero, Income/Expenses below)
 * 3. Quick Log row (Spent/Received buttons)
 * 4. Recent transactions grouped by date
 */


function getLastTransactionText(lastDate?: number): string | null {
  if (!lastDate) return null;
  
  const now = new Date();
  const txDate = new Date(lastDate);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  if (lastDate >= todayStart) return "Last entry: Today";
  if (lastDate >= yesterdayStart) return "Last entry: Yesterday";

  const daysAgo = Math.floor((todayStart - lastDate) / (24 * 60 * 60 * 1000));
  if (daysAgo < 7) return `Last entry: ${daysAgo} days ago`;

  return `Last entry: ${txDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// Group entries by date label (Today, Yesterday, Dec 24, etc.)
function groupEntriesByDate(entries: Entry[]): Map<string, Entry[]> {
  const groups = new Map<string, Entry[]>();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    let label: string;
    if (entry.date >= todayStart) {
      label = "Today";
    } else if (entry.date >= yesterdayStart) {
      label = "Yesterday";
    } else {
      const d = new Date(entry.date);
      label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(entry);
  }

  return groups;
}

type Entry = {
  _id: Id<"entries">;
  type: "expense" | "income" | "transfer";
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  note?: string;
  merchant?: string;
  tags?: string[];
  excludeFromTotals?: boolean;
  methodOrAccount?: string;
};

export default function HomePage() {
  const quickLog = useQuickLog();
  const { label, resolvedRange } = useTimeRange();
  const { fromMs, toMs } = toQueryArgs(resolvedRange);
  
  // Edit modal state
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  // Fetch entries for selected scope
  const entries = useQuery(api.entries.listEntries, { startDate: fromMs, endDate: toMs, limit: 500 }) as Entry[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 200 }) as Entry[] | undefined;

  // Compute financial snapshot
  const snapshot = useMemo(() => {
    if (!entries) return null;

    let income = 0;
    let expense = 0;
    let lastTransactionDate: number | undefined;

    for (const e of entries) {
      if (e.excludeFromTotals) continue;
      if (e.type === "transfer") continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;

      if (!lastTransactionDate || e.date > lastTransactionDate) {
        lastTransactionDate = e.date;
      }
    }

    const net = income - expense;

    return {
      income,
      expense,
      net,
      lastTransactionDate,
    };
  }, [entries]);

  // Recent transactions (last 10)
  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .filter((entry) => entry.type !== "transfer")
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);
  }, [entries]);

  // Grouped entries for display
  const groupedEntries = useMemo(() => groupEntriesByDate(recentEntries), [recentEntries]);

  const lastTxText = getLastTransactionText(snapshot?.lastTransactionDate);
  const reviewCount = inbox?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header with compact time range */}
      <PageHeader
        title="Home"
        rightSlot={
          <div className="flex items-center gap-2">
            <TimeRangeBadge />
            <TimeRangeControl />
          </div>
        }
        compact
      />

      <SignedOut>
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--card-radius)",
            border: "1px solid var(--border)",
            padding: "var(--space-6)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
            Sign in to view your finances
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Loading skeleton */}
        {(!entries || !inbox) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div 
              className="animate-shimmer" 
              style={{ 
                height: 160, 
                borderRadius: "var(--card-radius)",
                backgroundColor: "var(--surface-subtle)",
              }} 
            />
            <div 
              className="animate-shimmer" 
              style={{ 
                height: 64, 
                borderRadius: "var(--card-radius)",
                backgroundColor: "var(--surface-subtle)",
              }} 
            />
            <div 
              className="animate-shimmer" 
              style={{ 
                height: 200, 
                borderRadius: "var(--card-radius)",
                backgroundColor: "var(--surface-subtle)",
              }} 
            />
          </div>
        )}

        {entries && inbox && snapshot && (
          <>
            {/* Balance Summary Card */}
            <div
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: "var(--card-radius)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-card)",
                padding: "var(--card-padding)",
              }}
            >
              {/* Title */}
              <p 
                style={{ 
                  fontSize: "var(--text-meta)", 
                  color: "var(--text-secondary)",
                  marginBottom: "var(--space-2)",
                  textAlign: "center",
                }}
              >
                {label}
              </p>

              {/* Net - Hero number */}
              <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: "var(--text-kpi)",
                    fontWeight: "var(--text-kpi-weight)",
                    letterSpacing: "var(--text-kpi-tracking)",
                    color: snapshot.net >= 0 ? "var(--success)" : "var(--danger)",
                    lineHeight: 1.1,
                  }}
                >
                  {snapshot.net >= 0 ? "+" : ""}{centsToDollars(snapshot.net)}
                </div>
                <p 
                  style={{ 
                    fontSize: "var(--text-micro)", 
                    color: "var(--text-tertiary)",
                    marginTop: "var(--space-1)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Net
                </p>
              </div>

              {/* Income / Expenses row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    textAlign: "center",
                  }}
                >
                  <p 
                    className="tabular-nums"
                    style={{ 
                      fontSize: "1.125rem", 
                      fontWeight: 600, 
                      color: "var(--success)",
                    }}
                  >
                    {centsToDollars(snapshot.income)}
                  </p>
                  <p 
                    style={{ 
                      fontSize: "var(--text-micro)", 
                      color: "var(--text-tertiary)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    Received
                  </p>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    textAlign: "center",
                  }}
                >
                  <p 
                    className="tabular-nums"
                    style={{ 
                      fontSize: "1.125rem", 
                      fontWeight: 600, 
                      color: "var(--text)",
                    }}
                  >
                    {centsToDollars(snapshot.expense)}
                  </p>
                  <p 
                    style={{ 
                      fontSize: "var(--text-micro)", 
                      color: "var(--text-tertiary)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    Spent
                  </p>
                </div>
              </div>

              {/* Last entry */}
              {lastTxText && (
                <p
                  style={{
                    fontSize: "var(--text-meta)",
                    color: "var(--text-tertiary)",
                    textAlign: "center",
                    marginTop: "var(--space-4)",
                    paddingTop: "var(--space-3)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  {lastTxText}
                </p>
              )}
            </div>

            {/* Review Alert - opens first review item for editing */}
            {reviewCount > 0 && inbox && inbox[0] && (
              <button
                onClick={() => setEditEntry(inbox[0] as Entry)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  width: "100%",
                  backgroundColor: "var(--warning-subtle)",
                  border: "1px solid var(--warning)",
                  borderRadius: "var(--input-radius)",
                  padding: "var(--space-3) var(--space-4)",
                  textDecoration: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Lucide.AlertCircle className="h-5 w-5 shrink-0" style={{ color: "var(--warning)" }} />
                <span style={{ flex: 1, fontWeight: 500, color: "var(--text)" }}>
                  {reviewCount} transaction{reviewCount !== 1 ? "s" : ""} need review
                </span>
                <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
              </button>
            )}

            {/* Recent Transactions - Grouped by date */}
            {recentEntries.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  borderRadius: "var(--card-radius)",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-4)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>Recent</span>
                  <Link
                    href="/activity"
                    style={{
                      fontSize: "var(--text-meta)",
                      fontWeight: 500,
                      color: "var(--primary)",
                      textDecoration: "none",
                    }}
                  >
                    See all →
                  </Link>
                </div>

                {Array.from(groupedEntries.entries()).map(([dateLabel, dateEntries], groupIdx) => (
                  <div key={dateLabel}>
                    {/* Date group header */}
                    <div
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        backgroundColor: "var(--surface-2)",
                        fontSize: "var(--text-micro)",
                        fontWeight: 500,
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderTop: groupIdx > 0 ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      {dateLabel}
                    </div>

                    {/* Entries in this group */}
                    {dateEntries.map((e, idx) => {
                      const isIncome = e.type === "income";
                      const amountColor = isIncome ? "var(--success)" : "var(--text)";
                      const amountPrefix = isIncome ? "+" : "−";

                      return (
                        <button
                          key={e._id}
                          onClick={() => setEditEntry(e)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-3)",
                            padding: "var(--space-3) var(--space-4)",
                            backgroundColor: "transparent",
                            border: "none",
                            borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                            cursor: "pointer",
                            textAlign: "left",
                            minHeight: 52,
                          }}
                        >
                          {/* Icon */}
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              backgroundColor: "var(--surface-2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isIncome ? (
                              <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                            ) : (
                              <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                            )}
                          </div>

                          {/* Title & category */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 500,
                                color: "var(--text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {e.note || e.merchant || e.category || e.bucket || "Untitled"}
                            </p>
                            <p
                              style={{
                                fontSize: "var(--text-meta)",
                                color: "var(--text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span>{e.category || e.bucket || "Uncategorized"}</span>
                              {e.tags && e.tags.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span>{e.tags[0]}</span>
                                </>
                              )}
                            </p>
                          </div>

                          {/* Amount */}
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 600,
                              color: amountColor,
                              flexShrink: 0,
                            }}
                          >
                            {amountPrefix}{centsToDollars(Math.abs(e.amountCents))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {recentEntries.length === 0 && (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  borderRadius: "var(--card-radius)",
                  border: "1px solid var(--border)",
                  padding: "var(--space-8)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "var(--surface-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto var(--space-3)",
                  }}
                >
                  <Lucide.Receipt className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
                </div>
                <p style={{ fontWeight: 500, color: "var(--text)", marginBottom: "var(--space-1)" }}>
                  No transactions yet
                </p>
                <p style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
                  Add your first transaction to get started
                </p>
                <button
                  onClick={() => quickLog.open()}
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
                >
                  <Lucide.Plus className="h-4 w-4" />
                  Add Transaction
                </button>
              </div>
            )}

            {/* Edit Entry Modal */}
            {editEntry && (
              <EditEntryModal
                entry={editEntry}
                onClose={() => setEditEntry(null)}
                onSaved={() => setEditEntry(null)}
                onDeleted={() => setEditEntry(null)}
              />
            )}
          </>
        )}
      </SignedIn>
    </div>
  );
}
