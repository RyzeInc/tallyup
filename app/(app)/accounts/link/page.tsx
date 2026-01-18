"use client";

/**
 * Link Accounts Page
 * 
 * Provides the Plaid Link flow for connecting external bank accounts.
 * This page handles:
 * - Initiating Plaid Link to connect new institutions
 * - Viewing and managing linked institutions
 * - Syncing transactions from linked accounts
 * - Importing pending transactions
 */

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ToastProvider";
import {
  PlaidLinkCard,
  LinkedAccountsList,
  PendingTransactionsList,
} from "@/components/plaid";

type TabId = "linked" | "pending" | "settings";

export default function LinkAccountsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("linked");
  const [refreshKey, setRefreshKey] = useState(0);
  
  const plaidItems = useQuery(api.plaid.listPlaidItems);
  const pendingTransactions = useQuery(api.plaid.listPendingTransactions, { limit: 100 });
  
  // Actions for auto-sync
  const syncTransactions = useAction(api.plaidActions.syncTransactions);
  const syncRecurringStreams = useAction(api.plaidActions.syncRecurringStreams);
  const syncInvestments = useAction(api.plaidActions.syncInvestments);
  const syncLiabilities = useAction(api.plaidActions.syncLiabilities);
  
  const pendingCount = pendingTransactions?.length ?? 0;
  const linkedCount = plaidItems?.length ?? 0;
  
  // Auto-sync all data after linking a new account
  const handleLinkSuccess = async (result: { institutionName: string; accountCount: number; plaidItemId: string }) => {
    setRefreshKey((k) => k + 1);
    setActiveTab("linked");
    
    // Auto-sync all data types
    const syncResults: string[] = [];
    
    try {
      // Sync transactions
      const txResult = await syncTransactions({ plaidItemId: result.plaidItemId as Id<"plaidItems"> });
      syncResults.push(`${txResult.added} transactions`);
      
      // Try to sync recurring streams
      try {
        const recurringResult = await syncRecurringStreams({ plaidItemId: result.plaidItemId as Id<"plaidItems"> });
        if ((recurringResult.totalCount ?? 0) > 0) {
          syncResults.push(`${recurringResult.totalCount} recurring patterns`);
        }
      } catch {
        console.info("Recurring streams not yet available (may need more transaction history)");
      }
      
      // Get the item to check available products
      const item = plaidItems?.find(i => i._id === result.plaidItemId);
      const products = item?.products || [];
      
      // Try investments if available
      if (products.includes("investments")) {
        try {
          const invResult = await syncInvestments({ plaidItemId: result.plaidItemId as Id<"plaidItems"> });
          if (invResult.holdingsCount && invResult.holdingsCount > 0) {
            syncResults.push(`${invResult.holdingsCount} holdings`);
          }
        } catch {
          console.info("Investments sync skipped");
        }
      }
      
      // Try liabilities if available
      if (products.includes("liabilities")) {
        try {
          const liabResult = await syncLiabilities({ plaidItemId: result.plaidItemId as Id<"plaidItems"> });
          if (liabResult.totalCount && liabResult.totalCount > 0) {
            syncResults.push(`${liabResult.totalCount} liabilities`);
          }
        } catch {
          console.info("Liabilities sync skipped");
        }
      }
      
      toast.success(`Synced ${syncResults.join(", ")} from ${result.institutionName}`);
    } catch (err) {
      console.error("Auto-sync error:", err);
      toast.error("Some data could not be synced. Try syncing manually from the accounts list.");
    }
  };
  
  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "linked", label: "Linked", icon: Lucide.Link2, count: linkedCount },
    { id: "pending", label: "Pending", icon: Lucide.Inbox, count: pendingCount },
    { id: "settings", label: "Settings", icon: Lucide.Settings2 },
  ];
  
  return (
    <div className="space-y-4 pb-4">
      {/* Header with back button */}
      <div className="flex items-start gap-3">
        <Link
          href="/accounts"
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 mt-0.5"
        >
          <Lucide.ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 
            className="text-h1 truncate"
            style={{ 
              color: "var(--text)",
              fontSize: "var(--text-h1)",
              fontWeight: "var(--text-h1-weight)",
              letterSpacing: "var(--text-h1-tracking)",
              lineHeight: 1.2,
            }}
          >
            Connect Accounts
          </h1>
          <p 
            className="text-meta mt-1 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            Link your bank accounts for automatic transaction syncing
          </p>
        </div>
      </div>
      
      <SignedOut>
        <EmptyState
          icon={<Lucide.Building2 className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Sign in to connect accounts"
          subtitle="Link your bank accounts to automatically import transactions."
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
        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${
                      isActive
                        ? "bg-[#2F6F85] text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === "linked" && (
            <div className="space-y-4">
              {/* Link New Account Card */}
              <PlaidLinkCard onSuccess={handleLinkSuccess} />
              
              {/* Linked Institutions */}
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Linked Institutions
                </h2>
                <LinkedAccountsList key={refreshKey} />
              </div>
            </div>
          )}
          
          {activeTab === "pending" && (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex gap-3">
                  <Lucide.Inbox className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">
                      Pending Transactions
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      These transactions have been fetched from your linked accounts
                      and are ready to be imported into TallyUp. Review and categorize
                      them before importing.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Pending Transactions List */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <PendingTransactionsList />
              </div>
            </div>
          )}
          
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Auto-sync Settings */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Sync Settings
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        Auto-sync transactions
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automatically fetch new transactions every 4 hours
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="sr-only peer"
                        id="auto-sync"
                      />
                      <label
                        htmlFor="auto-sync"
                        className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#2F6F85] cursor-pointer flex items-center peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        Auto-import transactions
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automatically import new transactions to your log
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        id="auto-import"
                      />
                      <label
                        htmlFor="auto-import"
                        className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#2F6F85] cursor-pointer flex items-center peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        Sync balance history
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Keep track of daily balance snapshots
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="sr-only peer"
                        id="sync-balance"
                      />
                      <label
                        htmlFor="sync-balance"
                        className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#2F6F85] cursor-pointer flex items-center peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Security Info */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <Lucide.Shield className="h-5 w-5 text-[#2F6F85] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Bank-Level Security
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Your bank credentials are never stored by TallyUp. We use Plaid,
                      a trusted financial data platform used by thousands of apps,
                      to securely connect to your accounts.
                    </p>
                    <a
                      href="https://plaid.com/safety/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[#2F6F85] hover:underline mt-2"
                    >
                      Learn more about Plaid security
                      <Lucide.ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
              
              {/* Help */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <Lucide.HelpCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Need Help?
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Having trouble connecting an account or seeing incorrect data?
                      Check our troubleshooting guide or contact support.
                    </p>
                    <Link
                      href="/help"
                      className="inline-flex items-center gap-1 text-sm text-[#2F6F85] hover:underline mt-2"
                    >
                      View Help Center
                      <Lucide.ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
