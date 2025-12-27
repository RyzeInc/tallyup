"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars } from "@/components/utils";
import * as Lucide from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditEntryModal from "@/components/EditEntryModal";
import { useTabs } from "@/components/PersistentTabs";

// Home-specific time scopes (Option C - Locked but Switchable)
type HomeScope = "this-month" | "last-month" | "this-week" | "last-week" | "last-90-days";

const SCOPE_OPTIONS: { key: HomeScope; label: string }[] = [
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "this-week", label: "This Week" },
  { key: "last-week", label: "Last Week" },
  { key: "last-90-days", label: "Last 90 Days" },
];

function getScopeDates(scope: HomeScope): { startDate: number; endDate: number; label: string } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = todayStart + 24 * 60 * 60 * 1000;

  switch (scope) {
    case "this-month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startDate: start, endDate: endOfToday, label: "This Month" };
    }
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startDate: start, endDate: end, label: "Last Month" };
    }
    case "this-week": {
      const dayOfWeek = now.getDay();
      const diff = (dayOfWeek + 6) % 7; // Monday start
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - diff);
      weekStart.setHours(0, 0, 0, 0);
      return { startDate: weekStart.getTime(), endDate: endOfToday, label: "This Week" };
    }
    case "last-week": {
      const dayOfWeek = now.getDay();
      const diff = (dayOfWeek + 6) % 7;
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - diff);
      thisWeekStart.setHours(0, 0, 0, 0);
      const lastWeekStart = thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000;
      return { startDate: lastWeekStart, endDate: thisWeekStart.getTime(), label: "Last Week" };
    }
    case "last-90-days": {
      const start = todayStart - 90 * 24 * 60 * 60 * 1000;
      return { startDate: start, endDate: endOfToday, label: "Last 90 Days" };
    }
  }
}

function getTimeAwareness(scope: HomeScope): string {
  const now = new Date();
  const { startDate, endDate } = getScopeDates(scope);

  // Calculate days info based on scope
  if (scope === "this-month") {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remaining = daysInMonth - dayOfMonth;
    return `Day ${dayOfMonth} of ${daysInMonth} · ${remaining} day${remaining !== 1 ? "s" : ""} remaining`;
  }

  if (scope === "this-week") {
    const dayOfWeek = now.getDay();
    const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek; // Monday = 1, Sunday = 7
    const remaining = 7 - dayNum;
    return `Day ${dayNum} of 7 · ${remaining} day${remaining !== 1 ? "s" : ""} remaining`;
  }

  if (scope === "last-month" || scope === "last-week") {
    const days = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000));
    return `${days} days · Completed period`;
  }

  if (scope === "last-90-days") {
    return "Rolling 90-day window";
  }

  return "";
}

