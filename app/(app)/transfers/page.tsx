"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { SignedIn } from "@clerk/nextjs";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const formatMoney = (cents: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const TRANSFER_TYPES = [
  { value: "internal", label: "Between Accounts", icon: Lucide.ArrowLeftRight, color: "#3B82F6" },
  { value: "external", label: "External Transfer", icon: Lucide.ArrowRightFromLine, color: "#8B5CF6" },
  { value: "payment", label: "Payment", icon: Lucide.CreditCard, color: "#10B981" },
  { value: "investment", label: "Investment", icon: Lucide.TrendingUp, color: "#F59E0B" },
] as const;

type TransferType = typeof TRANSFER_TYPES[number]["value"];

export default function TransfersPage() {
  const transfers = useQuery(api.transfers.listTransfers, {});
  const accounts = useQuery(api.accounts.listAccounts, {});
  const createTransfer = useMutation(api.transfers.createTransfer);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromAccount, setFromAccount] = useState<Id<"accounts"> | "">("");
  const [toAccount, setToAccount] = useState<Id<"accounts"> | "">("");
  const [transferType, setTransferType] = useState<TransferType>("internal");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetCreate = () => {
    setShowCreate(false);
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setFromAccount("");
    setToAccount("");
    setTransferType("internal");
    setNote("");
    setError(null);
  };

  const handleCreate = async () => {
    if (!amount) return;
    if (fromAccount && toAccount && fromAccount === toAccount) {
      setError("From and To accounts must be different.");
      return;
    }
    
    setCreating(true);
    try {
      await createTransfer({
        amountCents: Math.round(parseFloat(amount) * 100),
        date: new Date(date).getTime(),
        fromAccountId: fromAccount ? fromAccount as Id<"accounts"> : undefined,
        toAccountId: toAccount ? toAccount as Id<"accounts"> : undefined,
        transferType,
        note: note || undefined,
      });
      resetCreate();
    } catch (e) {
      console.error("Failed to create transfer:", e);
      setError("Failed to create transfer.");
    } finally {
      setCreating(false);
    }
  };

  const getAccountName = (id?: Id<"accounts">) => {
    if (!id || !accounts) return "External";
    const account = accounts.find((a) => a._id === id);
    return account?.name || "Unknown";
  };

  const getTransferType = (type: string) => TRANSFER_TYPES.find((t) => t.value === type) || TRANSFER_TYPES[0];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed": return "var(--success)";
      case "pending": return "var(--warning)";
      case "failed": return "var(--danger)";
      case "cancelled": return "var(--text-tertiary)";
      default: return "var(--text-secondary)";
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "var(--background)" }}>
      <SignedIn>
        <PageHeader title="Transfers" subtitle="Track money moving between accounts" />

        {/* Transfers List */}
        <div className="px-4 space-y-3">
          {transfers === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12">
              <Lucide.ArrowLeftRight className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <div className="font-medium mb-1" style={{ color: "var(--text)" }}>No transfers yet</div>
              <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Log transfers between your accounts
              </div>
            </div>
          ) : (
            transfers.map((transfer) => {
              const typeInfo = getTransferType(transfer.transferType);
              const Icon = typeInfo.icon;

              return (
                <div
                  key={transfer._id}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${typeInfo.color}20` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: typeInfo.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium" style={{ color: "var(--text)" }}>
                            {getAccountName(transfer.fromAccountId)}
                          </span>
                          <Lucide.ArrowRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          <span className="font-medium" style={{ color: "var(--text)" }}>
                            {getAccountName(transfer.toAccountId)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <span>{formatDate(transfer.date)}</span>
                          <span>•</span>
                          <span style={{ color: getStatusColor(transfer.status) }}>{transfer.status}</span>
                        </div>
                        {transfer.note && (
                          <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                            {transfer.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: "var(--text)" }}>
                        {formatMoney(transfer.amountCents)}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {typeInfo.label}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40"
          style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
        >
          <Lucide.Plus className="h-6 w-6" />
        </button>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={resetCreate} />
            <div
              className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>New Transfer</h2>
                <button onClick={resetCreate}>
                  <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Transfer Type */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRANSFER_TYPES.map((type) => {
                      const TypeIcon = type.icon;
                      const isSelected = transferType === type.value;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setTransferType(type.value)}
                          className="flex items-center gap-2 p-3 rounded-xl text-left transition-colors"
                          style={{
                            backgroundColor: isSelected ? `${type.color}20` : "var(--surface-2)",
                            border: `1px solid ${isSelected ? type.color : "var(--border)"}`,
                          }}
                        >
                          <TypeIcon className="h-4 w-4" style={{ color: type.color }} />
                          <span className="text-xs font-medium" style={{ color: isSelected ? type.color : "var(--text)" }}>
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                {/* From Account */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    From Account
                  </label>
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value as Id<"accounts"> | "")}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  >
                    <option value="">External / Not Specified</option>
                    {accounts?.map((acc) => (
                      <option key={acc._id} value={acc._id}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                {/* To Account */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    To Account
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value as Id<"accounts"> | "")}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  >
                    <option value="">External / Not Specified</option>
                    {accounts?.filter((acc) => acc._id !== fromAccount).map((acc) => (
                      <option key={acc._id} value={acc._id}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Monthly savings"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                {error && (
                  <div className="text-sm" style={{ color: "var(--danger)" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={!amount || creating}
                  className="w-full py-3 rounded-xl font-medium disabled:opacity-50"
                  style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                >
                  {creating ? "Creating..." : "Create Transfer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}
