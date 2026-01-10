"use client";

/**
 * Linked Accounts List Component
 * 
 * Displays a list of Plaid-linked institutions and their accounts.
 */

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id, Doc } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { PlaidReauthButton } from "./PlaidLink";
import { useToast } from "@/components/ToastProvider";

// Account type icons
const ACCOUNT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  checking: Lucide.Landmark,
  savings: Lucide.PiggyBank,
  credit: Lucide.CreditCard,
  investment: Lucide.TrendingUp,
  loan: Lucide.Percent,
  other: Lucide.Building2,
};

// Format currency
function formatMoney(amount: number | undefined | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format relative time
function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return "Never";
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

interface LinkedInstitutionProps {
  item: {
    _id: Id<"plaidItems">;
    institutionName?: string;
    institutionLogo?: string;
    institutionColor?: string;
    status: "active" | "needs_reauth" | "revoked" | "error";
    lastSyncedAt?: number;
    errorMessage?: string;
  };
  accounts: Array<{
    _id: Id<"plaidAccounts">;
    name: string;
    officialName?: string;
    type: string;
    subtype?: string;
    mask?: string;
    balanceCurrent?: number;
    balanceAvailable?: number;
    balanceLimit?: number;
    isHidden: boolean;
    lastSyncedAt?: number;
  }>;
  onRefresh: () => void;
  onUnlink: () => void;
}

function LinkedInstitution({ item, accounts, onRefresh, onUnlink }: LinkedInstitutionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  
  const toast = useToast();
  const syncTransactions = useAction(api.plaidActions.syncTransactions);
  const refreshBalances = useAction(api.plaidActions.refreshBalances);
  const hideUnhidePlaidAccount = useMutation(api.plaid.hideUnhidePlaidAccount);
  const unlinkPlaidItem = useMutation(api.plaid.unlinkPlaidItem);
  
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTransactions({ plaidItemId: item._id });
      await refreshBalances({ plaidItemId: item._id });
      
      toast.success(`Synced ${result.added} new transaction(s)`);
      onRefresh();
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Failed to sync. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleUnlink = async () => {
    if (!confirm(`Are you sure you want to unlink ${item.institutionName || "this institution"}? Your transaction history will be preserved.`)) {
      return;
    }
    
    setIsUnlinking(true);
    try {
      await unlinkPlaidItem({ plaidItemId: item._id });
      toast.success(`Unlinked ${item.institutionName || "institution"}`);
      onUnlink();
    } catch (err) {
      console.error("Unlink error:", err);
      toast.error("Failed to unlink. Please try again.");
    } finally {
      setIsUnlinking(false);
    }
  };
  
  const handleToggleHide = async (accountId: Id<"plaidAccounts">, currentlyHidden: boolean) => {
    try {
      await hideUnhidePlaidAccount({
        plaidAccountId: accountId,
        isHidden: !currentlyHidden,
      });
    } catch (err) {
      console.error("Toggle hide error:", err);
      toast.error("Failed to update account visibility.");
    }
  };
  
  const needsReauth = item.status === "needs_reauth";
  const hasError = item.status === "error";
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Institution Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Institution Logo/Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: item.institutionColor || "#2F6F85",
          }}
        >
          {item.institutionLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${item.institutionLogo}`}
              alt=""
              className="w-6 h-6"
            />
          ) : (
            <Lucide.Building2 className="h-5 w-5 text-white" />
          )}
        </div>
        
        {/* Institution Name */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {item.institutionName || "Unknown Institution"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · 
            Last synced {formatRelativeTime(item.lastSyncedAt)}
          </p>
        </div>
        
        {/* Status Badge */}
        {needsReauth && (
          <PlaidReauthButton
            plaidItemId={item._id}
            institutionName={item.institutionName}
            onSuccess={onRefresh}
          />
        )}
        
        {hasError && (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <Lucide.AlertCircle className="mr-1 h-3 w-3" />
            Error
          </span>
        )}
        
        {item.status === "active" && (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Lucide.Check className="mr-1 h-3 w-3" />
            Connected
          </span>
        )}
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSync();
            }}
            disabled={isSyncing || needsReauth}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
            title="Sync transactions"
          >
            <Lucide.RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUnlink();
            }}
            disabled={isUnlinking}
            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
            title="Unlink institution"
          >
            {isUnlinking ? (
              <Lucide.Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lucide.Trash2 className="h-4 w-4" />
            )}
          </button>
          
          {isExpanded ? (
            <Lucide.ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <Lucide.ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>
      
      {/* Error Message */}
      {item.errorMessage && (
        <div className="px-4 pb-2">
          <p className="text-xs text-red-600 dark:text-red-400">
            {item.errorMessage}
          </p>
        </div>
      )}
      
      {/* Accounts List */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {accounts.map((account) => {
            const IconComponent = ACCOUNT_ICONS[account.type] || Lucide.Building2;
            
            return (
              <div
                key={account._id}
                className={`px-4 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                  account.isHidden ? "opacity-50" : ""
                }`}
              >
                {/* Account Icon */}
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <IconComponent className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                
                {/* Account Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {account.name}
                    </p>
                    {account.mask && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ••••{account.mask}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {account.subtype || account.type}
                  </p>
                </div>
                
                {/* Balance */}
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {formatMoney(account.balanceCurrent)}
                  </p>
                  {account.balanceAvailable != null && account.balanceAvailable !== account.balanceCurrent && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatMoney(account.balanceAvailable)} available
                    </p>
                  )}
                </div>
                
                {/* Hide/Show Button */}
                <button
                  onClick={() => handleToggleHide(account._id, account.isHidden)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title={account.isHidden ? "Show account" : "Hide account"}
                >
                  {account.isHidden ? (
                    <Lucide.EyeOff className="h-4 w-4" />
                  ) : (
                    <Lucide.Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LinkedAccountsList() {
  const [, setRefreshKey] = useState(0);
  
  const plaidItems = useQuery(api.plaid.listPlaidItems);
  const plaidAccounts = useQuery(api.plaid.listPlaidAccounts, {});
  
  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };
  
  if (plaidItems === undefined || plaidAccounts === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Lucide.Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (plaidItems.length === 0) {
    return (
      <div className="text-center py-8">
        <Lucide.Building2 className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          No linked institutions yet
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Connect a bank account to get started
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {plaidItems.map((item: Doc<"plaidItems">) => {
        const itemAccounts = plaidAccounts.filter(
          (a: Doc<"plaidAccounts">) => a.plaidItemId === item._id
        );
        
        return (
          <LinkedInstitution
            key={item._id}
            item={item}
            accounts={itemAccounts}
            onRefresh={handleRefresh}
            onUnlink={handleRefresh}
          />
        );
      })}
    </div>
  );
}

export default LinkedAccountsList;
