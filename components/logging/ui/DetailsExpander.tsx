"use client";

import * as React from "react";
import type {
  SheetKey,
  DetailCounts,
  ContextScope,
  ContextFlag,
  Intent,
  IntentNecessity,
  IntentPlanning,
  AccountSelection,
  AccountOption,
  GoalOption,
  Recurring,
  RecurringCadence,
} from "../types";
import type { TxType } from "../types";
import * as Lucide from "lucide-react";
import { AddAccountDialog } from "./AddAccountDialog";

// ============================================
// Types
// ============================================
type ExpandedSection = SheetKey;

type DetailsExpanderProps = {
  // Current state
  expandedSection: ExpandedSection;
  onToggleSection: (section: Exclude<SheetKey, null>) => void;
  counts: DetailCounts;
  txType: TxType;

  // Context
  contextScope?: ContextScope;
  contextFlags: ContextFlag[];
  onSetContextScope: (scope?: ContextScope) => void;
  onToggleContextFlag: (flag: ContextFlag) => void;

  // Intent
  intent: Intent;
  onSetIntent: (patch: Partial<Intent>) => void;

  // Account
  account: AccountSelection;
  accounts: AccountOption[];
  onSetAccount: (patch: Partial<AccountSelection>) => void;

  // Tags
  tags: string[];
  tagsCatalog: string[];
  onSetTags: (tags: string[]) => void;

  // Note
  note: string;
  onSetNote: (note: string) => void;

  // Recurring
  recurring?: Recurring;
  onSetRecurring: (recurring?: Recurring) => void;

  // Goal
  goalId?: GoalOption["id"];
  goals: GoalOption[];
  onSetGoal: (goalId?: GoalOption["id"]) => void;

  // Account creation callback (optional)
  onAccountCreated?: (accountId: string, accountName: string) => void;
};

// ============================================
// Constants
// ============================================
const SCOPE_OPTIONS: Array<{ value: ContextScope; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "shared", label: "Shared" },
  { value: "household", label: "Household" },
  { value: "partner", label: "Partner" },
];

const FLAG_OPTIONS: Array<{ value: ContextFlag; label: string }> = [
  { value: "dependent", label: "Dependent" },
  { value: "business", label: "Business" },
  { value: "client", label: "Client" },
  { value: "reimbursable", label: "Reimbursable" },
  { value: "tax_deductible", label: "Tax-Ded." },
];

const NECESSITY_OPTIONS: Array<{ value: IntentNecessity; label: string }> = [
  { value: "essential", label: "Essential" },
  { value: "discretionary", label: "Discretionary" },
];

const PLANNING_OPTIONS: Array<{ value: IntentPlanning; label: string }> = [
  { value: "planned", label: "Planned" },
  { value: "unexpected", label: "Unexpected" },
];

