"use client";

/**
 * Pending Transactions Component
 * 
 * Shows transactions fetched from Plaid that are pending import into TallyUp.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id, Doc } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { useToast } from "@/components/ToastProvider";

// Format currency
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface TransactionRowProps {
  transaction: Doc<"plaidTransactions">;
  isSelected: boolean;
  onToggleSelect: () => void;
  onImport: (category?: string, skipImport?: boolean) => Promise<void>;
}

function TransactionRow({
  transaction,
  isSelected,
  onToggleSelect,
  onImport,
}: TransactionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [category, setCategory] = useState(transaction.category || "");
  
  const isExpense = transaction.amount > 0;
  
  const handleImport = async () => {
    setIsImporting(true);
    try {
      await onImport(category || undefined);
    } finally {
      setIsImporting(false);
    }
  };
  
  const handleSkip = async () => {
    setIsImporting(true);
    try {
      await onImport(undefined, true);
    } finally {
      setIsImporting(false);
    }
  };
  
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div
        className="p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Select Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {isSelected ? (
            <Lucide.CheckSquare className="h-5 w-5 text-[#2F6F85]" />
          ) : (
            <Lucide.Square className="h-5 w-5" />
          )}
        </button>
        
        {/* Type Icon */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isExpense
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-green-100 dark:bg-green-900/30"
          }`}
        >
          {isExpense ? (
            <Lucide.ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
          ) : (
            <Lucide.ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
        </div>
        
        {/* Transaction Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
            {transaction.merchantName || transaction.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatDate(transaction.date)}</span>
            {transaction.category && (
              <>
                <span>·</span>
                <span className="truncate">{transaction.category}</span>
              </>
            )}
            {transaction.pending && (
              <>
                <span>·</span>
                <span className="text-amber-600 dark:text-amber-400">Pending</span>
              </>
            )}
          </div>
        </div>
        
        {/* Amount */}
        <p
          className={`font-medium text-sm ${
            isExpense
              ? "text-red-600 dark:text-red-400"
              : "text-green-600 dark:text-green-400"
          }`}
        >
          {isExpense ? "-" : "+"}
          {formatMoney(transaction.amount)}
        </p>
        
        {/* Expand/Collapse */}
        {isExpanded ? (
          <Lucide.ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <Lucide.ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-gray-700/30">
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Original Name</p>
              <p className="text-gray-900 dark:text-white">{transaction.name}</p>
            </div>
            {transaction.merchantName && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Merchant</p>
                <p className="text-gray-900 dark:text-white">{transaction.merchantName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Channel</p>
              <p className="text-gray-900 dark:text-white capitalize">{transaction.paymentChannel}</p>
            </div>
            {transaction.locationCity && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Location</p>
                <p className="text-gray-900 dark:text-white">
                  {transaction.locationCity}
                  {transaction.locationRegion && `, ${transaction.locationRegion}`}
                </p>
              </div>
            )}
          </div>
          
          {/* Category Input */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Enter category..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2F6F85] focus:border-transparent"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleImport();
              }}
              disabled={isImporting}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg bg-[#2F6F85] text-white hover:bg-[#245a6d] disabled:opacity-50"
            >
              {isImporting ? (
                <Lucide.Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lucide.Check className="mr-1.5 h-4 w-4" />
                  Import
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSkip();
              }}
              disabled={isImporting}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <Lucide.X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingTransactionsList() {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"plaidTransactions">>>(new Set());
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  
  const toast = useToast();
  const pendingTransactions = useQuery(api.plaid.listPendingTransactions, { limit: 100 });
  const importTransaction = useMutation(api.plaid.importPlaidTransaction);
  const bulkImport = useMutation(api.plaid.bulkImportPlaidTransactions);
  
  const handleToggleSelect = (id: Id<"plaidTransactions">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const handleSelectAll = () => {
    if (!pendingTransactions) return;
    
    if (selectedIds.size === pendingTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingTransactions.map((t: Doc<"plaidTransactions">) => t._id)));
    }
  };
  
  const handleImport = async (
    transactionId: Id<"plaidTransactions">,
    category?: string,
    skipImport?: boolean
  ) => {
    try {
      await importTransaction({
        plaidTransactionId: transactionId,
        category,
        skipImport,
      });
      
      if (!skipImport) {
        toast.success("Transaction imported");
      }
      
      // Remove from selection
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to import transaction");
    }
  };
  
  const handleBulkImport = async () => {
    if (selectedIds.size === 0) return;
    
    setIsImportingBulk(true);
    try {
      const result = await bulkImport({
        transactionIds: Array.from(selectedIds),
      });
      
      toast.success(
        `Imported ${result.imported} transaction(s)${
          result.skipped > 0 ? `, ${result.skipped} skipped` : ""
        }`
      );
      
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk import error:", err);
      toast.error("Failed to import transactions");
    } finally {
      setIsImportingBulk(false);
    }
  };
  
  if (pendingTransactions === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Lucide.Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (pendingTransactions.length === 0) {
    return (
      <div className="text-center py-8">
        <Lucide.Inbox className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          No pending transactions
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          All transactions have been imported or synced
        </p>
      </div>
    );
  }
  
  const allSelected = selectedIds.size === pendingTransactions.length;
  
  return (
    <div>
      {/* Bulk Actions Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {allSelected ? (
              <Lucide.CheckSquare className="h-5 w-5 text-[#2F6F85]" />
            ) : (
              <Lucide.Square className="h-5 w-5" />
            )}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${pendingTransactions.length} pending`}
          </span>
        </div>
        
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkImport}
            disabled={isImportingBulk}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-[#2F6F85] text-white hover:bg-[#245a6d] disabled:opacity-50"
          >
            {isImportingBulk ? (
              <Lucide.Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Lucide.Check className="mr-1.5 h-4 w-4" />
                Import Selected
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Transactions List */}
      <div>
        {pendingTransactions.map((transaction: Doc<"plaidTransactions">) => (
          <TransactionRow
            key={transaction._id}
            transaction={transaction}
            isSelected={selectedIds.has(transaction._id)}
            onToggleSelect={() => handleToggleSelect(transaction._id)}
            onImport={(category, skipImport) =>
              handleImport(transaction._id, category, skipImport)
            }
          />
        ))}
      </div>
    </div>
  );
}

export default PendingTransactionsList;
