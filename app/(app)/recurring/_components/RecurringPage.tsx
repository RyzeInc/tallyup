"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import RecurringHeaderBar from "./RecurringHeaderBar";
import RecurringRangeBar from "./RecurringRangeBar";
import RecurringTabs, { RecurringTabId } from "./RecurringTabs";
import OverviewTab from "./overview/OverviewTab";
import UpcomingTab from "./upcoming/UpcomingTab";
import RulesTab from "./rules/RulesTab";
import InboxTab from "./inbox/InboxTab";
import InsightsTab from "./insights/InsightsTab";
import RuleEditorDialog from "./rules/RuleEditorDialog";

export default function RecurringPage() {
  const [activeTab, setActiveTab] = useState<RecurringTabId>("overview");
  const [upcomingPreset, setUpcomingPreset] = useState<"7d" | "30d" | "60d" | "90d">("30d");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const [now, setNow] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(raf);
  }, []);
  const upcomingWindow = useMemo(() => {
    const days = upcomingPreset === "7d" ? 7 : upcomingPreset === "60d" ? 60 : upcomingPreset === "90d" ? 90 : 30;
    return { startDate: now, endDate: now + days * 24 * 60 * 60 * 1000 };
  }, [now, upcomingPreset]);

  const rules = useQuery(api.recurring.listRecurringRulesAll, { limit: 500 });
  const expectedCharges = useQuery(api.recurring.listExpectedCharges, {
    startDate: upcomingWindow.startDate,
    endDate: upcomingWindow.endDate,
  });
  const inboxItems = useQuery(api.recurring.listRecurringInbox, { status: "open", limit: 200 });
  const runRecurringAutopost = useMutation(api.recurring.runRecurringAutopost);

  useEffect(() => {
    if (!now) return;
    runRecurringAutopost({ monthsAhead: 6 });
  }, [now, runRecurringAutopost]);

  return (
    <div className="space-y-4">
      <RecurringHeaderBar
        onCreate={() => {
          setEditingRuleId(null);
          setIsEditorOpen(true);
        }}
      />
      <RecurringRangeBar
        upcomingPreset={upcomingPreset}
        onChangeUpcomingPreset={setUpcomingPreset}
      />
      <RecurringTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        inboxCount={inboxItems?.length ?? 0}
      />

      {activeTab === "overview" && (
        <OverviewTab rules={rules} expectedCharges={expectedCharges} inboxItems={inboxItems} />
      )}
      {activeTab === "upcoming" && (
        <UpcomingTab expectedCharges={expectedCharges} />
      )}
      {activeTab === "rules" && (
        <RulesTab
          rules={rules}
          expectedCharges={expectedCharges}
          onCreate={() => {
            setEditingRuleId(null);
            setIsEditorOpen(true);
          }}
          onEdit={(ruleId) => {
            setEditingRuleId(ruleId);
            setIsEditorOpen(true);
          }}
        />
      )}
      {activeTab === "inbox" && (
        <InboxTab inboxItems={inboxItems} />
      )}
      {activeTab === "insights" && (
        <InsightsTab rules={rules} expectedCharges={expectedCharges} />
      )}

      <RuleEditorDialog
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        rule={rules?.find((r) => r._id === editingRuleId)}
      />
    </div>
  );
}
