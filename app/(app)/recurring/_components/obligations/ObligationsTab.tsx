"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useToast } from "@/components/ToastProvider";
import SummaryStrip from "./SummaryStrip";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";
import StatusFilterBar, { type StatusFilter, type RangePreset } from "./StatusFilterBar";
import ListView from "./ListView";
import CardsView from "./CardsView";
import CalendarView from "./CalendarView";
import type { EnrichedCharge } from "./types";

interface ObligationsTabProps {
  onOpenRuleEditor: (ruleId: string | null) => void;
  onOpenQuickLog: (prefill: {
    merchant?: string;
    category?: string;
    amountCents?: number;
    date?: number;
    ruleId?: string;
    expectedChargeId?: string;
  }) => void;
}

export default function ObligationsTab({ onOpenRuleEditor, onOpenQuickLog }: ObligationsTabProps) {
  const toast = useToast();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  // Lazy initializer runs once on client side (on server returns 0)
  const [now] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    if (now === 0) return { startDate: 0, endDate: 0 };
    const days = rangePreset === "7d" ? 7 : rangePreset === "60d" ? 60 : rangePreset === "90d" ? 90 : 30;
    // Include past 7 days for overdue items
    return {
      startDate: now - 7 * 24 * 60 * 60 * 1000,
      endDate: now + days * 24 * 60 * 60 * 1000,
    };
  }, [rangePreset, now]);

  // Queries - skip until we have valid timestamps
  const queryArgs = now > 0 ? { startDate, endDate } : "skip" as const;
  
  const enrichedCharges = useQuery(api.recurring.listExpectedChargesEnriched, queryArgs) as EnrichedCharge[] | undefined;

  const summary = useQuery(api.recurring.getObligationsSummary, queryArgs);

  // Mutations
  const skipExpectedCharge = useMutation(api.recurring.skipExpectedCharge);

  // Filter charges
  const filteredCharges = useMemo(() => {
    if (!enrichedCharges) return [];

    let result = enrichedCharges;

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "needs_review") {
        // TODO: implement needs_review logic when inbox integration is ready
        result = result.filter((c) => c.state === "due" || c.state === "missed");
      } else {
        result = result.filter((c) => c.state === statusFilter);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.institutionName?.toLowerCase().includes(q) ||
          c.accountName?.toLowerCase().includes(q)
      );
    }

    // Sort by expected date
    return result.sort((a, b) => a.expectedDate - b.expectedDate);
  }, [enrichedCharges, statusFilter, searchQuery]);

  // Counts for filter badges
  const counts = useMemo(() => {
    if (!enrichedCharges) return undefined;
    return {
      all: enrichedCharges.length,
      due: enrichedCharges.filter((c) => c.state === "due").length,
      upcoming: enrichedCharges.filter((c) => c.state === "upcoming").length,
      matched: enrichedCharges.filter((c) => c.state === "matched").length,
      missed: enrichedCharges.filter((c) => c.state === "missed").length,
      needs_review: enrichedCharges.filter((c) => c.state === "due" || c.state === "missed").length,
    };
  }, [enrichedCharges]);

  // Handlers
  const handleLogNow = (charge: EnrichedCharge) => {
    onOpenQuickLog({
      merchant: charge.name,
      category: charge.category,
      amountCents: charge.amountCents,
      date: charge.expectedDate,
      ruleId: charge.ruleId,
      expectedChargeId: charge._id,
    });
  };

  const handleLinkExisting = (charge: EnrichedCharge) => {
    // TODO: Open transaction picker modal
    void charge; // Mark as intentionally unused until feature is implemented
    toast.info("Link existing transaction", {
      description: "This feature is coming soon. Use Log now to create a new entry.",
    });
  };

  const handleSkip = async (charge: EnrichedCharge) => {
    try {
      await skipExpectedCharge({ id: charge._id });
      toast.success("Skipped this occurrence");
    } catch {
      toast.error("Failed to skip");
    }
  };

  const handleMoveDate = (charge: EnrichedCharge) => {
    // TODO: Open date picker modal
    void charge; // Mark as intentionally unused until feature is implemented
    toast.info("Move date", {
      description: "This feature is coming soon.",
    });
  };

  const handleViewRule = (charge: EnrichedCharge) => {
    onOpenRuleEditor(charge.ruleId);
  };

  const isLoading = enrichedCharges === undefined || summary === undefined;

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <SummaryStrip
        expectedTotal={summary?.expectedTotal ?? 0}
        loggedTotal={summary?.loggedTotal ?? 0}
        leftToLog={summary?.leftToLog ?? 0}
        attentionCount={summary?.attentionCount ?? 0}
        progressPercent={summary?.progressPercent ?? 0}
        isLoading={isLoading}
      />

      {/* Control bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <StatusFilterBar
          status={statusFilter}
          onStatusChange={setStatusFilter}
          range={rangePreset}
          onRangeChange={setRangePreset}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          counts={counts}
        />
        <div className="flex items-center gap-2 md:ml-auto">
          <ViewSwitcher mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* View content */}
      {viewMode === "list" && (
        <ListView
          charges={filteredCharges}
          isLoading={isLoading}
          onLogNow={handleLogNow}
          onLinkExisting={handleLinkExisting}
          onSkip={handleSkip}
          onMoveDate={handleMoveDate}
          onViewRule={handleViewRule}
        />
      )}
      {viewMode === "cards" && (
        <CardsView
          charges={filteredCharges}
          isLoading={isLoading}
          onLogNow={handleLogNow}
          onLinkExisting={handleLinkExisting}
          onSkip={handleSkip}
          onMoveDate={handleMoveDate}
          onViewRule={handleViewRule}
        />
      )}
      {viewMode === "calendar" && (
        <CalendarView
          charges={filteredCharges}
          isLoading={isLoading}
          onLogNow={handleLogNow}
          onLinkExisting={handleLinkExisting}
          onSkip={handleSkip}
          onMoveDate={handleMoveDate}
          onViewRule={handleViewRule}
        />
      )}
    </div>
  );
}
