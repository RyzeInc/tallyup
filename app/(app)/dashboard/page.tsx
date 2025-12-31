"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { centsToDollars, formatMoney } from "@/components/utils";
import * as Lucide from "lucide-react";
import EditEntryModal from "@/components/EditEntryModal";
import { useTabs } from "@/components/PersistentTabs";
import { TimeRangePickerModal } from "@/src/components/timeRange/TimeRangePickerModal";
import { resolveRange } from "@/src/lib/timeRange/resolve";
import { toQueryArgs } from "@/src/lib/timeRange/toQueryArgs";
import { PresetSelectionKey, TimeRangeSelection } from "@/src/lib/timeRange/types";

/**
 * Dashboard - Financial overview at a glance
 * 
 * Structure:
 * 1. Net money hero (income - expenses)
 * 2. Income/Expense breakdown
 * 3. Recent activity
 * 4. Quick actions
 */

type Entry = {
  _id: Id<"entries">;
  type: "expense" | "income" | "transfer";
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  note?: string;
  excludeFromTotals?: boolean;
  needsReview?: boolean;
};

const PRESET_LABELS: Record<PresetSelectionKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  this_year: "This Year",
  last_year: "Last Year",
};

function formatShortDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(date);
}

function getSelectionLabel(selection: TimeRangeSelection): string {
  if (selection.kind === "preset") {
    return PRESET_LABELS[selection.key] ?? "Custom Range";
  }
  if (!selection.from || !selection.to) return "Custom Range";
  return `Custom: ${formatShortDate(selection.from)}–${formatShortDate(selection.to)}`;
}

export default function DashboardPage() {
  const { setActiveTab } = useTabs();
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selection, setSelection] = useState<TimeRangeSelection>({
    kind: "preset",
    key: "this_month",
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const label = useMemo(() => getSelectionLabel(selection), [selection]);
  const resolvedRange = useMemo(
    () => resolveRange(selection, new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [selection]
  );
  const { fromMs, toMs } = toQueryArgs(resolvedRange);

  const entries = useQuery(api.entries.listEntries, { startDate: fromMs, endDate: toMs, limit: 1200 }) as Entry[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .filter((entry) => entry.type !== "transfer")
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
  }, [entries]);

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "transfer") continue;
      if (e.type === "income") income += e.amountCents;
      else expense += e.amountCents;
    }

    const net = income - expense;
    return { income, expense, net };
  }, [entries]);

  const reviewCount = inbox?.length ?? 0;
  const reviewPreview = useMemo(() => (inbox ?? []).slice(0, 3), [inbox]);

  return (
    <div className="space-y-4 pb-4">
      {/* Header Card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-h1" style={{ color: "var(--text)" }}>Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--text)",
              }}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
            >
              <Lucide.Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
              <span className="max-w-[140px] truncate">{label}</span>
              <Lucide.ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              </div>
            </div>
          ) : (
            <>
              {/* Hero: Net Amount */}
              <div className="mb-4">
                <div className="text-micro mb-1" style={{ color: "var(--text-secondary)" }}>
                  {label} Net
                </div>
                <div
                  className="text-kpi tabular-nums"
                  style={{ color: computed.net >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {formatMoney(computed.net, { signMode: "always" })}
                </div>
              </div>

              {/* Income / Expense Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-3"
                  style={{ backgroundColor: "var(--success-subtle)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                    <span className="text-micro font-medium" style={{ color: "var(--success)" }}>
                      Income
                    </span>
                  </div>
                  <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {formatMoney(computed.income)}
                  </div>
                </div>

                <div
                  className="rounded-xl p-3"
                  style={{ backgroundColor: "var(--danger-subtle)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--danger)" }} />
                    <span className="text-micro font-medium" style={{ color: "var(--danger)" }}>
                      Expenses
                    </span>
                  </div>
                  <div className="text-body font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {formatMoney(computed.expense)}
                  </div>
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </div>

      {/* Review Alert */}
      <SignedIn>
        {reviewCount > 0 && (
          <button
            onClick={() => setActiveTab("activity")}
            className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-colors"
            style={{
              backgroundColor: "var(--warning-subtle)",
              border: "1px solid var(--warning)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--warning)" }}
            >
              <Lucide.Inbox className="h-5 w-5" style={{ color: "#fff" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                Needs meaning
              </div>
              <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                {reviewCount} transaction{reviewCount !== 1 ? "s" : ""} to resolve
              </div>
              <div className="mt-2 space-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {reviewPreview.map((entry: any) => (
                  <div key={entry._id} className="truncate">
                    {entry.merchant || entry.note || entry.category || entry.bucket || "Untitled"}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] font-semibold" style={{ color: "var(--warning)" }}>
                Resolve now
              </div>
            </div>
            <Lucide.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
          </button>
        )}
      </SignedIn>

      {/* Quick Actions */}
      <SignedIn>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActiveTab("budgeting")}
            className="rounded-xl p-4 text-left transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <Lucide.Wallet className="h-6 w-6 mb-2" style={{ color: "var(--primary)" }} />
            <div className="text-body font-medium" style={{ color: "var(--text)" }}>
              Budgets
            </div>
            <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
              Track spending
            </div>
          </button>

          <button
            onClick={() => setActiveTab("goals")}
            className="rounded-xl p-4 text-left transition-colors"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <Lucide.Target className="h-6 w-6 mb-2" style={{ color: "var(--success)" }} />
            <div className="text-body font-medium" style={{ color: "var(--text)" }}>
              Goals
            </div>
            <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
              Save smarter
            </div>
          </button>
        </div>
      </SignedIn>

      {/* Recent Transactions */}
      <SignedIn>
        {entries && entries.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-h2" style={{ color: "var(--text)" }}>
                Recent
              </h2>
              <button
                onClick={() => setActiveTab("activity")}
                className="text-meta font-medium"
                style={{ color: "var(--primary)" }}
              >
                View all
              </button>
            </div>

            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <button
                  key={entry._id}
                  onClick={() => setEditingEntry(entry)}
                  className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: entry.type === "income" ? "var(--success-subtle)" : "var(--surface-2)",
                    }}
                  >
                    {entry.type === "income" ? (
                      <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                    ) : (
                      <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-body font-medium truncate" style={{ color: "var(--text)" }}>
                      {entry.category || entry.bucket || entry.note || "Uncategorized"}
                    </div>
                    <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div
                    className="text-body font-medium tabular-nums"
                    style={{ color: entry.type === "income" ? "var(--success)" : "var(--text)" }}
                  >
                    {entry.type === "income" ? "+" : "-"}{centsToDollars(entry.amountCents)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </SignedIn>

      <TimeRangePickerModal
        open={pickerOpen}
        selection={selection}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => {
          setSelection(next);
          setPickerOpen(false);
        }}
      />

      {/* Edit Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry as any}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
