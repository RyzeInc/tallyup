"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { formatMoney } from "@/components/utils";
import * as Lucide from "lucide-react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ToastProvider";

/**
 * Accounts Management Page
 * 
 * Features:
 * - List all accounts (checking, savings, credit cards, etc.)
 * - Create new accounts
 * - Edit account details
 * - Update balances
 * - Hide/close accounts
 */

type AccountType = "checking" | "savings" | "credit_card" | "investment" | "loan" | "cash" | "manual";
type AccountStatus = "active" | "hidden" | "closed";
type Ownership = "personal" | "shared" | "business";
type BackendAccount = Doc<"accounts">;
type BackendAccountType = BackendAccount["type"];

interface Account {
  _id: Id<"accounts">;
  name: string;
  accountType: AccountType;
  institution?: string;
  balanceCurrentCents?: number;
  balanceAvailableCents?: number;
  balanceAsOf?: number;
  currency?: string;
  ownership?: Ownership;
  status: AccountStatus;
  creditLimitCents?: number;
  interestRatePercent?: number;
  icon?: string;
  color?: string;
  displayOrder?: number;
  excludeFromNetWorth?: boolean;
}

const ACCOUNT_TYPE_CONFIG: Record<AccountType, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  checking: { label: "Checking", icon: Lucide.Landmark, color: "#2F6F85" },
  savings: { label: "Savings", icon: Lucide.PiggyBank, color: "#10B981" },
  credit_card: { label: "Credit Card", icon: Lucide.CreditCard, color: "#F59E0B" },
  investment: { label: "Investment", icon: Lucide.TrendingUp, color: "#6F9EA8" },
  loan: { label: "Loan", icon: Lucide.Percent, color: "#EF4444" },
  cash: { label: "Cash", icon: Lucide.Banknote, color: "#84CC16" },
  manual: { label: "Manual", icon: Lucide.Edit3, color: "#8B5CF6" },
};

const OWNERSHIP_OPTIONS: { value: Ownership; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "shared", label: "Shared" },
  { value: "business", label: "Business" },
];

const ACCOUNT_TYPE_TO_BACKEND: Record<AccountType, BackendAccountType> = {
  checking: "checking",
  savings: "savings",
  credit_card: "credit",
  investment: "investment",
  loan: "loan",
  cash: "other",
  manual: "other",
};

const BACKEND_TO_ACCOUNT_TYPE: Record<BackendAccountType, AccountType> = {
  checking: "checking",
  savings: "savings",
  credit: "credit_card",
  investment: "investment",
  loan: "loan",
  business: "manual",
  other: "manual",
};

function mapBackendAccount(account: BackendAccount): Account {
  return {
    _id: account._id,
    name: account.name,
    accountType: BACKEND_TO_ACCOUNT_TYPE[account.type],
    institution: account.institutionName,
    balanceCurrentCents: undefined,
    balanceAvailableCents: undefined,
    balanceAsOf: undefined,
    currency: undefined,
    ownership: "personal",
    status: account.isArchived ? "closed" : "active",
    creditLimitCents: account.creditLimit,
    interestRatePercent: account.interestRate,
    icon: undefined,
    color: undefined,
    displayOrder: undefined,
    excludeFromNetWorth: false,
  };
}

