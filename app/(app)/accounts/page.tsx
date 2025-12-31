"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { formatMoney } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import TimeRangeControl from "@/components/TimeRangeControl";
import { useTimeRange } from "@/components/TimeRangeProvider";
import { toQueryArgs } from "@/src/lib/timeRange/toQueryArgs";

type AccountType =
  | "credit"
  | "checking"
  | "savings"
  | "investment"
  | "loan"
  | "business"
  | "other";

interface AccountSnapshot {
  balance: number;
  asOf: number;
}

interface AccountRow {
  _id: Id<"accounts">;
  name: string;
  type: AccountType;
  institutionName?: string;
  logoKey?: string;
  last4?: string;
  creditLimit?: number;
  showInTransactionSelector?: boolean;
  latestSnapshot?: AccountSnapshot | null;
  changePct?: number | null;
}

const SECTION_ORDER: {
  key: AccountType;
  title: string;
  addLabel: string;
  emptyLabel: string;
}[] = [
  { key: "credit", title: "Credit", addLabel: "Credit", emptyLabel: "No accounts yet" },
  { key: "checking", title: "Checking", addLabel: "Checking", emptyLabel: "No accounts yet" },
  { key: "savings", title: "Savings", addLabel: "Savings", emptyLabel: "No accounts yet" },
  { key: "investment", title: "Investments", addLabel: "Investments", emptyLabel: "No accounts yet" },
  { key: "loan", title: "Loans & Debt", addLabel: "Loan", emptyLabel: "No accounts yet" },
  { key: "business", title: "Business Accounts", addLabel: "Business", emptyLabel: "No accounts yet" },
  { key: "other", title: "Other", addLabel: "Other", emptyLabel: "No accounts yet" },
];

const TYPE_LABELS: Record<AccountType, string> = {
  credit: "Balance",
  checking: "Available",
  savings: "Available",
  investment: "Current",
  loan: "Owed",
  business: "Available",
  other: "Balance",
};

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function daysAgo(ts?: number | null) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function getMonogram(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "A";
  return trimmed.slice(0, 2).toUpperCase();
}

