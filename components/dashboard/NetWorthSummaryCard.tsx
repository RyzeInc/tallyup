"use client";

import * as React from "react";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";

export interface AccountBalance {
  id: string;
  name: string;
  type: string;
  balanceCents: number;
  creditLimitCents?: number;
  availableCreditCents?: number;
}

export interface NetWorthData {
  balances: AccountBalance[];
  totalCashCents: number;
  totalCreditAvailableCents: number;
  totalDebtCents: number;
}

export interface NetWorthSummaryCardProps {
  data: NetWorthData | null;
  isLoading?: boolean;
  /** If true, shows expanded breakdown */
  expanded?: boolean;
  onToggleExpand?: () => void;
  onManageAccounts?: () => void;
}

/** Icon mapping for account types */
const ACCOUNT_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  checking: Lucide.Wallet,
  savings: Lucide.PiggyBank,
  credit: Lucide.CreditCard,
  investment: Lucide.TrendingUp,
  loan: Lucide.FileText,
  business: Lucide.Briefcase,
  other: Lucide.Landmark,
};

/**
 * NetWorthSummaryCard - Shows overall net worth with account breakdown
 * 
 * Displays: Assets - Liabilities = Net Worth
 * Similar to Copilot's net worth card at the top of their dashboard.
 */
export function NetWorthSummaryCard({
  data,
  isLoading = false,
  expanded = false,
  onToggleExpand,
  onManageAccounts,
}: NetWorthSummaryCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
            <div className="h-6 w-28 rounded animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.balances.length === 0) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lucide.Landmark className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Link accounts to see your net worth
            </span>
          </div>
          {onManageAccounts && (
            <button
              onClick={onManageAccounts}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ 
                backgroundColor: "var(--primary-subtle)", 
                color: "var(--primary)" 
              }}
            >
              Add accounts
            </button>
          )}
        </div>
      </div>
    );
  }

  const { totalCashCents, totalDebtCents, balances } = data;
  const netWorth = totalCashCents - totalDebtCents;
  const isPositive = netWorth >= 0;

  // Group accounts by type
  const assetAccounts = balances.filter(a => 
    a.type === "checking" || a.type === "savings" || a.type === "investment"
  );
  const liabilityAccounts = balances.filter(a => 
    a.type === "credit" || a.type === "loan"
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Main section - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
        disabled={!onToggleExpand}
      >
        <div className="flex items-center gap-4">
          {/* Net worth icon */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ 
              backgroundColor: isPositive ? "var(--success-subtle)" : "var(--danger-subtle)" 
            }}
          >
            <Lucide.Landmark 
              className="h-5 w-5" 
              style={{ color: isPositive ? "var(--success)" : "var(--danger)" }} 
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              Net Worth
            </div>
            <div
              className="text-xl font-bold tabular-nums"
              style={{ color: isPositive ? "var(--success)" : "var(--danger)" }}
            >
              {formatMoney(netWorth, { signMode: netWorth < 0 ? "always" : "never" })}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>{balances.length} account{balances.length !== 1 ? "s" : ""}</span>
              {totalDebtCents > 0 && (
                <>
                  <span>•</span>
                  <span className="tabular-nums" style={{ color: "var(--danger)" }}>
                    {formatMoney(totalDebtCents, { compact: true })} debt
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Expand indicator */}
          {onToggleExpand && (
            <Lucide.ChevronDown
              className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
              style={{ color: "var(--text-tertiary)" }}
            />
          )}
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Assets section */}
          {assetAccounts.length > 0 && (
            <div className="pt-3">
              <div className="text-xs font-medium mb-2" style={{ color: "var(--success)" }}>
                Assets
              </div>
              <div className="space-y-2">
                {assetAccounts.map((account) => {
                  const Icon = ACCOUNT_ICONS[account.type] ?? Lucide.Landmark;
                  return (
                    <div key={account.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm truncate max-w-[160px]" style={{ color: "var(--text)" }}>
                          {account.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums" style={{ color: "var(--success)" }}>
                        {formatMoney(account.balanceCents)}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Total Assets
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--success)" }}>
                    {formatMoney(totalCashCents)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Liabilities section */}
          {liabilityAccounts.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--danger)" }}>
                Liabilities
              </div>
              <div className="space-y-2">
                {liabilityAccounts.map((account) => {
                  const Icon = ACCOUNT_ICONS[account.type] ?? Lucide.FileText;
                  return (
                    <div key={account.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm truncate max-w-[160px]" style={{ color: "var(--text)" }}>
                          {account.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums" style={{ color: "var(--danger)" }}>
                        {formatMoney(Math.abs(account.balanceCents))}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Total Liabilities
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--danger)" }}>
                    {formatMoney(totalDebtCents)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Net worth summary */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ backgroundColor: isPositive ? "var(--success-subtle)" : "var(--danger-subtle)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Net Worth
            </span>
            <span 
              className="text-lg font-bold tabular-nums"
              style={{ color: isPositive ? "var(--success)" : "var(--danger)" }}
            >
              {formatMoney(netWorth, { signMode: netWorth < 0 ? "always" : "never" })}
            </span>
          </div>

          {/* Manage accounts link */}
          {onManageAccounts && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManageAccounts();
              }}
              className="w-full py-2 text-xs font-medium text-center transition-colors hover:bg-[var(--surface-subtle)] rounded-lg"
              style={{ color: "var(--primary)" }}
            >
              Manage accounts
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default NetWorthSummaryCard;