function getLastTransactionText(lastDate?: number): string | null {
  if (!lastDate) return null;
  
  const now = new Date();
  const txDate = new Date(lastDate);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  if (lastDate >= todayStart) return "Last transaction: Today";
  if (lastDate >= yesterdayStart) return "Last transaction: Yesterday";

  const daysAgo = Math.floor((todayStart - lastDate) / (24 * 60 * 60 * 1000));
  if (daysAgo < 7) return `Last transaction: ${daysAgo} days ago`;

  return `Last transaction: ${txDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function HomePage() {
  const router = useRouter();
  const { activeTab } = useTabs();
  
  // Home scope always defaults to "this-month" - no persistence
  const [scope, setScope] = useState<HomeScope>("this-month");
  const { startDate, endDate, label } = useMemo(() => getScopeDates(scope), [scope]);

  // Reset scope to "this-month" when tab becomes active (Option C behavior)
  useEffect(() => {
    if (activeTab === "overview") {
      setScope("this-month");
    }
  }, [activeTab]);

  // Edit modal state
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  // Entry type for type safety
  type Entry = {
    _id: string;
    type: "expense" | "income";
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

  // Fetch entries for selected scope
  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 500 }) as Entry[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 200 }) as Entry[] | undefined;

  // Compute financial snapshot
  const snapshot = useMemo(() => {
    if (!entries) return null;

    let income = 0;
    let expense = 0;
    let lastTransactionDate: number | undefined;
    const categorySpend = new Map<string, number>();

    for (const e of entries) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;

      // Track last transaction
      if (!lastTransactionDate || e.date > lastTransactionDate) {
        lastTransactionDate = e.date;
      }

      // Track category spending for noteworthy insight
      if (e.type === "expense") {
        const cat = (e.category ?? e.bucket ?? "Uncategorized").trim() || "Uncategorized";
        categorySpend.set(cat, (categorySpend.get(cat) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;

    // Find largest single expense
    let largestExpense: { amount: number; note?: string; category?: string } | null = null;
    for (const e of entries) {
      if (e.type === "expense" && !e.excludeFromTotals) {
        if (!largestExpense || e.amountCents > largestExpense.amount) {
          largestExpense = {
            amount: e.amountCents,
            note: e.note || e.merchant,
            category: e.category ?? e.bucket,
          };
        }
      }
    }

    // Find top category
    let topCategory: { name: string; amount: number } | null = null;
    for (const [name, amount] of categorySpend.entries()) {
      if (!topCategory || amount > topCategory.amount) {
        topCategory = { name, amount };
      }
    }

    return {
      income,
      expense,
      net,
      lastTransactionDate,
      largestExpense,
      topCategory,
      totalExpenseCategories: categorySpend.size,
    };
  }, [entries]);

  // Recent transactions (last 6)
  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);
  }, [entries]);

  // Smart action chips
  const actionChips = useMemo(() => {
    const chips: { label: string; href: string; icon: React.ReactNode; count?: number }[] = [];
    
    // Review uncategorized
    const reviewCount = inbox?.length ?? 0;
    if (reviewCount > 0) {
      chips.push({
        label: `Review ${reviewCount} uncategorized`,
        href: "/review",
        icon: <Lucide.AlertCircle className="h-4 w-4" style={{ color: "var(--warning)" }} />,
        count: reviewCount,
      });
    }

    // Reimbursables pending
    const reimbursables = entries?.filter(e => 
      e.tags?.some((t: string) => t.toLowerCase() === "reimbursable") && 
      e.type === "expense"
    ).length ?? 0;
    if (reimbursables > 0) {
      chips.push({
        label: `${reimbursables} reimbursable${reimbursables !== 1 ? "s" : ""} pending`,
        href: "/activity?tag=Reimbursable",
        icon: <Lucide.Receipt className="h-4 w-4" style={{ color: "var(--accent)" }} />,
        count: reimbursables,
      });
    }

    // Business expenses to tag (entries without Business tag that might need it)
    const businessTaggable = entries?.filter(e =>
      e.type === "expense" &&
      !e.tags?.some((t: string) => t.toLowerCase() === "business") &&
      e.tags?.some((t: string) => t.toLowerCase() === "tax-deductible")
    ).length ?? 0;
    if (businessTaggable > 0 && chips.length < 3) {
      chips.push({
        label: `Tag ${businessTaggable} business expense${businessTaggable !== 1 ? "s" : ""}`,
        href: "/activity?tag=Tax-Deductible",
        icon: <Lucide.Briefcase className="h-4 w-4" style={{ color: "var(--accent)" }} />,
        count: businessTaggable,
      });
    }

    // Limit to 3 chips max
    return chips.slice(0, 3);
  }, [inbox, entries]);

  // Time awareness text
  const timeAwareness = getTimeAwareness(scope);
  const lastTxText = getLastTransactionText(snapshot?.lastTransactionDate);

  // Noteworthy highlight (max one, conditional)
  const noteworthyHighlight = useMemo(() => {
    if (!snapshot || !entries || entries.length < 3) return null;

    // Only show if we have meaningful data
    const totalSpent = snapshot.expense;
    if (totalSpent === 0) return null;

    // Pick one highlight based on what's most interesting
    // Priority 1: Largest expense if it's significant (>25% of total spending)
    if (snapshot.largestExpense && snapshot.largestExpense.amount > totalSpent * 0.25) {
      const desc = snapshot.largestExpense.note || snapshot.largestExpense.category || "expense";
      return {
        text: `Largest expense: ${centsToDollars(snapshot.largestExpense.amount)}`,
        subtext: desc,
        icon: <Lucide.TrendingUp className="h-5 w-5" style={{ color: "var(--accent)" }} />,
      };
    }

    // Priority 2: Top category if it dominates (>40% of spending)
    if (snapshot.topCategory && snapshot.topCategory.amount > totalSpent * 0.4) {
      const pct = Math.round((snapshot.topCategory.amount / totalSpent) * 100);
      return {
        text: `Most spending: ${snapshot.topCategory.name}`,
        subtext: `${pct}% of expenses · ${centsToDollars(snapshot.topCategory.amount)}`,
        icon: <Lucide.PieChart className="h-5 w-5" style={{ color: "var(--accent)" }} />,
      };
    }

    return null;
  }, [snapshot, entries]);

  const openLog = useCallback(() => {
    router.push("/log");
  }, [router]);

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Scope Toggle (Simple Pills) */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-2 min-w-max">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setScope(opt.key)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                backgroundColor: scope === opt.key ? "var(--accent)" : "var(--surface)",
                color: scope === opt.key ? "var(--accent-foreground)" : "var(--text-secondary)",
                border: scope === opt.key ? "none" : "1px solid var(--border)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Lens Indicator - shows when viewing non-default scope */}
      {scope !== "this-month" && (
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{ backgroundColor: "var(--accent-subtle, var(--surface-subtle))", border: "1px solid var(--accent)" }}
        >
          <div className="flex items-center gap-2">
            <Lucide.Eye className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              Viewing: {label}
            </span>
          </div>
          <button
            onClick={() => setScope("this-month")}
            className="text-xs font-medium px-2 py-1 rounded hover:bg-[var(--surface-subtle)] transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Reset
          </button>
        </div>
      )}

      <SignedOut>
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-body mb-4" style={{ color: "var(--text-secondary)" }}>
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
        {/* Loading state */}
        {(!entries || !inbox) && (
          <div className="space-y-4">
            <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
            <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
          </div>
        )}

        {entries && inbox && snapshot && (
          <>
            {/* 2. Financial Snapshot (Net / Income / Expense) */}
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Net - Primary anchor */}
              <div className="text-center mb-4">
                <div className="text-micro mb-1" style={{ color: "var(--text-tertiary)" }}>
                  Net
                </div>
                <div
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: snapshot.net >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {snapshot.net >= 0 ? "+" : ""}{centsToDollars(snapshot.net)}
                </div>
              </div>

              {/* Income / Expense row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center py-3 rounded-xl" style={{ backgroundColor: "var(--surface-subtle)" }}>
                  <div className="text-micro mb-0.5" style={{ color: "var(--text-tertiary)" }}>Income</div>
                  <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                    {centsToDollars(snapshot.income)}
                  </div>
                </div>
                <div className="text-center py-3 rounded-xl" style={{ backgroundColor: "var(--surface-subtle)" }}>
                  <div className="text-micro mb-0.5" style={{ color: "var(--text-tertiary)" }}>Expenses</div>
                  <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {centsToDollars(snapshot.expense)}
                  </div>
                </div>
              </div>

              {/* 3. Time Awareness Strip */}
              <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: "var(--border)" }}>
                <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                  {label} · {timeAwareness}
                </div>
                {lastTxText && (
                  <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                    {lastTxText}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Add Transaction CTA */}
            <button
              onClick={openLog}
              className="w-full flex items-center justify-center gap-3 rounded-xl py-4 px-5 font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              <Lucide.Plus className="h-5 w-5" />
              Add Transaction
            </button>

            {/* 5. Smart Action Chips (Conditional) */}
            {actionChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actionChips.map((chip, i) => (
                  <Link
                    key={i}
                    href={chip.href}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    {chip.icon}
                    {chip.label}
                  </Link>
                ))}
              </div>
            )}

            {/* 6. Recent Transactions List */}
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

                    // Relative date
                    const now = new Date();
                    const txDate = new Date(e.date);
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
                    let dateLabel: string;
                    if (e.date >= todayStart) dateLabel = "Today";
                    else if (e.date >= yesterdayStart) dateLabel = "Yesterday";
                    else dateLabel = txDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

                    return (
                      <button
                        key={e._id}
                        onClick={() => setEditEntry(e)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-subtle)] text-left ${i > 0 ? "border-t" : ""}`}
                        style={{ borderColor: "var(--border)" }}
                      >
                        {/* Payment method icon placeholder */}
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
                          style={{ backgroundColor: "var(--surface-subtle)" }}
                        >
                          {isIncome ? (
                            <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                          ) : (
                            <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-body font-medium truncate" style={{ color: "var(--text)" }}>
                            {e.note || e.merchant || e.category || e.bucket || "Untitled"}
                          </div>
                          <div className="flex items-center gap-1.5 text-meta" style={{ color: "var(--text-secondary)" }}>
                            <span className="truncate">{e.category || e.bucket || "Uncategorized"}</span>
                            {e.tags && e.tags.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="truncate">{e.tags.slice(0, 1).join(", ")}</span>
                              </>
                            )}
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
                            {dateLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for recent transactions */}
            {recentEntries.length === 0 && (
              <div
                className="rounded-xl p-8 text-center"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--surface-subtle)" }}
                >
                  <Lucide.Receipt className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
                </div>
                <div className="text-body font-medium mb-1" style={{ color: "var(--text)" }}>
                  No transactions yet
                </div>
                <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                  Add your first transaction to get started
                </div>
                <button
                  onClick={openLog}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  <Lucide.Plus className="h-4 w-4" />
                  Add Transaction
                </button>
              </div>
            )}

            {/* 7. Noteworthy Highlight (Conditional, Max One) */}
            {noteworthyHighlight && (
              <Link
                href="/insights"
                className="flex items-center gap-4 rounded-xl p-4 transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                  style={{ backgroundColor: "var(--accent-subtle, var(--surface-subtle))" }}
                >
                  {noteworthyHighlight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-medium truncate" style={{ color: "var(--text)" }}>
                    {noteworthyHighlight.text}
                  </div>
                  <div className="text-meta truncate" style={{ color: "var(--text-secondary)" }}>
                    {noteworthyHighlight.subtext}
                  </div>
                </div>
                <Lucide.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
              </Link>
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
