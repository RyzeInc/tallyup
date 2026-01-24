"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatMoney } from "@/components/utils";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ToastProvider";
import DeletionWarningDialog, { buildRecurringRuleDeletionImpact } from "@/components/shared/DeletionWarningDialog";

type Rule = Doc<"recurringRules">;
type ExpectedCharge = Doc<"expectedCharges">;

interface RulesTabRedesignedProps {
  rules: Rule[] | undefined;
  expectedCharges: ExpectedCharge[] | undefined;
  onEdit: (ruleId: string) => void;
  onCreate: () => void;
}

export default function RulesTabRedesigned({
  rules,
  expectedCharges,
  onEdit,
  onCreate,
}: RulesTabRedesignedProps) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "suggested">("all");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState<"all" | "active" | "suggested" | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteDropdown, setShowDeleteDropdown] = useState(false);
  
  const bulkDeleteRules = useMutation(api.recurring.bulkDeleteRecurringRules);

  if (!rules) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--surface)" }}
          />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Lucide.Settings2 className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
        title="No recurring rules"
        subtitle="Rules define your recurring bills and income. Create one to start tracking."
        action={
          <button
            onClick={onCreate}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--primary)", color: "#fff" }}
          >
            Create rule
          </button>
        }
      />
    );
  }

  // Filter rules
  let filtered = rules;
  if (statusFilter !== "all") {
    filtered = filtered.filter((r) => (r.status ?? "active") === statusFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.displayName ?? r.name ?? "").toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q)
    );
  }

  // Group by status
  const active = filtered.filter((r) => (r.status ?? "active") === "active");
  const paused = filtered.filter((r) => r.status === "paused");
  const suggested = filtered.filter((r) => r.status === "suggested");

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!showBulkDeleteDialog || !rules) return;
    setBulkDeleting(true);
    try {
      // Map dialog option to API status argument
      const statusArg = showBulkDeleteDialog === "all" ? "all" : showBulkDeleteDialog;
      
      const result = await bulkDeleteRules({ status: statusArg });
      toast.success(`Deleted ${result.deletedRules} rules`);
      setShowBulkDeleteDialog(null);
    } catch (e) {
      console.error("Bulk delete failed:", e);
      toast.error("Failed to delete rules");
    } finally {
      setBulkDeleting(false);
    }
  };

  const getBulkDeleteCount = () => {
    if (!rules) return 0;
    if (showBulkDeleteDialog === "all") return rules.length;
    if (showBulkDeleteDialog === "active") return rules.filter(r => (r.status ?? "active") === "active").length;
    if (showBulkDeleteDialog === "suggested") return rules.filter(r => r.status === "suggested").length;
    return 0;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Lucide.Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--text-tertiary)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules..."
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(["all", "active", "paused", "suggested"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
              style={{
                backgroundColor: statusFilter === status ? "var(--primary)" : "var(--surface-2)",
                color: statusFilter === status ? "#fff" : "var(--text-secondary)",
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Create button */}
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "var(--primary)", color: "#fff" }}
        >
          <Lucide.Plus className="h-4 w-4" />
          New rule
        </button>

        {/* Bulk delete dropdown */}
        {rules && rules.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowDeleteDropdown(!showDeleteDropdown)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
            >
              <Lucide.Trash2 className="h-4 w-4" />
              Delete...
              <Lucide.ChevronDown className="h-3 w-3" />
            </button>
            {showDeleteDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDeleteDropdown(false)} 
                />
                <div 
                  className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl shadow-lg border py-1"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <button
                    onClick={() => { setShowBulkDeleteDialog("all"); setShowDeleteDropdown(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                    style={{ color: "var(--danger)" }}
                  >
                    <Lucide.Trash2 className="h-4 w-4" />
                    Delete All Rules ({rules.length})
                  </button>
                  {active.length > 0 && (
                    <button
                      onClick={() => { setShowBulkDeleteDialog("active"); setShowDeleteDropdown(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Lucide.CircleDot className="h-4 w-4" />
                      Delete Active ({active.length})
                    </button>
                  )}
                  {suggested.length > 0 && (
                    <button
                      onClick={() => { setShowBulkDeleteDialog("suggested"); setShowDeleteDropdown(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Lucide.Lightbulb className="h-4 w-4" />
                      Delete Suggested ({suggested.length})
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rules list */}
      <div className="space-y-4">
        {active.length > 0 && (
          <RulesSection
            title="Active"
            rules={active}
            expectedCharges={expectedCharges}
            onEdit={onEdit}
          />
        )}
        {paused.length > 0 && (
          <RulesSection
            title="Paused"
            rules={paused}
            expectedCharges={expectedCharges}
            onEdit={onEdit}
          />
        )}
        {suggested.length > 0 && (
          <RulesSection
            title="Suggested"
            rules={suggested}
            expectedCharges={expectedCharges}
            onEdit={onEdit}
          />
        )}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: "var(--text-tertiary)" }}>
            No rules match your filters
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowBulkDeleteDialog(null)} />
          <div 
            className="relative w-full max-w-sm rounded-xl p-6 shadow-xl"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>
              Delete {showBulkDeleteDialog === "all" ? "All" : showBulkDeleteDialog === "active" ? "Active" : "Suggested"} Rules?
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              This will permanently delete {getBulkDeleteCount()} recurring {getBulkDeleteCount() === 1 ? "rule" : "rules"} and their expected charges. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteDialog(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--danger)", color: "white" }}
              >
                {bulkDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RulesSection({
  title,
  rules,
  expectedCharges,
  onEdit,
}: {
  title: string;
  rules: Rule[];
  expectedCharges?: ExpectedCharge[];
  onEdit: (ruleId: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          {title}
        </div>
        <div
          className="px-1.5 py-0.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--text-tertiary)" }}
        >
          {rules.length}
        </div>
      </div>
      <div
        className="rounded-xl border divide-y"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {rules.map((rule) => (
          <RuleRow
            key={rule._id}
            rule={rule}
            expectedCharges={expectedCharges}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  expectedCharges,
  onEdit,
}: {
  rule: Rule;
  expectedCharges?: ExpectedCharge[];
  onEdit: (ruleId: string) => void;
}) {
  const toast = useToast();
  const updateRule = useMutation(api.recurring.updateRecurringRule);
  const deleteRule = useMutation(api.recurring.deleteRecurringRule);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Query deletion impact when warning dialog is shown
  const ruleDeletionImpact = useQuery(
    api.recurring.getRecurringRuleDeletionImpact,
    showDeleteWarning ? { id: rule._id } : "skip"
  );

  // Get next expected charge for this rule
  const nextCharge = (expectedCharges ?? [])
    .filter((c) => c.ruleId === rule._id && (c.state === "upcoming" || c.state === "due"))
    .sort((a, b) => a.expectedDate - b.expectedDate)[0];

  // Health indicators
  const healthStatus = getHealthStatus(rule, expectedCharges);

  const handlePause = async () => {
    try {
      await updateRule({ id: rule._id, status: "paused", active: false });
      toast.success("Rule paused");
    } catch {
      toast.error("Failed to pause rule");
    }
    setMenuOpen(false);
  };

  const handleActivate = async () => {
    try {
      await updateRule({ id: rule._id, status: "active", active: true });
      toast.success("Rule activated");
    } catch {
      toast.error("Failed to activate rule");
    }
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    setShowDeleteWarning(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteRule({ id: rule._id });
      toast.success("Rule deleted");
      setShowDeleteWarning(false);
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setDeleting(false);
    }
  };

  const ruleName = rule.displayName ?? rule.name ?? rule.category ?? "Unnamed rule";

  return (
    <div
      onClick={() => onEdit(rule._id)}
      className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Icon */}
      <CategoryIcon category={rule.category} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
            {rule.displayName ?? rule.name ?? rule.category ?? "Unnamed rule"}
          </div>
          <HealthBadge status={healthStatus} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <span>{getCadenceLabel(rule)}</span>
          {nextCharge && (
            <>
              <span>•</span>
              <span>Next: {new Date(nextCharge.expectedDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </>
          )}
          {rule.category && (
            <>
              <span>•</span>
              <span>{rule.category}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount + Monthly equivalent */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
          {getAmountLabel(rule)}
        </div>
        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {getMonthlyEquivalent(rule)}
        </div>
      </div>

      {/* Actions menu */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors"
        >
          <Lucide.MoreVertical className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl shadow-lg border py-1"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(rule._id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                style={{ color: "var(--text)" }}
              >
                <Lucide.Pencil className="h-4 w-4" />
                Edit
              </button>
              {(rule.status ?? "active") === "active" ? (
                <button
                  onClick={handlePause}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Lucide.Pause className="h-4 w-4" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                  style={{ color: "var(--success)" }}
                >
                  <Lucide.Play className="h-4 w-4" />
                  Activate
                </button>
              )}
              <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-2)]"
                style={{ color: "var(--error)" }}
              >
                <Lucide.Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Recurring Rule Delete Warning Dialog */}
      <DeletionWarningDialog
        open={showDeleteWarning}
        onClose={() => setShowDeleteWarning(false)}
        onConfirm={confirmDelete}
        impact={buildRecurringRuleDeletionImpact(ruleDeletionImpact ?? null, ruleName)}
        loading={deleting}
        confirmLabel="Delete"
      />
    </div>
  );
}

function CategoryIcon({ category }: { category?: string }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Housing: Lucide.Home,
    Utilities: Lucide.Zap,
    Insurance: Lucide.Shield,
    Subscriptions: Lucide.RefreshCw,
    Transportation: Lucide.Car,
    Food: Lucide.UtensilsCrossed,
    Health: Lucide.Heart,
    Entertainment: Lucide.Film,
    Education: Lucide.GraduationCap,
    Debt: Lucide.CreditCard,
  };
  const Icon = (category && icons[category]) || Lucide.Receipt;

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: "var(--surface-2)" }}
    >
      <Icon className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
    </div>
  );
}

function HealthBadge({ status }: { status: { label: string; color: string; icon: React.ComponentType<{ className?: string }> } }) {
  const Icon = status.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
      style={{ backgroundColor: `${status.color}15`, color: status.color }}
    >
      <Icon className="h-2.5 w-2.5" />
      {status.label}
    </span>
  );
}

function getHealthStatus(rule: Rule, charges?: ExpectedCharge[]): { label: string; color: string; icon: React.ComponentType<{ className?: string }> } {
  if (!charges?.length) {
    return { label: "No data", color: "var(--text-tertiary)", icon: Lucide.HelpCircle };
  }

  const ruleCharges = charges.filter((c) => c.ruleId === rule._id);
  const missed = ruleCharges.filter((c) => c.state === "missed");
  const matched = ruleCharges.filter((c) => c.state === "matched");

  if (missed.length > 0) {
    return { label: "Missed", color: "var(--error)", icon: Lucide.AlertTriangle };
  }
  if (matched.length > 0) {
    return { label: "On track", color: "var(--success)", icon: Lucide.CheckCircle2 };
  }
  if (!rule.cadence?.anchorDate && !rule.cadenceAnchor) {
    return { label: "Needs setup", color: "var(--warning)", icon: Lucide.Settings };
  }
  return { label: "Pending", color: "var(--text-tertiary)", icon: Lucide.Clock };
}

function getCadenceLabel(rule: Rule): string {
  const kind = rule.cadence?.kind ?? rule.cadenceType ?? "monthly";
  switch (kind) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "yearly":
      return "Yearly";
    case "custom_days":
      return `Every ${rule.cadence?.intervalDays ?? rule.intervalDays ?? 30} days`;
    default:
      return "Monthly";
  }
}

function getAmountLabel(rule: Rule): string {
  const cents = rule.amountPolicy?.amountCents ?? rule.amountCents;
  if (!cents) {
    if (rule.amountPolicy?.kind === "variable" || rule.amountMode === "unknown") {
      return "Varies";
    }
    if (rule.amountPolicy?.kind === "range" && rule.amountPolicy.minCents && rule.amountPolicy.maxCents) {
      return `${formatMoney(rule.amountPolicy.minCents)}–${formatMoney(rule.amountPolicy.maxCents)}`;
    }
    return "—";
  }
  return formatMoney(cents);
}

function getMonthlyEquivalent(rule: Rule): string {
  const cents = rule.amountPolicy?.amountCents ?? rule.amountCents;
  if (!cents) return "/mo";

  const kind = rule.cadence?.kind ?? rule.cadenceType ?? "monthly";
  let monthlyAmount = cents;

  switch (kind) {
    case "weekly":
      monthlyAmount = Math.round(cents * 4.33);
      break;
    case "biweekly":
      monthlyAmount = Math.round(cents * 2.17);
      break;
    case "quarterly":
      monthlyAmount = Math.round(cents / 3);
      break;
    case "yearly":
      monthlyAmount = Math.round(cents / 12);
      break;
    case "custom_days":
      const days = rule.cadence?.intervalDays ?? rule.intervalDays ?? 30;
      monthlyAmount = Math.round((cents * 30) / days);
      break;
  }

  if (kind === "monthly") {
    return "/mo";
  }
  return `≈ ${formatMoney(monthlyAmount)}/mo`;
}
