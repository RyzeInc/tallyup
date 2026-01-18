"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { SignedIn } from "@clerk/nextjs";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { formatMoney } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";

const formatPercent = (ratio: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(ratio);
};

const ASSET_TYPES = [
  { value: "stock", label: "Stock", icon: Lucide.TrendingUp, color: "#3B82F6" },
  { value: "etf", label: "ETF", icon: Lucide.Layers, color: "#8B5CF6" },
  { value: "mutual_fund", label: "Mutual Fund", icon: Lucide.PieChart, color: "#EC4899" },
  { value: "bond", label: "Bond", icon: Lucide.Shield, color: "#10B981" },
  { value: "crypto", label: "Crypto", icon: Lucide.Coins, color: "#F59E0B" },
  { value: "cash", label: "Cash", icon: Lucide.Banknote, color: "#6B7280" },
  { value: "real_estate", label: "Real Estate", icon: Lucide.Home, color: "#14B8A6" },
  { value: "other", label: "Other", icon: Lucide.CircleDot, color: "#6366F1" },
] as const;

type AssetType = typeof ASSET_TYPES[number]["value"];

export default function InvestmentsPage() {
  const toast = useToast();
  const investments = useQuery(api.investments.listInvestments, {});
  const summary = useQuery(api.investments.getPortfolioSummary, {});
  const unlinkedHoldings = useQuery(api.plaid.listUnlinkedPlaidHoldings, {});
  const createInvestment = useMutation(api.investments.createInvestment);
  const updatePrice = useMutation(api.investments.updateInvestmentPrice);
  const syncHoldings = useMutation(api.plaid.syncPlaidHoldingsToInvestments);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Create form state
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AssetType>("stock");
  const [newQuantity, setNewQuantity] = useState("");
  const [newCostBasis, setNewCostBasis] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const handleSyncHoldings = async () => {
    setSyncing(true);
    try {
      const result = await syncHoldings({});
      toast.success(`Synced ${result.created} new and updated ${result.updated} investments from linked accounts`);
    } catch (err) {
      console.error("Failed to sync holdings:", err);
      toast.error("Failed to sync investments from linked accounts");
    } finally {
      setSyncing(false);
    }
  };
  // Update price state
  const [updatingPrice, setUpdatingPrice] = useState<Id<"investments"> | null>(null);
  const [priceInput, setPriceInput] = useState("");

  const resetCreate = () => {
    setShowCreate(false);
    setNewSymbol("");
    setNewName("");
    setNewType("stock");
    setNewQuantity("");
    setNewCostBasis("");
    setNewPrice("");
  };

  const handleCreate = async () => {
    if (!newName || !newQuantity || !newCostBasis) return;
    
    setCreating(true);
    try {
      await createInvestment({
        symbol: newSymbol || undefined,
        name: newName,
        assetType: newType,
        quantity: parseFloat(newQuantity),
        costBasisCents: Math.round(parseFloat(newCostBasis) * 100),
        currentPriceCents: newPrice ? Math.round(parseFloat(newPrice) * 100) : undefined,
      });
      resetCreate();
    } catch (e) {
      console.error("Failed to create investment:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePrice = async (id: Id<"investments">) => {
    if (!priceInput) return;
    
    try {
      await updatePrice({
        id,
        currentPriceCents: Math.round(parseFloat(priceInput) * 100),
      });
      setUpdatingPrice(null);
      setPriceInput("");
    } catch (e) {
      console.error("Failed to update price:", e);
    }
  };

  const getAssetType = (type: string) => ASSET_TYPES.find((t) => t.value === type) || ASSET_TYPES[7];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "var(--background)" }}>
      <SignedIn>
        <PageHeader title="Investments" subtitle="Track your portfolio holdings" />

        {/* Portfolio Summary */}
        {summary && (
          <div className="px-4 mb-6">
            <div className="p-4 rounded-2xl" style={{ backgroundColor: "var(--surface)" }}>
              <div className="text-center mb-4">
                <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Total Portfolio Value</div>
                <div className="text-3xl font-bold" style={{ color: "var(--text)" }}>
                  {formatMoney(summary.totalValueCents)}
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: summary.totalGainCents >= 0 ? "var(--success)" : "var(--danger)" }}
                >
                  {formatMoney(summary.totalGainCents)} ({formatPercent(summary.totalGainCents / summary.totalCostBasisCents)})
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Cost Basis</div>
                  <div className="font-semibold" style={{ color: "var(--text)" }}>
                    {formatMoney(summary.totalCostBasisCents)}
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Unrealized</div>
                  <div
                    className="font-semibold"
                    style={{ color: summary.totalUnrealizedGainCents >= 0 ? "var(--success)" : "var(--danger)" }}
                  >
                    {formatMoney(summary.totalUnrealizedGainCents)}
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Realized</div>
                  <div
                    className="font-semibold"
                    style={{ color: summary.totalRealizedGainCents >= 0 ? "var(--success)" : "var(--danger)" }}
                  >
                    {formatMoney(summary.totalRealizedGainCents)}
                  </div>
                </div>
              </div>

              {/* Allocation by Type */}
              {Object.keys(summary.allocationByType).length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Allocation
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(summary.allocationByType) as [string, number][]).map(([type, value]) => {
                      const assetType = getAssetType(type);
                      const pct = value / summary.totalValueCents;
                      return (
                        <div
                          key={type}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                          style={{ backgroundColor: `${assetType.color}20`, color: assetType.color }}
                        >
                          <span>{assetType.label}</span>
                          <span className="font-semibold">{(pct * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Holdings List */}
        <div className="px-4 space-y-3">
          {/* Sync from Plaid banner */}
          {unlinkedHoldings && unlinkedHoldings.length > 0 && (
            <div
              className="p-4 rounded-xl flex items-center justify-between"
              style={{ backgroundColor: "var(--primary-subtle)", border: "1px solid var(--primary)" }}
            >
              <div className="flex items-center gap-3">
                <Lucide.Sparkles className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <div>
                  <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                    {unlinkedHoldings.length} investment{unlinkedHoldings.length !== 1 ? "s" : ""} detected from linked accounts
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Import holdings from your brokerage accounts
                  </div>
                </div>
              </div>
              <button
                onClick={handleSyncHoldings}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--on-primary)",
                  opacity: syncing ? 0.7 : 1,
                }}
              >
                {syncing ? (
                  <Lucide.Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lucide.Download className="h-4 w-4" />
                )}
                Import
              </button>
            </div>
          )}
          
          {investments === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
              ))}
            </div>
          ) : investments.length === 0 ? (
            <div className="text-center py-12">
              <Lucide.TrendingUp className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <div className="font-medium mb-1" style={{ color: "var(--text)" }}>No investments yet</div>
              <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                {unlinkedHoldings && unlinkedHoldings.length > 0 
                  ? "Import from linked accounts or add manually"
                  : "Link a brokerage account or add manually"}
              </div>
            </div>
          ) : (
            investments.map((inv: Doc<"investments">) => {
              const assetType = getAssetType(inv.assetType);
              const Icon = assetType.icon;
              const gain = inv.unrealizedGainCents ?? 0;
              const value = inv.currentValueCents ?? inv.costBasisCents;
              const gainPct = inv.costBasisCents > 0 ? gain / inv.costBasisCents : 0;

              return (
                <div
                  key={inv._id}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${assetType.color}20` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: assetType.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {inv.symbol && (
                            <span className="font-semibold" style={{ color: "var(--text)" }}>
                              {inv.symbol}
                            </span>
                          )}
                          <span
                            className="text-sm"
                            style={{ color: inv.symbol ? "var(--text-secondary)" : "var(--text)" }}
                          >
                            {inv.name}
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {inv.quantity.toLocaleString()} shares • {assetType.label}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: "var(--text)" }}>
                        {formatMoney(value)}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: gain >= 0 ? "var(--success)" : "var(--danger)" }}
                      >
                        {formatMoney(gain)} ({formatPercent(gainPct)})
                      </div>
                    </div>
                  </div>

                  {/* Update Price Row */}
                  {updatingPrice === inv._id ? (
                    <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          placeholder={(inv.currentPriceCents ? inv.currentPriceCents / 100 : 0).toFixed(2)}
                          className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                          style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => handleUpdatePrice(inv._id)}
                        className="px-3 py-2 rounded-lg text-sm font-medium"
                        style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setUpdatingPrice(null); setPriceInput(""); }}
                        className="p-2 rounded-lg"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Lucide.X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setUpdatingPrice(inv._id)}
                      className="flex items-center gap-1 mt-3 text-xs"
                      style={{ color: "var(--primary)" }}
                    >
                      <Lucide.RefreshCw className="h-3 w-3" />
                      Update Price
                    </button>
                  )}
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
            <div className="absolute inset-0 bg-black/40" onClick={resetCreate} />
            <div
              className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Add Investment</h2>
                <button onClick={resetCreate}>
                  <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Symbol (optional)
                    </label>
                    <input
                      type="text"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                      placeholder="AAPL"
                      className="w-full px-3 py-2 rounded-lg text-sm uppercase"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Asset Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as AssetType)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Apple Inc."
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Total Cost Basis
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={newCostBasis}
                        onChange={(e) => setNewCostBasis(e.target.value)}
                        placeholder="1,500.00"
                        className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Current Price per Share (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-tertiary)" }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="175.00"
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!newName || !newQuantity || !newCostBasis || creating}
                  className="w-full py-3 rounded-xl font-medium disabled:opacity-50"
                  style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                >
                  {creating ? "Adding..." : "Add Investment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}
