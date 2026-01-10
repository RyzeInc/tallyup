"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import ObligationsHeader from "./ObligationsHeader";
import ObligationsTabs, { type ObligationsTabId } from "./ObligationsTabs";
import ObligationsTab from "./obligations/ObligationsTab";
import RulesTabRedesigned from "./rules/RulesTabRedesigned";
import InboxTabRedesigned from "./inbox/InboxTabRedesigned";
import InsightsTab from "./insights/InsightsTab";
import RuleEditorDialog from "./rules/RuleEditorDialog";

export default function RecurringPageRedesigned() {
  const [activeTab, setActiveTab] = useState<ObligationsTabId>("this_month");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  // Lazy initializer runs once on client side (on server returns 0)
  const [now] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));

  // Skip queries until we have a valid time
  const queryArgs = now > 0 ? {
    startDate: now - 30 * 24 * 60 * 60 * 1000,
    endDate: now + 90 * 24 * 60 * 60 * 1000,
  } : "skip" as const;

  // Queries
  const rules = useQuery(api.recurring.listRecurringRulesAll, { limit: 500 });
  const expectedCharges = useQuery(api.recurring.listExpectedCharges, queryArgs);
  const inboxItems = useQuery(api.recurring.listRecurringInbox, { status: "open", limit: 200 });

  // Auto-run reconciliation on mount
  const runRecurringAutopost = useMutation(api.recurring.runRecurringAutopost);
  useEffect(() => {
    if (!now) return;
    runRecurringAutopost({ monthsAhead: 6 });
  }, [now, runRecurringAutopost]);

  // Handlers
  const handleOpenRuleEditor = (ruleId: string | null) => {
    setEditingRuleId(ruleId);
    setIsEditorOpen(true);
  };

  const handleCloseRuleEditor = () => {
    setIsEditorOpen(false);
    setEditingRuleId(null);
  };

  const handleOpenQuickLog = (prefill: {
    merchant?: string;
    category?: string;
    amountCents?: number;
    date?: number;
    ruleId?: string;
    expectedChargeId?: string;
  }) => {
    // TODO: Open quick log modal with prefill
    // For now, we'll just log it - integrate with QuickLogModal from the app
    console.log("Quick log prefill:", prefill);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <ObligationsHeader
        onCreate={() => handleOpenRuleEditor(null)}
      />

      {/* Tabs */}
      <ObligationsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        inboxCount={inboxItems?.length ?? 0}
      />

      {/* Tab content */}
      {activeTab === "this_month" && (
        <ObligationsTab
          onOpenRuleEditor={handleOpenRuleEditor}
          onOpenQuickLog={handleOpenQuickLog}
        />
      )}
      {activeTab === "rules" && (
        <RulesTabRedesigned
          rules={rules}
          expectedCharges={expectedCharges}
          onEdit={(ruleId) => handleOpenRuleEditor(ruleId)}
          onCreate={() => handleOpenRuleEditor(null)}
        />
      )}
      {activeTab === "inbox" && (
        <InboxTabRedesigned
          inboxItems={inboxItems}
          rules={rules}
          onViewRule={(ruleId) => handleOpenRuleEditor(ruleId)}
        />
      )}
      {activeTab === "insights" && (
        <InsightsTab rules={rules} expectedCharges={expectedCharges} />
      )}

      {/* Rule editor dialog */}
      <RuleEditorDialog
        open={isEditorOpen}
        onClose={handleCloseRuleEditor}
        rule={rules?.find((r: Doc<"recurringRules">) => r._id === editingRuleId)}
      />
    </div>
  );
}
