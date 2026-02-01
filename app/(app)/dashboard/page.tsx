"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { centsToDollars, getCategoryDisplayName, getDateRangeFromPreset, DateRangePreset } from "@/components/utils";
import * as Lucide from "lucide-react";
import EditEntryModal from "@/components/EditEntryModal";
import { useTabs } from "@/components/PersistentTabs";
import LocalDateRangePicker from "@/components/LocalDateRangePicker";
import Link from "next/link";
import { useRouter } from "next/navigation";

// In-place action modals
import QuickLogModal from "@/components/log/QuickLogModal";
import RuleEditorDialog from "@/app/(app)/recurring/_components/rules/RuleEditorDialog";

// Calendar widget
import { NetIncomeCalendar } from "@/components/calendar/NetIncomeCalendar";

// Dashboard modules (Phase 1 + Phase 2 + Accountability)
import {
  UpcomingBillsModule,
  PaydayCountdownModule,
  SafeToSpendModule,
  BudgetHealthRingsModule,
  // Phase 2
  GoalsPreviewModule,
  NetWorthSummaryCard,
  PeriodComparisonCards,
  ReviewAlertCard,
  // Accountability
  AccountabilityCard,
} from "@/components/dashboard";

// Widget system
import {
  WidgetWrapper,
  WidgetPanel,
  EditModeToolbar,
  DEFAULT_LAYOUT,
  WidgetId,
  WidgetSize,
  DashboardLayout,
} from "@/components/dashboard/widgets";

/**
 * Dashboard - Financial overview at a glance
 * 
 * Structure:
 * 1. Accountability Health Check (cross-entity sync)
 * 2. Net Worth Summary (optional)
 * 3. Review Alert (prominent, when needed)
 * 4. Net money hero with period comparison
 * 5. Safe-to-Spend + Payday countdown
 * 6. Budget health rings
 * 7. Goals preview
 * 8. Upcoming bills
 * 9. Recent activity
 * 10. Category breakdown
 */

type Entry = Doc<"entries">;
type EditableEntry = Entry & { type: "expense" | "income" };

const COLORS = ["#2F6F85", "#10B981", "#F59E0B", "#6F9EA8", "#EC4899", "#C87A5A"];

function isEditableEntry(entry: Entry): entry is EditableEntry {
  return entry.type === "expense" || entry.type === "income";
}