export default function AccountsPage() {
  const toast = useToast();
  const [showHidden, setShowHidden] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Queries
  const rawAccounts = useQuery(api.accounts.listAccounts, {
    includeArchived: showHidden || showClosed,
  }) as BackendAccount[] | undefined;

  const accounts = useMemo(
    () => (rawAccounts ?? []).map(mapBackendAccount),
    [rawAccounts]
  );

  // Plaid queries
  const plaidItems = useQuery(api.plaid.listPlaidItems);
  const pendingTransactions = useQuery(api.plaid.listPendingTransactions, { limit: 100 });
  const linkedCount = plaidItems?.length ?? 0;
  const pendingCount = pendingTransactions?.length ?? 0;

  // Mutations
  const createAccount = useMutation(api.accounts.createAccount);
  const updateAccount = useMutation(api.accounts.updateAccount);
  const deleteAccount = useMutation(api.accounts.deleteAccount);
  const addSnapshot = useMutation(api.accounts.addAccountSnapshot);
  const [deleting, setDeleting] = useState(false);

  function errorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return undefined;
  }

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<AccountType>("checking");
  const [createInstitution, setCreateInstitution] = useState("");
  const [createBalance, setCreateBalance] = useState("");
  const [createOwnership, setCreateOwnership] = useState<Ownership>("personal");
  const [createCreditLimit, setCreateCreditLimit] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editOwnership, setEditOwnership] = useState<Ownership>("personal");
  const [editStatus, setEditStatus] = useState<AccountStatus>("active");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editExcludeFromNetWorth, setEditExcludeFromNetWorth] = useState(false);
  const [saving, setSaving] = useState(false);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    if (!accounts) return {};
    const groups: Record<AccountType, Account[]> = {
      checking: [],
      savings: [],
      credit_card: [],
      investment: [],
      loan: [],
      cash: [],
      manual: [],
    };
    for (const acc of accounts) {
      groups[acc.accountType].push(acc);
    }
    return groups;
  }, [accounts]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!accounts) return { assets: 0, liabilities: 0, netWorth: 0 };
    let assets = 0;
    let liabilities = 0;
    for (const acc of accounts) {
      if (acc.excludeFromNetWorth || acc.status !== "active") continue;
      const balance = acc.balanceCurrentCents ?? 0;
      if (acc.accountType === "credit_card" || acc.accountType === "loan") {
        liabilities += Math.abs(balance);
      } else {
        assets += balance;
      }
    }
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [accounts]);

  function resetCreateForm() {
    setCreateName("");
    setCreateType("checking");
    setCreateInstitution("");
    setCreateBalance("");
    setCreateOwnership("personal");
    setCreateCreditLimit("");
  }

  function openEdit(account: Account) {
    setEditingAccount(account);
    setEditName(account.name);
    setEditInstitution(account.institution ?? "");
    setEditBalance(account.balanceCurrentCents ? (account.balanceCurrentCents / 100).toFixed(2) : "");
    setEditOwnership(account.ownership ?? "personal");
    setEditStatus(account.status);
    setEditCreditLimit(account.creditLimitCents ? (account.creditLimitCents / 100).toFixed(2) : "");
    setEditExcludeFromNetWorth(account.excludeFromNetWorth ?? false);
  }

  async function handleCreate() {
    if (!createName.trim()) {
      toast.error("Account name is required");
      return;
    }
    setCreating(true);
    try {
      const balanceCents = createBalance ? Math.round(parseFloat(createBalance) * 100) : 0;
      const creditLimitCents = createCreditLimit ? Math.round(parseFloat(createCreditLimit) * 100) : undefined;
      await createAccount({
        name: createName.trim(),
        type: ACCOUNT_TYPE_TO_BACKEND[createType],
        institutionName: createInstitution.trim() || undefined,
        creditLimit: creditLimitCents,
        initialBalance: balanceCents,
      });
      toast.success("Account created");
      setShowCreate(false);
      resetCreateForm();
    } catch (e: unknown) {
      toast.error("Failed to create account", { description: errorMessage(e) });
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingAccount) return;
    setSaving(true);
    try {
      const balanceCents = editBalance ? Math.round(parseFloat(editBalance) * 100) : undefined;
      const creditLimitCents = editCreditLimit ? Math.round(parseFloat(editCreditLimit) * 100) : undefined;
      await updateAccount({
        id: editingAccount._id,
        name: editName.trim() || undefined,
        institutionName: editInstitution.trim() || undefined,
        creditLimit: creditLimitCents,
        isArchived: editStatus !== "active",
      });
      if (balanceCents !== undefined) {
        await addSnapshot({ accountId: editingAccount._id, balance: balanceCents });
      }
      toast.success("Account updated");
      setEditingAccount(null);
    } catch (e: unknown) {
      toast.error("Failed to update account", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Accounts"
        subtitle="Manage your financial accounts"
        rightSlot={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            <Lucide.Plus className="h-4 w-4" />
            Add Account
          </button>
        }
      />

      <SignedOut>
        <EmptyState
          icon={<Lucide.LogIn className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Sign in to manage accounts"
          subtitle="Track your bank accounts, credit cards, and more."
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
        {/* Net Worth Summary */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
            Net Worth
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold" style={{ color: "var(--text)" }}>
              {formatMoney(totals.netWorth)}
            </span>
          </div>
          <div className="flex gap-4 mt-3 text-sm">
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Assets: </span>
              <span style={{ color: "var(--success)" }}>{formatMoney(totals.assets)}</span>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)" }}>Liabilities: </span>
              <span style={{ color: "var(--danger)" }}>{formatMoney(totals.liabilities)}</span>
            </div>
          </div>
        </div>

        {/* Plaid Link Banner */}
        <Link
          href="/accounts/link"
          className="block rounded-2xl p-4 transition-colors hover:opacity-95"
          style={{ 
            backgroundColor: linkedCount > 0 ? "var(--surface)" : "var(--primary-subtle)", 
            border: "1px solid var(--border)" 
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: linkedCount > 0 ? "var(--primary-subtle)" : "var(--primary)", opacity: linkedCount > 0 ? 1 : 0.9 }}
              >
                <Lucide.Link2 className="h-5 w-5" style={{ color: linkedCount > 0 ? "var(--primary)" : "var(--on-primary)" }} />
              </div>
              <div>
                <p className="font-medium" style={{ color: "var(--text)" }}>
                  {linkedCount > 0 ? `${linkedCount} Connected Institution${linkedCount !== 1 ? "s" : ""}` : "Connect Your Bank"}
                </p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {linkedCount > 0 
                    ? pendingCount > 0 
                      ? `${pendingCount} pending transaction${pendingCount !== 1 ? "s" : ""} to review`
                      : "Accounts synced automatically"
                    : "Link accounts to auto-import transactions"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span 
                  className="px-2 py-1 text-xs font-medium rounded-full"
                  style={{ backgroundColor: "var(--warning)", color: "var(--on-warning, #000)" }}
                >
                  {pendingCount}
                </span>
              )}
              <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
            </div>
          </div>
        </Link>

        {/* Filter toggles */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showHidden ? "ring-2 ring-offset-1" : ""
            }`}
            style={{
              backgroundColor: showHidden ? "var(--primary-subtle)" : "var(--surface-2)",
              color: showHidden ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            <Lucide.EyeOff className="h-3 w-3 inline mr-1" />
            Show Hidden
          </button>
          <button
            onClick={() => setShowClosed(!showClosed)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showClosed ? "ring-2 ring-offset-1" : ""
            }`}
            style={{
              backgroundColor: showClosed ? "var(--primary-subtle)" : "var(--surface-2)",
              color: showClosed ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            <Lucide.Archive className="h-3 w-3 inline mr-1" />
            Show Closed
          </button>
        </div>

        {/* Account Groups */}
        {accounts && accounts.length === 0 ? (
          <EmptyState
            icon={<Lucide.Landmark className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
            title="No accounts yet"
            subtitle="Add your first account to start tracking balances."
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                Add Account
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {(Object.entries(groupedAccounts) as [AccountType, Account[]][])
              .filter(([, accs]) => accs.length > 0)
              .map(([type, accs]) => {
                const config = ACCOUNT_TYPE_CONFIG[type];
                const Icon = config.icon;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        {config.label}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {accs.map((acc) => (
                        <button
                          key={acc._id}
                          onClick={() => openEdit(acc)}
                          className="w-full text-left rounded-xl p-4 transition-colors hover:opacity-90"
                          style={{
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--border)",
                            opacity: acc.status !== "active" ? 0.6 : 1,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium" style={{ color: "var(--text)" }}>
                                  {acc.name}
                                </span>
                                {acc.status === "hidden" && (
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-tertiary)" }}>
                                    Hidden
                                  </span>
                                )}
                                {acc.status === "closed" && (
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}>
                                    Closed
                                  </span>
                                )}
                              </div>
                              {acc.institution && (
                                <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                                  {acc.institution}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div
                                className="font-semibold"
                                style={{
                                  color: acc.accountType === "credit_card" || acc.accountType === "loan"
                                    ? "var(--danger)"
                                    : "var(--text)",
                                }}
                              >
                                {formatMoney(acc.balanceCurrentCents ?? 0)}
                              </div>
                              {acc.balanceAsOf && (
                                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                  as of {new Date(acc.balanceAsOf).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
            <div
              className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  Add Account
                </h2>
                <button onClick={() => setShowCreate(false)}>
                  <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g., Chase Checking"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Account Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(ACCOUNT_TYPE_CONFIG) as [AccountType, typeof ACCOUNT_TYPE_CONFIG[AccountType]][]).map(
                      ([type, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => setCreateType(type)}
                            className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                              createType === type ? "ring-2" : ""
                            }`}
                            style={{
                              backgroundColor: createType === type ? "var(--primary-subtle)" : "var(--surface-2)",
                              color: createType === type ? "var(--primary)" : "var(--text-secondary)",
                            }}
                          >
                            <Icon className="h-4 w-4" style={{ color: config.color }} />
                            {config.label}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Institution */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Institution
                  </label>
                  <input
                    type="text"
                    value={createInstitution}
                    onChange={(e) => setCreateInstitution(e.target.value)}
                    placeholder="e.g., Chase, Bank of America"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                {/* Current Balance */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Current Balance
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={createBalance}
                      onChange={(e) => setCreateBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                {/* Credit Limit (for credit cards) */}
                {createType === "credit_card" && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Credit Limit
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={createCreditLimit}
                        onChange={(e) => setCreateCreditLimit(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                      />
                    </div>
                  </div>
                )}

                {/* Ownership */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Ownership
                  </label>
                  <div className="flex gap-2">
                    {OWNERSHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setCreateOwnership(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          createOwnership === opt.value ? "ring-2" : ""
                        }`}
                        style={{
                          backgroundColor: createOwnership === opt.value ? "var(--primary-subtle)" : "var(--surface-2)",
                          color: createOwnership === opt.value ? "var(--primary)" : "var(--text-secondary)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !createName.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                  >
                    {creating ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingAccount && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditingAccount(null)} />
            <div
              className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  Edit Account
                </h2>
                <button onClick={() => setEditingAccount(null)}>
                  <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                {/* Institution */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Institution
                  </label>
                  <input
                    type="text"
                    value={editInstitution}
                    onChange={(e) => setEditInstitution(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                {/* Current Balance */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Current Balance
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                {/* Credit Limit (for credit cards) */}
                {editingAccount.accountType === "credit_card" && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Credit Limit
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={editCreditLimit}
                        onChange={(e) => setEditCreditLimit(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                      />
                    </div>
                  </div>
                )}

                {/* Ownership */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Ownership
                  </label>
                  <div className="flex gap-2">
                    {OWNERSHIP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEditOwnership(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          editOwnership === opt.value ? "ring-2" : ""
                        }`}
                        style={{
                          backgroundColor: editOwnership === opt.value ? "var(--primary-subtle)" : "var(--surface-2)",
                          color: editOwnership === opt.value ? "var(--primary)" : "var(--text-secondary)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Status
                  </label>
                  <div className="flex gap-2">
                    {(["active", "hidden", "closed"] as AccountStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => setEditStatus(status)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                          editStatus === status ? "ring-2" : ""
                        }`}
                        style={{
                          backgroundColor: editStatus === status ? "var(--primary-subtle)" : "var(--surface-2)",
                          color: editStatus === status ? "var(--primary)" : "var(--text-secondary)",
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exclude from Net Worth */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editExcludeFromNetWorth}
                    onChange={(e) => setEditExcludeFromNetWorth(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Exclude from net worth calculations
                  </span>
                </label>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setEditingAccount(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>

                {/* Delete Account */}
                <div className="pt-4 mt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={async () => {
                      if (!editingAccount) return;
                      if (!confirm(`Are you sure you want to delete "${editingAccount.name}"? This cannot be undone.`)) return;
                      setDeleting(true);
                      try {
                        await deleteAccount({ id: editingAccount._id });
                        toast.success("Account deleted");
                        setEditingAccount(null);
                      } catch (e: unknown) {
                        toast.error("Failed to delete account", { description: errorMessage(e) });
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
                  >
                    {deleting ? "Deleting..." : "Delete Account"}
                  </button>
                  <p className="text-xs text-center mt-2" style={{ color: "var(--text-tertiary)" }}>
                    Only accounts without transactions can be deleted. Plaid-linked accounts must be unlinked first.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}