const CADENCE_OPTIONS: Array<{ value: RecurringCadence; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

// ============================================
// Pill Button Component
// ============================================
function Pill({
  label,
  badge,
  isExpanded,
  onClick,
  showPlus = true,
}: {
  label: string;
  badge?: string;
  isExpanded: boolean;
  onClick: () => void;
  showPlus?: boolean;
}) {
  const hasBadge = !!badge;
  const isActive = isExpanded || hasBadge;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all"
      style={{
        backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
        color: isActive ? "var(--primary)" : "var(--text-secondary)",
        border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
      }}
    >
      {showPlus && !hasBadge && !isExpanded && (
        <Lucide.Plus className="h-3 w-3" />
      )}
      {isExpanded && (
        <Lucide.ChevronDown className="h-3 w-3" />
      )}
      {label}
      {badge && !isExpanded && (
        <span className="text-[10px] ml-0.5" style={{ color: "var(--primary)" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================
// Chip Selector (for single/multi select)
// ============================================
function ChipSelector<T extends string>({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: {
  options: Array<{ value: T; label: string }>;
  selected: T | T[] | undefined;
  onSelect: (value: T | undefined) => void;
  multiSelect?: boolean;
}) {
  const selectedArray = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = selectedArray.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (multiSelect) {
                // For multi-select, parent handles toggle
                onSelect(opt.value);
              } else {
                // For single-select, toggle off if already selected
                onSelect(isSelected ? undefined : opt.value);
              }
            }}
            className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: isSelected ? "var(--primary)" : "var(--surface-subtle)",
              color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// Inline Expandable Section Wrapper
// ============================================
function ExpandableSection({
  isExpanded,
  children,
}: {
  isExpanded: boolean;
  children: React.ReactNode;
}) {
  if (!isExpanded) return null;

  return (
    <div
      className="mt-2 p-3 rounded-xl animate-in fade-in slide-in-from-top-1 duration-150"
      style={{
        backgroundColor: "var(--surface-subtle)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// Section Label
// ============================================
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-medium uppercase tracking-wider mb-2"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

// ============================================
// Main DetailsExpander Component
// ============================================
export function DetailsExpander(props: DetailsExpanderProps) {
  const {
    expandedSection,
    onToggleSection,
    counts,
    txType,
    contextScope,
    contextFlags,
    onSetContextScope,
    onToggleContextFlag,
    intent,
    onSetIntent,
    account,
    accounts,
    onSetAccount,
    tags,
    tagsCatalog,
    onSetTags,
    note,
    onSetNote,
    recurring,
    onSetRecurring,
    goalId,
    goals,
    onSetGoal,
    onAccountCreated,
  } = props;

  const [tagSearch, setTagSearch] = React.useState("");
  const [showAddAccountDialog, setShowAddAccountDialog] = React.useState(false);

  // Filter tags catalog
  const filteredTags = React.useMemo(() => {
    if (!tagSearch.trim()) return tagsCatalog;
    const s = tagSearch.toLowerCase();
    return tagsCatalog.filter((t) => t.toLowerCase().includes(s));
  }, [tagsCatalog, tagSearch]);

  // Render context badges
  const contextBadge = React.useMemo(() => {
    const parts: string[] = [];
    if (contextScope) parts.push(contextScope.charAt(0).toUpperCase());
    if (contextFlags.length) parts.push(`+${contextFlags.length}`);
    return parts.length ? parts.join("") : undefined;
  }, [contextScope, contextFlags]);

  // Render intent badge
  const intentBadge = React.useMemo(() => {
    const count = [intent.necessity, intent.planning].filter(Boolean).length;
    return count > 0 ? String(count) : undefined;
  }, [intent]);

  return (
    <div className="space-y-2">
      {/* Primary Pills Row */}
      <div className="flex flex-wrap gap-1.5">
        <Pill
          label="Context"
          badge={contextBadge}
          isExpanded={expandedSection === "context"}
          onClick={() => onToggleSection("context")}
        />
        <Pill
          label="Intent"
          badge={intentBadge}
          isExpanded={expandedSection === "intent"}
          onClick={() => onToggleSection("intent")}
        />
        <Pill
          label="Account"
          badge={counts.hasAccount ? "•" : undefined}
          isExpanded={expandedSection === "account"}
          onClick={() => onToggleSection("account")}
        />
        <Pill
          label="Tags"
          badge={counts.tags ? String(counts.tags) : undefined}
          isExpanded={expandedSection === "tags"}
          onClick={() => onToggleSection("tags")}
        />
        <Pill
          label="Note"
          badge={counts.hasNote ? "•" : undefined}
          isExpanded={expandedSection === "note"}
          onClick={() => onToggleSection("note")}
        />
      </div>

      {/* Secondary Pills Row */}
      <div className="flex flex-wrap gap-1.5">
        <Pill
          label="Recurring"
          badge={counts.hasRecurring ? recurring?.cadence?.slice(0, 3) : undefined}
          isExpanded={expandedSection === "recurring"}
          onClick={() => onToggleSection("recurring")}
          showPlus={false}
        />
        <Pill
          label="Goal"
          badge={counts.hasGoal ? "•" : undefined}
          isExpanded={expandedSection === "goal"}
          onClick={() => onToggleSection("goal")}
          showPlus={false}
        />
      </div>

      {/* Context Expansion */}
      <ExpandableSection isExpanded={expandedSection === "context"}>
        <SectionLabel>Scope</SectionLabel>
        <ChipSelector
          options={SCOPE_OPTIONS}
          selected={contextScope}
          onSelect={onSetContextScope}
        />
        <div className="mt-3">
          <SectionLabel>Flags</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {FLAG_OPTIONS.map((opt) => {
              const isSelected = contextFlags.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggleContextFlag(opt.value)}
                  className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                    color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                    border: isSelected ? "none" : "1px solid var(--border)",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </ExpandableSection>

      {/* Intent Expansion */}
      <ExpandableSection isExpanded={expandedSection === "intent"}>
        <div className="space-y-4">
          {/* Necessity */}
          <div>
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-2 text-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              Necessity
            </div>
            <div
              className="flex rounded-xl p-1"
              style={{ backgroundColor: "var(--surface)" }}
            >
              {NECESSITY_OPTIONS.map((opt) => {
                const isSelected = intent.necessity === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSetIntent({ necessity: isSelected ? undefined : opt.value })}
                    className="flex-1 h-9 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "transparent",
                      color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planning */}
          <div>
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-2 text-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              Planning
            </div>
            <div
              className="flex rounded-xl p-1"
              style={{ backgroundColor: "var(--surface)" }}
            >
              {PLANNING_OPTIONS.map((opt) => {
                const isSelected = intent.planning === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSetIntent({ planning: isSelected ? undefined : opt.value })}
                    className="flex-1 h-9 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "transparent",
                      color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ExpandableSection>

      {/* Account Expansion */}
      <ExpandableSection isExpanded={expandedSection === "account"}>
        {txType === "transfer" ? (
          <div className="space-y-3">
            <div>
              <SectionLabel>From</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((acc) => {
                  const isSelected = account.fromAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSetAccount({ fromAccountId: isSelected ? undefined : acc.id })}
                      className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                        color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                        border: isSelected ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {acc.name}
                    </button>
                  );
                })}
                {/* Add Account Button */}
                <button
                  type="button"
                  onClick={() => setShowAddAccountDialog(true)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--primary)",
                    border: "1px dashed var(--primary)",
                  }}
                >
                  <Lucide.Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
            <div>
              <SectionLabel>To</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((acc) => {
                  const isSelected = account.toAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSetAccount({ toAccountId: isSelected ? undefined : acc.id })}
                      className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                        color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                        border: isSelected ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {acc.name}
                    </button>
                  );
                })}
                {/* Add Account Button */}
                <button
                  type="button"
                  onClick={() => setShowAddAccountDialog(true)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--primary)",
                    border: "1px dashed var(--primary)",
                  }}
                >
                  <Lucide.Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <SectionLabel>Account</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((acc) => {
                  const isSelected = account.accountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSetAccount({ accountId: isSelected ? undefined : acc.id })}
                      className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                        color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                        border: isSelected ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {acc.name}
                    </button>
                  );
                })}
                {/* Add Account Button */}
                <button
                  type="button"
                  onClick={() => setShowAddAccountDialog(true)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    color: "var(--primary)",
                    border: "1px dashed var(--primary)",
                  }}
                >
                  <Lucide.Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
            <div>
              <SectionLabel>Method (optional)</SectionLabel>
              <input
                type="text"
                value={account.method ?? ""}
                onChange={(e) => onSetAccount({ method: e.target.value })}
                placeholder="e.g., Visa *1234"
                className="w-full h-8 px-2.5 text-xs rounded-md"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}
      </ExpandableSection>

      {/* Tags Expansion */}
      <ExpandableSection isExpanded={expandedSection === "tags"}>
        {/* Selected tags */}
        {tags.length > 0 && (
          <div className="mb-3">
            <SectionLabel>Selected</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSetTags(tags.filter((t) => t !== tag))}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {tag}
                  <Lucide.X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-2">
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Search or add..."
            className="w-full h-8 pl-2.5 pr-16 text-xs rounded-md"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagSearch.trim()) {
                e.preventDefault();
                if (!tags.includes(tagSearch.trim())) {
                  onSetTags([...tags, tagSearch.trim()]);
                }
                setTagSearch("");
              }
            }}
          />
          {tagSearch.trim() && !tagsCatalog.includes(tagSearch.trim()) && (
            <button
              type="button"
              onClick={() => {
                if (!tags.includes(tagSearch.trim())) {
                  onSetTags([...tags, tagSearch.trim()]);
                }
                setTagSearch("");
              }}
              className="absolute right-1 top-1 h-6 px-2 rounded text-[10px] font-medium"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Add
            </button>
          )}
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5">
          {filteredTags
            .filter((t) => !tags.includes(t))
            .slice(0, 10)
            .map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSetTags([...tags, tag])}
                className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {tag}
              </button>
            ))}
        </div>
      </ExpandableSection>

      {/* Note Expansion */}
      <ExpandableSection isExpanded={expandedSection === "note"}>
        <textarea
          value={note}
          onChange={(e) => onSetNote(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="w-full px-2.5 py-2 text-xs rounded-md resize-none"
          style={{
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            outline: "none",
          }}
        />
      </ExpandableSection>

      {/* Recurring Expansion */}
      <ExpandableSection isExpanded={expandedSection === "recurring"}>
        <SectionLabel>Cadence</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSetRecurring(undefined)}
            className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: !recurring?.cadence ? "var(--primary)" : "var(--surface)",
              color: !recurring?.cadence ? "var(--primary-foreground)" : "var(--text-secondary)",
              border: !recurring?.cadence ? "none" : "1px solid var(--border)",
            }}
          >
            None
          </button>
          {CADENCE_OPTIONS.map((opt) => {
            const isSelected = recurring?.cadence === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSetRecurring({ ...recurring, cadence: opt.value })}
                className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                  color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                  border: isSelected ? "none" : "1px solid var(--border)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </ExpandableSection>

      {/* Goal Expansion */}
      <ExpandableSection isExpanded={expandedSection === "goal"}>
        <SectionLabel>Link to Goal</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {goals.length === 0 ? (
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              No goals yet
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSetGoal(undefined)}
                className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: !goalId ? "var(--primary)" : "var(--surface)",
                  color: !goalId ? "var(--primary-foreground)" : "var(--text-secondary)",
                  border: !goalId ? "none" : "1px solid var(--border)",
                }}
              >
                None
              </button>
              {goals.map((goal) => {
                const isSelected = goalId === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => onSetGoal(isSelected ? undefined : goal.id)}
                    className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                      color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                      border: isSelected ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {goal.name}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </ExpandableSection>

      {/* Add Account Dialog */}
      <AddAccountDialog
        open={showAddAccountDialog}
        onOpenChange={setShowAddAccountDialog}
        onAccountCreated={onAccountCreated}
      />
    </div>
  );
}