export default function DashboardPage() {
  const { setActiveTab } = useTabs();
  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [safeToSpendExpanded, setSafeToSpendExpanded] = useState(false);
  const [netWorthExpanded, setNetWorthExpanded] = useState(false);
  
  // In-place action modal states
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [recurringEditorOpen, setRecurringEditorOpen] = useState(false);
  const [recurringEditorType, setRecurringEditorType] = useState<"income" | "expense">("income");
  
  // Coach quick ask state
  const [coachQuickAskInput, setCoachQuickAskInput] = useState("");
  const router = useRouter();
  
  // Widget system state
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);
  const [localLayout, setLocalLayout] = useState<DashboardLayout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragIndex: number | null;
    dropIndex: number | null;
  }>({ isDragging: false, dragIndex: null, dropIndex: null });
  
  // Load saved layout from server
  const savedLayout = useQuery(api.preferences.getDashboardLayout);
  const saveLayoutMutation = useMutation(api.preferences.saveDashboardLayout);
  const resetLayoutMutation = useMutation(api.preferences.resetDashboardLayout);
  
  // Current layout: local edits > saved > default
  // Merge any new widgets from DEFAULT_LAYOUT that aren't in saved layout
  const currentLayout = useMemo(() => {
    if (localLayout) return localLayout;
    
    const baseLayout = savedLayout ? (savedLayout as DashboardLayout) : DEFAULT_LAYOUT;
    
    // Check if there are any new widgets in DEFAULT_LAYOUT that aren't in the base layout
    const existingWidgetIds = new Set(baseLayout.widgets.map(w => w.widgetId));
    const newWidgets = DEFAULT_LAYOUT.widgets.filter(w => !existingWidgetIds.has(w.widgetId));
    
    if (newWidgets.length === 0) {
      return baseLayout;
    }
    
    // Merge new widgets (add them at the end, hidden by default)
    const maxOrder = Math.max(...baseLayout.widgets.map(w => w.order), 0);
    const mergedWidgets = [
      ...baseLayout.widgets,
      ...newWidgets.map((w, i) => ({
        ...w,
        order: maxOrder + 1 + i,
        visible: false, // New widgets are hidden until user enables them
      })),
    ];
    
    return {
      ...baseLayout,
      widgets: mergedWidgets,
    };
  }, [localLayout, savedLayout]);
  
  // Track if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!localLayout) return false;
    const serverLayout = savedLayout || DEFAULT_LAYOUT;
    return JSON.stringify(localLayout.widgets) !== JSON.stringify(serverLayout.widgets);
  }, [localLayout, savedLayout]);
  
  // Sorted visible widgets
  const sortedWidgets = useMemo(() => {
    return [...currentLayout.widgets].sort((a, b) => a.order - b.order);
  }, [currentLayout]);
  
  // Dashboard has its own independent time range (not linked to global)
  // Default to "This Month" for a snapshot of current financial situation
  const [dashboardPreset, setDashboardPreset] = useState<DateRangePreset>(() => {
    if (typeof window === "undefined") return "month";
    try {
      const stored = localStorage.getItem("tallyup.dashboardTimeRange");
      if (stored) {
        const parsed = JSON.parse(stored);
        const preset = parsed?.preset as DateRangePreset | undefined;
        if (
          preset === "today" ||
          preset === "yesterday" ||
          preset === "week" ||
          preset === "last-week" ||
          preset === "month" ||
          preset === "last-month"
        ) {
          return preset;
        }
      }
    } catch {}
    return "month";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("tallyup.dashboardTimeRange", JSON.stringify({ preset: dashboardPreset }));
    } catch {}
  }, [dashboardPreset]);
  
  // Compute date range from dashboard's own preset
  const { startDate, endDate, label } = useMemo(() => {
    return getDateRangeFromPreset(dashboardPreset);
  }, [dashboardPreset]);

  // Fetch dashboard module data (upcoming bills, payday, budgets, safe-to-spend)
  const dashboardData = useQuery(api.dashboard.getDashboardData, {
    periodStart: startDate,
    periodEnd: endDate,
    upcomingDays: 30,
  });

  // Fetch accountability check data (cross-entity synchronization)
  const accountabilityData = useQuery(api.accountability.getAccountabilityCheck, {
    periodStart: startDate,
    periodEnd: endDate,
  });

  const entries = useQuery(api.entries.listEntries, { startDate, endDate, limit: 1200 }) as Entry[] | undefined;
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as Entry[] | undefined;
  const expenseCategories = useQuery(api.categories.listCategories, { categoryType: "expense" });
  const incomeCategories = useQuery(api.categories.listCategories, { categoryType: "income" });
  const allCustomCategories = useMemo(() => {
    const expense = (expenseCategories ?? []) as { _id: string; name: string }[];
    const income = (incomeCategories ?? []) as { _id: string; name: string }[];
    return [...expense, ...income];
  }, [expenseCategories, incomeCategories]);

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return entries
      .filter(isEditableEntry)
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
  }, [entries]);

  const computed = useMemo(() => {
    const all = entries ?? [];
    let income = 0;
    let expense = 0;
    const bucketSpend = new Map<string, number>();
    const categorySpend = new Map<string, number>();

    for (const e of all) {
      if (e.excludeFromTotals) continue;
      if (e.type === "income") {
        income += e.amountCents;
      } else if (e.type === "expense") {
        expense += e.amountCents;
      }
      if (e.type === "expense") {
        const b = (e.bucket ?? "Other").trim() || "Other";
        bucketSpend.set(b, (bucketSpend.get(b) ?? 0) + e.amountCents);
        const categoryKey = e.categoryId ?? e.category ?? e.bucket;
        const categoryLabel = getCategoryDisplayName(categoryKey, allCustomCategories);
        categorySpend.set(categoryLabel, (categorySpend.get(categoryLabel) ?? 0) + e.amountCents);
      }
    }

    const net = income - expense;
    const bucketRows = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const otherTotal = [...bucketSpend.entries()].sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [, v]) => s + v, 0);
    const bucketFinal = otherTotal > 0 ? [...bucketRows, ["Other", otherTotal] as const] : bucketRows;
    const topCategory = [...categorySpend.entries()].sort((a, b) => b[1] - a[1])[0];
    return { income, expense, net, bucketFinal, topCategory };
  }, [entries, allCustomCategories]);

  const reviewCount = inbox?.length ?? 0;

  // Widget handlers
  const handleToggleEditMode = useCallback(() => {
    if (isEditMode && !hasChanges) {
      // Exiting edit mode without changes - just close
      setIsEditMode(false);
      setLocalLayout(null);
    } else if (!isEditMode) {
      // Entering edit mode - copy current layout for editing
      setLocalLayout(currentLayout);
      setIsEditMode(true);
    }
  }, [isEditMode, hasChanges, currentLayout]);

  const handleSaveLayout = useCallback(async () => {
    if (!localLayout) return;
    setIsSaving(true);
    try {
      await saveLayoutMutation({ layout: localLayout });
      setLocalLayout(null);
      setIsEditMode(false);
    } finally {
      setIsSaving(false);
    }
  }, [localLayout, saveLayoutMutation]);

  const handleCancelEdit = useCallback(() => {
    setLocalLayout(null);
    setIsEditMode(false);
    setDragState({ isDragging: false, dragIndex: null, dropIndex: null });
  }, []);

  const handleResetLayout = useCallback(async () => {
    await resetLayoutMutation({});
    setLocalLayout(null);
  }, [resetLayoutMutation]);

  const handleWidgetResize = useCallback((widgetId: WidgetId, size: WidgetSize) => {
    setLocalLayout((prev) => {
      const layout = prev || currentLayout;
      return {
        ...layout,
        widgets: layout.widgets.map((w) =>
          w.widgetId === widgetId ? { ...w, size } : w
        ),
        updatedAt: Date.now(),
      };
    });
  }, [currentLayout]);

  const handleWidgetToggleVisibility = useCallback((widgetId: WidgetId, visible: boolean) => {
    setLocalLayout((prev) => {
      const layout = prev || currentLayout;
      return {
        ...layout,
        widgets: layout.widgets.map((w) =>
          w.widgetId === widgetId ? { ...w, visible } : w
        ),
        updatedAt: Date.now(),
      };
    });
  }, [currentLayout]);

  // Update widget settings (for persisting widget-specific preferences like expanded state)
  const handleWidgetSettingsChange = useCallback((widgetId: WidgetId, settings: Record<string, unknown>) => {
    setLocalLayout((prev) => {
      const layout = prev || currentLayout;
      return {
        ...layout,
        widgets: layout.widgets.map((w) =>
          w.widgetId === widgetId 
            ? { ...w, settings: { ...w.settings, ...settings } } 
            : w
        ),
        updatedAt: Date.now(),
      };
    });
    // Auto-save widget settings changes (don't require user to hit save)
    // This is a smoother UX for preference changes
    setIsSaving(true);
    const layout = localLayout || currentLayout;
    const updatedWidgets = layout.widgets.map((w) =>
      w.widgetId === widgetId 
        ? { ...w, settings: { ...w.settings, ...settings } } 
        : w
    );
    saveLayoutMutation({ 
      layout: { ...layout, widgets: updatedWidgets, updatedAt: Date.now() } 
    })
      .then(() => {
        setIsSaving(false);
      })
      .catch(() => {
        setIsSaving(false);
      });
  }, [currentLayout, localLayout, saveLayoutMutation]);

  const handleDragStart = useCallback((index: number) => {
    setDragState({ isDragging: true, dragIndex: index, dropIndex: index });
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    setDragState((prev) => ({ ...prev, dropIndex: index }));
  }, []);

  const handleDragEnd = useCallback(() => {
    const { dragIndex, dropIndex } = dragState;
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      setLocalLayout((prev) => {
        const layout = prev || currentLayout;
        const widgets = [...layout.widgets].sort((a, b) => a.order - b.order);
        const [moved] = widgets.splice(dragIndex, 1);
        widgets.splice(dropIndex, 0, moved);
        // Reassign orders
        const reordered = widgets.map((w, i) => ({ ...w, order: i }));
        return {
          ...layout,
          widgets: reordered,
          updatedAt: Date.now(),
        };
      });
    }
    setDragState({ isDragging: false, dragIndex: null, dropIndex: null });
  }, [dragState, currentLayout]);

  return (
    <div className="space-y-4 pb-4">
      {/* Header Card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          {/* Edit mode toolbar */}
          <SignedIn>
            <EditModeToolbar
              isEditMode={isEditMode}
              onToggleEditMode={handleToggleEditMode}
              onOpenWidgetPanel={() => setWidgetPanelOpen(true)}
              hasChanges={hasChanges}
              onSave={handleSaveLayout}
              onCancel={handleCancelEdit}
              isSaving={isSaving}
            />
          </SignedIn>
          <SignedOut>
            <div /> {/* Spacer */}
          </SignedOut>
          
          {/* Dashboard-specific time range picker (independent from global) */}
          <LocalDateRangePicker
            preset={dashboardPreset}
            label={label}
            onChange={setDashboardPreset}
            options={[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "week", label: "This Week" },
              { value: "last-week", label: "Last Week" },
              { value: "month", label: "This Month" },
              { value: "last-month", label: "Last Month" },
            ]}
          />
        </div>

        <SignedOut>
          <div className="text-center py-6">
            <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign in to view your finances
            </div>
            <SignInButton mode="modal">
              <button
                className="rounded-lg px-5 py-2.5 font-semibold text-sm"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          {!entries || !inbox ? (
            <div className="space-y-4">
              <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
                <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface-subtle)" }} />
              </div>
            </div>
          ) : (
            <PeriodComparisonCards
              label={label}
              previousLabel="vs last period"
              income={computed.income}
              expense={computed.expense}
              previousIncome={dashboardData?.periodComparison?.previous.incomeCents}
              previousExpense={dashboardData?.periodComparison?.previous.expenseCents}
              isLoading={!dashboardData}
            />
          )}
        </SignedIn>
      </div>

      {/* Widget Grid - Customizable */}
      <SignedIn>
        <div className={`grid grid-cols-2 gap-4 ${isEditMode ? "select-none" : ""}`}>
          {sortedWidgets.map((placement, index) => {
            const { widgetId, size, visible } = placement;
            
            // Skip hidden widgets when not in edit mode
            if (!visible && !isEditMode) return null;

            // Render each widget based on its ID
            const renderWidget = () => {
              switch (widgetId) {
                case "accountability":
                  if (!accountabilityData || accountabilityData.alerts.length === 0) return null;
                  return (
                    <AccountabilityCard
                      data={accountabilityData}
                      isLoading={!accountabilityData}
                      onAction={(actionType) => {
                        switch (actionType) {
                          case "add_transaction":
                            setQuickLogOpen(true);
                            break;
                          case "adjust_budget":
                            setActiveTab("budgeting");
                            break;
                          case "add_income":
                            setRecurringEditorType("income");
                            setRecurringEditorOpen(true);
                            break;
                          case "link_account":
                            setActiveTab("accounts");
                            break;
                          case "review_goal":
                            setActiveTab("goals");
                            break;
                          default:
                            break;
                        }
                      }}
                    />
                  );
                
                case "review-alert":
                  if (reviewCount === 0) return null;
                  return (
                    <ReviewAlertCard
                      data={{
                        count: reviewCount,
                        totalAmountCents: dashboardData?.reviewTotalCents,
                      }}
                      onAction={() => setActiveTab("activity")}
                      variant="prominent"
                    />
                  );
                
                case "net-worth":
                  if (!dashboardData?.accounts || dashboardData.accounts.balances.length === 0) return null;
                  return (
                    <NetWorthSummaryCard
                      data={dashboardData.accounts}
                      isLoading={!dashboardData}
                      expanded={netWorthExpanded}
                      onToggleExpand={() => setNetWorthExpanded(!netWorthExpanded)}
                      onManageAccounts={() => setActiveTab("accounts")}
                    />
                  );
                
                case "safe-to-spend":
                  return (
                    <SafeToSpendModule
                      data={dashboardData?.safeToSpend ?? null}
                      isLoading={!dashboardData}
                      expanded={safeToSpendExpanded}
                      onToggleExpand={() => setSafeToSpendExpanded(!safeToSpendExpanded)}
                    />
                  );
                
                case "payday-countdown":
                  return (
                    <PaydayCountdownModule
                      nextPayday={dashboardData?.nextPayday ?? null}
                      upcomingIncome={dashboardData?.upcomingIncome}
                      isLoading={!dashboardData}
                      onAddIncome={() => {
                        setRecurringEditorType("income");
                        setRecurringEditorOpen(true);
                      }}
                    />
                  );
                
                case "budget-health":
                  return (
                    <BudgetHealthRingsModule
                      budgets={dashboardData?.budgetStatus ?? []}
                      isLoading={!dashboardData}
                      maxItems={5}
                    />
                  );
                
                case "goals-preview":
                  return (
                    <GoalsPreviewModule
                      goals={(dashboardData?.goals?.active ?? []).map(g => ({
                        id: g.id,
                        name: g.name,
                        targetCents: g.targetCents,
                        currentCents: g.currentCents,
                        remainingCents: g.remainingCents,
                        monthlyContributionCents: g.monthlyContributionCents,
                        periodContributionCents: g.periodContributionCents,
                      }))}
                      isLoading={!dashboardData}
                      maxItems={2}
                      onViewAll={() => setActiveTab("goals")}
                    />
                  );
                
                case "upcoming-bills":
                  return (
                    <UpcomingBillsModule
                      bills={(dashboardData?.upcomingBills ?? []).filter(b => b.type === "expense")}
                      isLoading={!dashboardData}
                      maxItems={5}
                    />
                  );
                
                case "quick-actions":
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setActiveTab("budgeting")}
                        className="rounded-xl p-4 text-left transition-colors"
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Lucide.Wallet className="h-6 w-6 mb-2" style={{ color: "var(--primary)" }} />
                        <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                          Budgets
                        </div>
                        <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                          Track spending
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab("goals")}
                        className="rounded-xl p-4 text-left transition-colors"
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Lucide.Target className="h-6 w-6 mb-2" style={{ color: "var(--success)" }} />
                        <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                          Goals
                        </div>
                        <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                          Save smarter
                        </div>
                      </button>
                    </div>
                  );
                
                case "recent-transactions":
                  if (!entries || entries.length === 0) return null;
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-h2" style={{ color: "var(--text)" }}>
                          Recent
                        </h2>
                        <button
                          onClick={() => setActiveTab("activity")}
                          className="text-meta font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          View all
                        </button>
                      </div>

                      <div className="space-y-2">
                        {recentEntries.map((entry) => (
                          <button
                            key={entry._id}
                            onClick={() => setEditingEntry(entry)}
                            className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: entry.type === "income" ? "var(--success-subtle)" : "var(--surface-2)",
                              }}
                            >
                              {entry.type === "income" ? (
                                <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                              ) : (
                                <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="text-body font-medium truncate" style={{ color: "var(--text)" }}>
                                {getCategoryDisplayName(
                                  entry.categoryId ?? entry.category ?? entry.bucket ?? entry.note,
                                  allCustomCategories
                                )}
                              </div>
                              <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                                {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                            </div>
                            <div
                              className="text-body font-medium tabular-nums"
                              style={{ color: entry.type === "income" ? "var(--success)" : "var(--text)" }}
                            >
                              {entry.type === "income" ? "+" : "-"}{centsToDollars(entry.amountCents)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                
                case "category-breakdown":
                  if (!entries) return null;
                  return (
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <button
                        onClick={() => setBreakdownOpen(!breakdownOpen)}
                        className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-subtle)]"
                      >
                        <div className="text-left">
                          <span className="text-h2 block" style={{ color: "var(--text)" }}>
                            Spending by Category
                          </span>
                          {computed.topCategory && !breakdownOpen && (
                            <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                              Top: {computed.topCategory[0]} — {centsToDollars(computed.topCategory[1])}
                            </span>
                          )}
                        </div>
                        {breakdownOpen ? (
                          <Lucide.ChevronDown className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                        ) : (
                          <Lucide.ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                        )}
                      </button>

                      {breakdownOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                          {computed.bucketFinal.length === 0 ? (
                            <div className="pt-4 text-meta">No spending yet.</div>
                          ) : (
                            <div className="pt-3 space-y-3">
                              {computed.bucketFinal.map(([name, v], i) => {
                                const total = computed.bucketFinal.reduce((s, [, val]) => s + val, 0) || 1;
                                const pct = Math.round((v / total) * 100);
                                return (
                                  <Link
                                    key={name}
                                    href={`/activity?category=${encodeURIComponent(String(name))}`}
                                    className="block space-y-1.5 transition-opacity hover:opacity-80"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full"
                                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                        />
                                        <span className="text-body" style={{ color: "var(--text)" }}>{name}</span>
                                      </div>
                                      <span className="text-body tabular-nums font-semibold" style={{ color: "var(--text)" }}>
                                        {centsToDollars(v)}
                                      </span>
                                    </div>
                                    <div
                                      className="h-1.5 rounded-full overflow-hidden"
                                      style={{ backgroundColor: "var(--surface-subtle)" }}
                                    >
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                      />
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          )}

                          <Link
                            href="/insights"
                            className="block text-center text-meta font-semibold pt-2"
                            style={{ color: "var(--accent)" }}
                          >
                            View all insights →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                
                // New widgets from other pages
                case "coach-quick-ask":
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Lucide.Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} />
                        <h2 className="text-h2" style={{ color: "var(--text)" }}>Ask Coach</h2>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = coachQuickAskInput.trim();
                          if (trimmed) {
                            router.push(`/coach/ask?q=${encodeURIComponent(trimmed)}`);
                            setCoachQuickAskInput("");
                          }
                        }}
                        className="relative"
                      >
                        <div
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ 
                            backgroundColor: "var(--surface-subtle)", 
                            border: "1px solid var(--border)" 
                          }}
                        >
                          <Lucide.MessageCircle className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                          <input
                            type="text"
                            value={coachQuickAskInput}
                            onChange={(e) => setCoachQuickAskInput(e.target.value)}
                            placeholder="Ask anything about your finances..."
                            className="flex-1 bg-transparent outline-none text-body"
                            style={{ color: "var(--text)" }}
                            aria-label="Ask your financial coach"
                          />
                          {coachQuickAskInput.trim() && (
                            <button
                              type="submit"
                              className="shrink-0 p-2 rounded-lg transition-colors"
                              style={{ backgroundColor: "var(--primary)", color: "#FFFFFF" }}
                              aria-label="Send question"
                            >
                              <Lucide.Send className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  );
                
                case "coach-insights":
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Lucide.Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} />
                          <h2 className="text-h2" style={{ color: "var(--text)" }}>AI Insights</h2>
                        </div>
                        <button
                          onClick={() => setActiveTab("coach")}
                          className="text-meta font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          Ask more
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div 
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: "var(--accent-subtle)" }}
                        >
                          <div className="flex items-start gap-2">
                            <Lucide.TrendingDown className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                            <div>
                              <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                                Spending trend improving
                              </div>
                              <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                                You&apos;ve reduced spending by 12% this month
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveTab("coach")}
                          className="w-full text-center text-meta font-medium py-2"
                          style={{ color: "var(--accent)" }}
                        >
                          Get personalized insights →
                        </button>
                      </div>
                    </div>
                  );
                
                case "spending-trend":
                  if (!entries || entries.length === 0) return null;
                  // Simple spending trend chart
                  const weeklySpending = computed.bucketFinal.slice(0, 5);
                  const maxSpend = Math.max(...weeklySpending.map(([, v]) => v), 1);
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-h2" style={{ color: "var(--text)" }}>Spending Trend</h2>
                        <Link
                          href="/insights"
                          className="text-meta font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          Details
                        </Link>
                      </div>
                      <div className="flex items-end gap-2 h-24">
                        {weeklySpending.map(([name, value], i) => (
                          <div key={name} className="flex-1 flex flex-col items-center gap-1">
                            <div 
                              className="w-full rounded-t-md transition-all"
                              style={{ 
                                height: `${(value / maxSpend) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                                minHeight: "4px"
                              }}
                            />
                            <span 
                              className="text-xs truncate w-full text-center"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {String(name).slice(0, 3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                
                case "income-expense":
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <h2 className="text-h2 mb-3" style={{ color: "var(--text)" }}>This Month</h2>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                            <span className="text-body" style={{ color: "var(--text-secondary)" }}>Income</span>
                          </div>
                          <span className="text-body font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                            +{centsToDollars(computed.income)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--error)" }} />
                            <span className="text-body" style={{ color: "var(--text-secondary)" }}>Expenses</span>
                          </div>
                          <span className="text-body font-semibold tabular-nums" style={{ color: "var(--error)" }}>
                            -{centsToDollars(computed.expense)}
                          </span>
                        </div>
                        <div 
                          className="pt-2 border-t flex items-center justify-between"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <span className="text-body font-medium" style={{ color: "var(--text)" }}>Net</span>
                          <span 
                            className="text-body font-semibold tabular-nums" 
                            style={{ color: computed.income - computed.expense >= 0 ? "var(--success)" : "var(--error)" }}
                          >
                            {computed.income - computed.expense >= 0 ? "+" : ""}{centsToDollars(computed.income - computed.expense)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                
                case "mini-calendar":
                  // Show next 7 days preview
                  const today = new Date();
                  const next7Days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(today);
                    d.setDate(d.getDate() + i);
                    return d;
                  });
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-h2" style={{ color: "var(--text)" }}>This Week</h2>
                        <Link
                          href="/calendar"
                          className="text-meta font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          Full calendar
                        </Link>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {next7Days.map((d, i) => {
                          const isToday = i === 0;
                          return (
                            <div 
                              key={d.toISOString()} 
                              className="text-center p-2 rounded-lg"
                              style={{ 
                                backgroundColor: isToday ? "var(--accent)" : "transparent",
                                color: isToday ? "var(--accent-foreground)" : "var(--text)"
                              }}
                            >
                              <div className="text-xs font-medium" style={{ color: isToday ? "inherit" : "var(--text-tertiary)" }}>
                                {d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
                              </div>
                              <div className="text-body font-semibold">
                                {d.getDate()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {dashboardData?.upcomingBills && dashboardData.upcomingBills.length > 0 && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>
                            {dashboardData.upcomingBills.length} upcoming bill{dashboardData.upcomingBills.length !== 1 ? "s" : ""} this week
                          </div>
                        </div>
                      )}
                    </div>
                  );
                
                case "accounts-summary":
                  if (!dashboardData?.accounts || dashboardData.accounts.balances.length === 0) return null;
                  const accounts = dashboardData.accounts.balances.slice(0, 4);
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-h2" style={{ color: "var(--text)" }}>Accounts</h2>
                        <button
                          onClick={() => setActiveTab("accounts")}
                          className="text-meta font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          Manage
                        </button>
                      </div>
                      <div className="space-y-2">
                        {accounts.map((acc) => (
                          <div key={acc.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <Lucide.Wallet className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                              <span className="text-body" style={{ color: "var(--text)" }}>
                                {acc.name}
                              </span>
                            </div>
                            <span 
                              className="text-body font-semibold tabular-nums"
                              style={{ color: acc.balanceCents >= 0 ? "var(--text)" : "var(--error)" }}
                            >
                              {centsToDollars(acc.balanceCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                
                case "cash-flow-sparkline":
                  if (!entries || entries.length === 0) return null;
                  // Show daily net for last 14 days as sparkline
                  const netAmount = computed.income - computed.expense;
                  const avgDaily = Math.round(netAmount / 30);
                  return (
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-h2" style={{ color: "var(--text)" }}>Cash Flow</h2>
                        <Link
                          href="/insights"
                          className="text-meta font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          Details
                        </Link>
                      </div>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span 
                          className="text-2xl font-bold tabular-nums"
                          style={{ color: netAmount >= 0 ? "var(--success)" : "var(--error)" }}
                        >
                          {netAmount >= 0 ? "+" : ""}{centsToDollars(netAmount)}
                        </span>
                        <span className="text-meta" style={{ color: "var(--text-secondary)" }}>
                          this period
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-meta" style={{ color: "var(--text-tertiary)" }}>
                        <Lucide.TrendingUp className="h-4 w-4" />
                        <span>≈ {avgDaily >= 0 ? "+" : ""}{centsToDollars(avgDaily)}/day average</span>
                      </div>
                    </div>
                  );
                
                case "net-income-calendar":
                  // Get saved settings for this widget
                  const calendarSettings = placement.settings as { 
                    expanded?: boolean; 
                    viewMonths?: 12 | 24;
                  } | undefined;
                  return (
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <NetIncomeCalendar 
                        defaultExpanded={calendarSettings?.expanded ?? false}
                        defaultViewMonths={calendarSettings?.viewMonths ?? 12}
                        onExpandedChange={(expanded) => {
                          handleWidgetSettingsChange("net-income-calendar", { expanded });
                        }}
                        onViewMonthsChange={(viewMonths) => {
                          handleWidgetSettingsChange("net-income-calendar", { viewMonths });
                        }}
                      />
                    </div>
                  );
                
                default:
                  return null;
              }
            };

            const widgetContent = renderWidget();
            
            // Don't render wrapper for widgets that return null (unless in edit mode)
            if (!widgetContent && !isEditMode) return null;

            return (
              <WidgetWrapper
                key={widgetId}
                widgetId={widgetId}
                size={size}
                visible={visible}
                isEditMode={isEditMode}
                index={index}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                onResize={handleWidgetResize}
                onToggleVisibility={handleWidgetToggleVisibility}
              >
                {widgetContent || (
                  <div 
                    className="rounded-2xl p-8 text-center"
                    style={{ 
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      minHeight: 100,
                    }}
                  >
                    <span className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                      No data
                    </span>
                  </div>
                )}
              </WidgetWrapper>
            );
          })}
        </div>
      </SignedIn>

      {/* Widget Panel */}
      <WidgetPanel
        isOpen={widgetPanelOpen}
        onClose={() => setWidgetPanelOpen(false)}
        widgets={sortedWidgets}
        onToggleWidget={handleWidgetToggleVisibility}
        onResetLayout={handleResetLayout}
      />

      {/* Edit Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
      
      {/* Quick Log Modal - for "Add Transaction" actions from accountability alerts */}
      <QuickLogModal
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
      />
      
      {/* Recurring Rule Editor - for "Add Income Source" actions from accountability alerts */}
      <RuleEditorDialog
        open={recurringEditorOpen}
        onClose={() => setRecurringEditorOpen(false)}
        defaultType={recurringEditorType}
      />
    </div>
  );
}
