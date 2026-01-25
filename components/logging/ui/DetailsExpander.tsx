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
import { AddGoalDialog } from "./AddGoalDialog";

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

  // Subcategory
  subcategoryId?: string | null;
  allSubcategories: Array<{ id: string; name: string; slug?: string; parentId?: string | null }>;
  selectedCategoryId?: string | null;
  onSetSubcategory: (id: string | null, parentCategoryId?: string | null) => void;
  // Transfer subcategories
  transferFromId?: string | null;
  transferToId?: string | null;
  transferCategories?: Array<{ id: string; name: string; slug?: string; parentId?: string | null }>;
  onSetTransferFrom?: (id: string | null) => void;
  onSetTransferTo?: (id: string | null) => void;
  parentSlug?: string | null;

  // Account creation callback (optional)
  onAccountCreated?: (accountId: string, accountName: string) => void;
  
  // Goal creation callback (optional)
  onGoalCreated?: (goalId: string, goalName: string) => void;

  // Hidden context tags from user preferences (optional)
  hiddenContextTags?: string[];
};

// ============================================
// Constants
// ============================================
const SCOPE_OPTIONS: Array<{ value: ContextScope; label: string; description?: string }> = [
  { value: "personal", label: "Personal", description: "Just me" },
  { value: "shared", label: "Shared", description: "Split with others" },
  { value: "household", label: "Household", description: "Joint account/expense" },
  { value: "partner", label: "Partner", description: "Paid by partner" },
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
// Subcategory Combobox Component
// ============================================
type SubcategoryItem = { id: string; name: string; slug?: string; parentId?: string | null };

function SubcategoryCombobox({
  subcategories,
  value,
  onChange,
  placeholder = "Select subcategory...",
  helperText,
}: {
  subcategories: SubcategoryItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  helperText?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedItem = subcategories.find(s => s.id === value) ?? null;

  // Filter subcategories by search
  const filtered = React.useMemo(() => {
    if (!search.trim()) return subcategories;
    const q = search.toLowerCase();
    return subcategories.filter(s => s.name.toLowerCase().includes(q));
  }, [subcategories, search]);

  // Handle click outside to close
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {helperText && (
        <p className="text-[10px] mb-1.5" style={{ color: "var(--text-tertiary)" }}>
          {helperText}
        </p>
      )}
      <div
        className="relative flex items-center h-10 rounded-xl border px-3"
        style={{
          backgroundColor: "var(--input)",
          borderColor: isOpen ? "var(--primary)" : "var(--border)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : (selectedItem?.name ?? "")}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
        {value && !isOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setSearch("");
            }}
            className="p-1 rounded-full hover:bg-[var(--surface-subtle)]"
          >
            <Lucide.X className="h-3.5 w-3.5" style={{ color: "var(--text-tertiary)" }} />
          </button>
        )}
        <Lucide.ChevronDown
          className="h-4 w-4 ml-1 transition-transform"
          style={{ 
            color: "var(--text-tertiary)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-xl border shadow-lg"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              No subcategories found
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = value === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setSearch("");
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-subtle)] transition-colors"
                  style={{
                    backgroundColor: isSelected ? "var(--accent-subtle)" : undefined,
                    color: isSelected ? "var(--primary)" : "var(--text)",
                  }}
                >
                  {item.name}
                </button>
              );
            })
          )}
        </div>
      )}
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
    // Tags props - kept in interface for compatibility but no longer rendered
    tags: _tags,
    tagsCatalog: _tagsCatalog,
    onSetTags: _onSetTags,
    note,
    onSetNote,
    recurring,
    onSetRecurring,
    goalId,
    goals,
    onSetGoal,
    onAccountCreated,
    onGoalCreated,
    hiddenContextTags,
    // Subcategory props
    subcategoryId,
    allSubcategories,
    selectedCategoryId,
    onSetSubcategory,
    transferFromId,
    transferToId,
    transferCategories,
    onSetTransferFrom,
    onSetTransferTo,
    parentSlug,
  } = props;

  const [showAddAccountDialog, setShowAddAccountDialog] = React.useState(false);
  const [showAddGoalDialog, setShowAddGoalDialog] = React.useState(false);

  // Filter subcategories by selected category (if one is selected)
  const filteredSubcategories = React.useMemo(() => {
    if (!selectedCategoryId) {
      // No category selected - show ALL subcategories grouped or just return all
      return allSubcategories;
    }
    // Filter to only subcategories of the selected category
    return allSubcategories.filter(c => c.parentId === selectedCategoryId);
  }, [allSubcategories, selectedCategoryId]);

  // Create hidden tags set (lowercase for case-insensitive comparison)
  const hiddenTagsSet = React.useMemo(() => {
    return new Set((hiddenContextTags ?? []).map(t => t.toLowerCase()));
  }, [hiddenContextTags]);

  // Filter scope options based on hidden tags
  const filteredScopeOptions = React.useMemo(() => {
    return SCOPE_OPTIONS.filter(opt => !hiddenTagsSet.has(opt.label.toLowerCase()));
  }, [hiddenTagsSet]);

  // Filter flag options based on hidden tags
  // Note: "Tax-Ded." maps to "Tax-Deductible" in stored preferences
  const filteredFlagOptions = React.useMemo(() => {
    return FLAG_OPTIONS.filter(opt => {
      // Check both the display label and the full form for Tax-Deductible
      const labelLower = opt.label.toLowerCase();
      if (opt.value === "tax_deductible") {
        return !hiddenTagsSet.has("tax-deductible") && !hiddenTagsSet.has("tax-ded.");
      }
      return !hiddenTagsSet.has(labelLower);
    });
  }, [hiddenTagsSet]);

  // Render combined tags badge (context scope + flags + user tags)
  const tagsBadge = React.useMemo(() => {
    const count = 
      (contextScope ? 1 : 0) + 
      contextFlags.length + 
      counts.tags;
    return count > 0 ? String(count) : undefined;
  }, [contextScope, contextFlags.length, counts.tags]);

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
          label="Tags"
          badge={tagsBadge}
          isExpanded={expandedSection === "tags"}
          onClick={() => onToggleSection("tags")}
        />
        <Pill
          label="Intent"
          badge={intentBadge}
          isExpanded={expandedSection === "intent"}
          onClick={() => onToggleSection("intent")}
        />
        <Pill
          label="Note"
          badge={counts.hasNote ? "•" : undefined}
          isExpanded={expandedSection === "note"}
          onClick={() => onToggleSection("note")}
        />
        <Pill
          label="Subcategory"
          badge={subcategoryId ? "•" : undefined}
          isExpanded={expandedSection === "subcategory"}
          onClick={() => onToggleSection("subcategory")}
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

      {/* Tags Expansion - Combined context + user tags */}
      <ExpandableSection isExpanded={expandedSection === "tags"}>
        {/* Context: Who's this for? */}
        <SectionLabel>Context</SectionLabel>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {filteredScopeOptions.map((opt) => {
            const isSelected = contextScope === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSetContextScope(isSelected ? undefined : opt.value)}
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

        {/* Context Flags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {filteredFlagOptions.map((opt) => {
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
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {accounts
                  .filter((acc) => acc.id !== account.toAccountId)
                  .map((acc) => {
                  const isSelected = account.fromAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSetAccount({ fromAccountId: isSelected ? undefined : acc.id })}
                      className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors shrink-0"
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
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors shrink-0"
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
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {accounts
                  .filter((acc) => acc.id !== account.fromAccountId)
                  .map((acc) => {
                  const isSelected = account.toAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSetAccount({ toAccountId: isSelected ? undefined : acc.id })}
                      className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors shrink-0"
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
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <SectionLabel>Account</SectionLabel>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-3 px-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {accounts.map((acc) => {
                  const isSelected = account.accountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSetAccount({ accountId: isSelected ? undefined : acc.id })}
                      className="h-7 px-2.5 rounded-md text-xs font-medium transition-colors shrink-0"
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
              </div>
            </div>
            {/* Helper text */}
            <p className="text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>
              Select which card or account was used for this transaction.
            </p>
          </div>
        )}
      </ExpandableSection>

      {/* Note Expansion (Inline) */}
      <ExpandableSection isExpanded={expandedSection === "note"}>
        <SectionLabel>Note</SectionLabel>
        <textarea
          value={note}
          onChange={(e) => onSetNote(e.target.value)}
          placeholder="Add any details or context..."
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
          style={{
            backgroundColor: "var(--input)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />
        <p className="text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>
          Add any additional context or details about this transaction.
        </p>
      </ExpandableSection>

      {/* Subcategory Expansion */}
      <ExpandableSection isExpanded={expandedSection === "subcategory"}>
        <SectionLabel>Subcategory</SectionLabel>
        <SubcategoryCombobox
          subcategories={selectedCategoryId ? filteredSubcategories : allSubcategories}
          value={subcategoryId ?? null}
          onChange={(id) => {
            const selected = allSubcategories.find(c => c.id === id);
            onSetSubcategory(id, selected?.parentId);
          }}
          placeholder={selectedCategoryId ? "Select subcategory..." : "Select subcategory (will auto-set category)..."}
          helperText={!selectedCategoryId ? "Selecting a subcategory will auto-fill the category" : undefined}
        />
      </ExpandableSection>

      {/* Recurring Expansion */}
      <ExpandableSection isExpanded={expandedSection === "recurring"}>
        <SectionLabel>Cadence</SectionLabel>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CADENCE_OPTIONS.map((opt) => {
            const isSelected = recurring?.cadence === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSetRecurring(isSelected ? undefined : { ...recurring, cadence: opt.value })}
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
        
        {/* Anchor Date - shown when cadence is selected */}
        {recurring?.cadence && (
          <div className="mt-3">
            <SectionLabel>Start Date</SectionLabel>
            <input
              type="date"
              value={recurring.anchorDate || ""}
              onChange={(e) => onSetRecurring({ ...recurring, anchorDate: e.target.value })}
              className="w-full h-9 px-2.5 rounded-md text-xs"
              style={{
                backgroundColor: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                outline: "none",
              }}
            />
            {recurring.anchorDate && (
              <div className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                {(() => {
                  const d = new Date(recurring.anchorDate + "T00:00:00");
                  if (recurring.cadence === "weekly" || recurring.cadence === "biweekly") {
                    return `Runs on ${d.toLocaleDateString(undefined, { weekday: "long" })}s`;
                  }
                  if (recurring.cadence === "yearly") {
                    return `Runs on ${d.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
                  }
                  return `Runs on day ${d.getDate()} each cycle`;
                })()}
              </div>
            )}
          </div>
        )}
      </ExpandableSection>

      {/* Goal Expansion */}
      <ExpandableSection isExpanded={expandedSection === "goal"}>
        <SectionLabel>Link to Goal</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
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
          {/* Add Goal Button */}
          <button
            type="button"
            onClick={() => setShowAddGoalDialog(true)}
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
      </ExpandableSection>

      {/* Add Account Dialog */}
      <AddAccountDialog
        open={showAddAccountDialog}
        onOpenChange={setShowAddAccountDialog}
        onAccountCreated={onAccountCreated}
      />

      {/* Add Goal Dialog */}
      <AddGoalDialog
        open={showAddGoalDialog}
        onOpenChange={setShowAddGoalDialog}
        onGoalCreated={onGoalCreated}
      />
    </div>
  );
}