export default function AccountsPage() {
  const toast = useToast();
  const { resolvedRange } = useTimeRange();
  const { fromMs, toMs } = toQueryArgs(resolvedRange);
  const [openSections, setOpenSections] = useState<Record<AccountType, boolean>>({
    credit: true,
    checking: true,
    savings: true,
    investment: true,
    loan: true,
    business: true,
    other: true,
  });
  const [showUpdateSheet, setShowUpdateSheet] = useState(false);

  const overview = useQuery(api.accounts.getAccountsOverview, {
    startDate: fromMs,
    endDate: toMs,
  }) as { accounts: AccountRow[]; totals: any } | undefined;

  const accounts = overview?.accounts ?? [];
  const totals = overview?.totals;

  const grouped = useMemo(() => {
    const next: Record<AccountType, AccountRow[]> = {
      credit: [],
      checking: [],
      savings: [],
      investment: [],
      loan: [],
      business: [],
      other: [],
    };
    for (const account of accounts) {
      next[account.type].push(account);
    }
    return next;
  }, [accounts]);

  const handleToggleSection = (type: AccountType) => {
    setOpenSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Accounts"
        subtitle="Balances stay manual-first and always in sync."
        rightSlot={
          <div className="flex items-center gap-2">
            <TimeRangeControl />
            <button
              onClick={() => setShowUpdateSheet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            >
              <Lucide.RefreshCw className="h-4 w-4" />
              Update
            </button>
            <Link
              href="/accounts/add"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
            >
              <Lucide.Plus className="h-4 w-4" />
              Add
            </Link>
          </div>
        }
      />

      <SignedOut>
        <EmptyState
          icon={<Lucide.LogIn className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Sign in to manage accounts"
          subtitle="Track balances manually while staying ready for future integrations."
          action={
            <SignInButton mode="modal">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                Sign in
              </button>
            </SignInButton>
          }
        />
      </SignedOut>

      <SignedIn>
        {/* Overview Card */}
        <div className="rounded-2xl p-4 space-y-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Net Worth
              </div>
              <div className="text-3xl font-bold mt-1" style={{ color: "var(--text)" }}>
                {formatMoney(totals?.netWorth ?? 0)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                As of {totals?.asOf ? new Date(totals.asOf).toLocaleString() : "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                Assets
              </div>
              <div className="text-xl font-semibold mt-1" style={{ color: "var(--success)" }}>
                {formatMoney(totals?.assets ?? 0)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                {formatPercent(totals?.assetsChangePct)}
                {totals?.assetsChangePct === null && (
                  <span className="ml-2" style={{ color: "var(--text-tertiary)" }}>
                    Add another update to see change.
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                Debt
              </div>
              <div className="text-xl font-semibold mt-1" style={{ color: "var(--danger)" }}>
                {formatMoney(totals?.debt ?? 0)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                {formatPercent(totals?.debtChangePct)}
                {totals?.debtChangePct === null && (
                  <span className="ml-2" style={{ color: "var(--text-tertiary)" }}>
                    Add another update to see change.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTION_ORDER.map((section) => {
            const sectionAccounts = grouped[section.key] ?? [];
            const sectionTotal = sectionAccounts.reduce((sum, account) => {
              const balance = account.latestSnapshot?.balance ?? 0;
              const value = section.key === "credit" || section.key === "loan" ? Math.abs(balance) : balance;
              return sum + value;
            }, 0);

            const isOpen = openSections[section.key];

            return (
              <div key={section.key} className="rounded-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => handleToggleSection(section.key)}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <Lucide.ChevronDown className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                    ) : (
                      <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                    )}
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {section.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {formatMoney(sectionTotal)}
                    </span>
                    <Link
                      href={`/accounts/add?type=${section.key}`}
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      Add
                    </Link>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {sectionAccounts.length === 0 ? (
                      <div
                        className="border border-dashed rounded-xl p-4 text-center"
                        style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                      >
                        <div className="text-sm font-medium mb-2">{section.emptyLabel}</div>
                        <Link
                          href={`/accounts/add?type=${section.key}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                        >
                          <Lucide.Plus className="h-3 w-3" />
                          Add {section.addLabel}
                        </Link>
                      </div>
                    ) : (
                      sectionAccounts.map((account) => (
                        <AccountCard key={account._id} account={account} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SignedIn>

      {showUpdateSheet && (
        <UpdateBalancesSheet
          accounts={accounts}
          grouped={grouped}
          onClose={() => setShowUpdateSheet(false)}
          toast={toast}
        />
      )}
    </div>
  );
}

function AccountCard({ account }: { account: AccountRow }) {
  const latest = account.latestSnapshot;
  const balance = latest?.balance ?? null;
  const days = daysAgo(latest?.asOf);
  const isDebt = account.type === "credit" || account.type === "loan";
  const staleThreshold = account.type === "credit" || account.type === "checking" || account.type === "investment" ? 7 : 30;
  const isStale = days !== null && days > staleThreshold;
  const subLabel = account.institutionName || account.last4 ? [account.institutionName, account.last4].filter(Boolean).join(" • ") : null;

  const utilization = account.type === "credit" && account.creditLimit && balance !== null
    ? Math.round((Math.abs(balance) / account.creditLimit) * 100)
    : null;

  return (
    <Link
      href={`/accounts/${account._id}`}
      className="block rounded-xl p-3 transition-colors"
      style={{
        backgroundColor: isStale ? "var(--warning-subtle)" : "var(--surface-2)",
        border: `1px solid ${isStale ? "var(--warning-subtle)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="relative h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {account.logoKey && (
              <img
                src={account.logoKey}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {getMonogram(account.institutionName ?? account.name)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
              {account.name}
            </div>
            {subLabel && (
              <div className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                {subLabel}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {TYPE_LABELS[account.type]}
          </div>
          <div className="text-sm font-semibold" style={{ color: isDebt ? "var(--danger)" : "var(--text)" }}>
            {balance === null ? "—" : formatMoney(balance)}
          </div>
        </div>
        <div className="text-right min-w-[72px]">
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {account.type === "credit" ? "Utilized" : "Change"}
          </div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {account.type === "credit"
              ? utilization !== null ? `${utilization}%` : "—"
              : formatPercent(account.changePct)}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs" style={{ color: isStale ? "var(--warning)" : "var(--text-tertiary)" }}>
        Updated {days ?? 0} days ago
      </div>
    </Link>
  );
}

function UpdateBalancesSheet({
  accounts,
  grouped,
  onClose,
  toast,
}: {
  accounts: AccountRow[];
  grouped: Record<AccountType, AccountRow[]>;
  onClose: () => void;
  toast: any;
}) {
  const addSnapshots = useMutation(api.accounts.addAccountSnapshots);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const orderedAccounts = useMemo(() => {
    const all: AccountRow[] = [];
    SECTION_ORDER.forEach((section) => {
      all.push(...(grouped[section.key] ?? []));
    });
    return all;
  }, [grouped]);

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const focusNext = (currentId: string) => {
    const index = orderedAccounts.findIndex((acc) => acc._id === currentId);
    if (index === -1) return;
    const next = orderedAccounts[index + 1];
    if (next) {
      inputRefs.current[next._id]?.focus();
    }
  };

  const handleSave = async () => {
    const updates = orderedAccounts
      .map((acc) => {
        const raw = values[acc._id] ?? "";
        if (!raw.trim()) return null;
        const nextValue = Math.round(parseFloat(raw) * 100);
        if (!Number.isFinite(nextValue)) return null;
        if (acc.latestSnapshot?.balance === nextValue) return null;
        return { accountId: acc._id, balance: nextValue };
      })
      .filter(Boolean) as { accountId: Id<"accounts">; balance: number }[];

    if (updates.length === 0) {
      toast.error("Enter at least one balance");
      return;
    }

    setSaving(true);
    try {
      await addSnapshots({ updates, asOf: Date.now() });
      toast.success("Balances updated");
      onClose();
    } catch (e: any) {
      toast.error("Failed to update balances", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              Update Balances
            </h2>
            <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              One timestamp applies to all edited rows.
            </div>
          </div>
          <button onClick={onClose}>
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="space-y-4">
          {SECTION_ORDER.map((section) => {
            const sectionAccounts = grouped[section.key] ?? [];
            if (sectionAccounts.length === 0) return null;
            return (
              <div key={section.key} className="space-y-2">
                <div className="text-xs font-semibold uppercase" style={{ color: "var(--text-tertiary)" }}>
                  {section.title}
                </div>
                {sectionAccounts.map((account) => {
                  const updatedAt = account.latestSnapshot?.asOf;
                  return (
                    <div
                      key={account._id}
                      className="flex items-center gap-3 rounded-xl p-3"
                      style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="relative h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                        >
                          {account.logoKey && (
                            <img
                              src={account.logoKey}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                            {getMonogram(account.institutionName ?? account.name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                            {account.name}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            Last updated {updatedAt ? new Date(updatedAt).toLocaleDateString() : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="w-32">
                        <input
                          ref={(el) => {
                            inputRefs.current[account._id] = el;
                          }}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={values[account._id] ?? ""}
                          onChange={(e) => handleChange(account._id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              focusNext(account._id);
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg text-sm"
                          style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            {saving ? "Saving..." : "Save updates"}
          </button>
        </div>
      </div>
    </div>
  );
}
