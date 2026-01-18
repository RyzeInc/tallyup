"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import { formatMoney } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";

type PlaidRecurringStream = Doc<"plaidRecurringStreams">;

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case "WEEKLY": return "Weekly";
    case "BIWEEKLY": return "Biweekly";
    case "SEMI_MONTHLY": return "Twice monthly";
    case "MONTHLY": return "Monthly";
    case "ANNUALLY": return "Annually";
    default: return "Unknown";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface PlaidStreamCardProps {
  stream: PlaidRecurringStream;
  onImport: (streamId: Id<"plaidRecurringStreams">) => void;
  importing: boolean;
}

function PlaidStreamCard({ stream, onImport, importing }: PlaidStreamCardProps) {
  const isInflow = stream.streamType === "inflow";
  const Icon = isInflow ? Lucide.ArrowDownLeft : Lucide.ArrowUpRight;
  const statusColor = stream.status === "MATURE" ? "var(--success)" : "var(--warning)";
  
  return (
    <div
      className="p-4 rounded-xl"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: isInflow ? "var(--success-subtle)" : "var(--expense-subtle)",
          }}
        >
          <Icon
            className="h-5 w-5"
            style={{ color: isInflow ? "var(--success)" : "var(--expense)" }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate" style={{ color: "var(--text)" }}>
              {stream.merchantName || stream.description || "Unknown"}
            </span>
            {/* Status badge */}
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
            >
              {stream.status === "MATURE" ? "Established" : "New"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{formatFrequency(stream.frequency)}</span>
            <span>•</span>
            <span>{isInflow ? "Income" : "Expense"}</span>
            {stream.personalFinanceCategory?.primary && (
              <>
                <span>•</span>
                <span className="capitalize">{stream.personalFinanceCategory.primary.toLowerCase().replace(/_/g, " ")}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <span>Avg: {formatMoney(stream.averageAmountCents)}</span>
            <span>Last: {formatMoney(stream.lastAmountCents)}</span>
            {stream.predictedNextDate && (
              <span>Next: {formatDate(stream.predictedNextDate)}</span>
            )}
          </div>
        </div>

        {/* Amount & Import */}
        <div className="flex flex-col items-end gap-2">
          <div
            className="font-semibold tabular-nums"
            style={{ color: isInflow ? "var(--success)" : "var(--expense)" }}
          >
            {isInflow ? "+" : "-"}{formatMoney(stream.averageAmountCents)}
          </div>
          
          <button
            onClick={() => onImport(stream._id)}
            disabled={importing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--on-primary)",
              opacity: importing ? 0.7 : 1,
            }}
          >
            {importing ? (
              <Lucide.Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Lucide.Plus className="h-3 w-3" />
            )}
            Import
          </button>
        </div>
      </div>

      {/* Transaction count */}
      {stream.transactionCount && stream.transactionCount > 0 && (
        <div
          className="mt-3 pt-3 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-tertiary)" }}
        >
          {stream.transactionCount} transaction{stream.transactionCount !== 1 ? "s" : ""} detected
          {stream.firstDate && stream.lastDate && (
            <> • {formatDate(stream.firstDate)} – {formatDate(stream.lastDate)}</>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlaidStreamsTab() {
  const toast = useToast();
  const [importingId, setImportingId] = useState<Id<"plaidRecurringStreams"> | null>(null);
  const [isImportingAll, setIsImportingAll] = useState(false);
  
  // Fetch unlinked Plaid streams
  const streams = useQuery(api.recurring.listPlaidRecurringStreams, {
    onlyUnlinked: true,
    limit: 100,
  });
  
  const importPlaidStreams = useAction(api.recurring.importPlaidRecurringStreams);
  
  const handleImport = async (streamId: Id<"plaidRecurringStreams">) => {
    setImportingId(streamId);
    try {
      const result = await importPlaidStreams({ streamIds: [streamId] });
      if (result.rulesCreated > 0) {
        toast.success(`Created recurring rule and linked ${result.entriesLinked} entries`);
      } else if (result.errors.length > 0) {
        toast.error("Failed to import", { description: result.errors[0] });
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Failed to import stream");
    } finally {
      setImportingId(null);
    }
  };
  
  const handleImportAll = async () => {
    if (!streams || streams.length === 0) return;
    
    setIsImportingAll(true);
    try {
      const result = await importPlaidStreams({ importAll: true, minConfidence: 60 });
      toast.success(
        `Imported ${result.rulesCreated} recurring rule${result.rulesCreated !== 1 ? "s" : ""} and linked ${result.entriesLinked} entries`
      );
    } catch (err) {
      console.error("Import all error:", err);
      toast.error("Failed to import streams");
    } finally {
      setIsImportingAll(false);
    }
  };
  
  // Separate inflows and outflows
  const inflowStreams = (streams || []).filter(s => s.streamType === "inflow");
  const outflowStreams = (streams || []).filter(s => s.streamType === "outflow");
  
  if (streams === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--surface)" }}
          />
        ))}
      </div>
    );
  }
  
  if (streams.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <Lucide.Sparkles className="h-8 w-8" style={{ color: "var(--text-tertiary)" }} />
        </div>
        <div className="font-medium mb-1" style={{ color: "var(--text)" }}>
          No new recurring patterns detected
        </div>
        <div className="text-sm max-w-xs mx-auto" style={{ color: "var(--text-secondary)" }}>
          Link a bank account and sync transactions. Plaid will automatically detect your recurring bills and income.
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header with Import All button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {streams.length} pattern{streams.length !== 1 ? "s" : ""} detected
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Import to create recurring rules
          </div>
        </div>
        <button
          onClick={handleImportAll}
          disabled={isImportingAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--on-primary)",
            opacity: isImportingAll ? 0.7 : 1,
          }}
        >
          {isImportingAll ? (
            <Lucide.Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lucide.Sparkles className="h-4 w-4" />
          )}
          Import All
        </button>
      </div>

      {/* Inflows Section */}
      {inflowStreams.length > 0 && (
        <div>
          <div
            className="flex items-center gap-2 mb-2 text-sm font-medium"
            style={{ color: "var(--success)" }}
          >
            <Lucide.ArrowDownLeft className="h-4 w-4" />
            Recurring Income ({inflowStreams.length})
          </div>
          <div className="space-y-3">
            {inflowStreams.map((stream) => (
              <PlaidStreamCard
                key={stream._id}
                stream={stream}
                onImport={handleImport}
                importing={importingId === stream._id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Outflows Section */}
      {outflowStreams.length > 0 && (
        <div>
          <div
            className="flex items-center gap-2 mb-2 text-sm font-medium"
            style={{ color: "var(--expense)" }}
          >
            <Lucide.ArrowUpRight className="h-4 w-4" />
            Recurring Expenses ({outflowStreams.length})
          </div>
          <div className="space-y-3">
            {outflowStreams.map((stream) => (
              <PlaidStreamCard
                key={stream._id}
                stream={stream}
                onImport={handleImport}
                importing={importingId === stream._id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
