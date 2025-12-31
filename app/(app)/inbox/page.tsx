"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import EntryCard from "@/components/EntryCard";
import RecurringModal from "@/components/RecurringModal";
import { 
  centsToDollars, 
  uniqCaseInsensitive,
  EXPENSE_SPACES,
  INCOME_SPACES,
} from "@/components/utils";
import { CONTEXT_TAGS, INTENT_TAGS } from "@/lib/constants";
import { useToast } from "@/components/ToastProvider";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import * as Lucide from "lucide-react";
import { useTabs } from "@/components/PersistentTabs";

/**
 * Review Triage Screen - Fast resolution of unclear entries
 * 
 * Tabs:
 * - Needs Category
 * - Needs Context
 * - Needs Account
 * - All
 * 
 * Each row has inline actions for quick resolution
 */

type ReviewTab = "category" | "context" | "account" | "all";

// Context tag icons for visual consistency
const CONTEXT_TAG_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "Personal": Lucide.User,
  "Shared": Lucide.Users,
  "Household": Lucide.Home,
  "Partner": Lucide.Heart,
  "Dependent": Lucide.Baby,
  "Business": Lucide.Briefcase,
  "Client": Lucide.Building,
  "Reimbursable": Lucide.Receipt,
  "Tax-Deductible": Lucide.FileText,
};

export default function ReviewTriagePage() {
  const { user } = useUser();
  const { setActiveTab: setNavTab } = useTabs();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<ReviewTab>("all");
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const inbox = useQuery(api.entries.listInbox, { limit: 200 }) as any[] | undefined;

  // Use both types for suggestions
  const expenseCats = useQuery(api.entries.listCategories, { type: "expense", bucket: undefined }) as
    | string[]
    | undefined;
  const incomeCats = useQuery(api.entries.listCategories, { type: "income", bucket: undefined }) as
    | string[]
    | undefined;

  const updateEntry = useMutation(api.entries.updateEntry);

  // Categorize entries by what they're missing
  const categorizedEntries = useMemo(() => {
    if (!inbox) return { category: [], context: [], account: [], all: [] };
    
    const needsCategory = inbox.filter(e => !e.category);
    const needsContext = inbox.filter(e => !e.contextTags || e.contextTags.length === 0);
    const needsAccount = inbox.filter(e => !e.methodOrAccount);
    
    return {
      category: needsCategory,
      context: needsContext,
      account: needsAccount,
      all: inbox,
    };
  }, [inbox]);

  const displayedEntries = categorizedEntries[activeTab];

  const catSuggestions = useMemo(() => {
    return uniqCaseInsensitive([
      ...((expenseCats ?? []) as string[]),
      ...((incomeCats ?? []) as string[]),
      ...(EXPENSE_SPACES as unknown as string[]),
      ...(INCOME_SPACES as unknown as string[]),
    ]).slice(0, 30);
  }, [expenseCats, incomeCats]);

  // Tab counts
  const tabCounts = {
    category: categorizedEntries.category.length,
    context: categorizedEntries.context.length,
    account: categorizedEntries.account.length,
    all: categorizedEntries.all.length,
  };

  return (
    <div>
      <PageHeader
        title="Review Queue"
        subtitle="Resolve items that need attention"
      />

      <SignedOut>
        <EmptyState
          icon={<Lucide.LogIn className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Sign in required"
          subtitle="Sign in to view items that need review."
          action={
            <SignInButton mode="modal">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                Sign in
              </button>
            </SignInButton>
          }
        />
      </SignedOut>

      <SignedIn>
        {/* Tab Bar */}
        <div
          className="mb-4 flex gap-1 p-1 rounded-xl overflow-x-auto"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          {[
            { key: "all" as ReviewTab, label: "All", icon: Lucide.List },
            { key: "category" as ReviewTab, label: "Category", icon: Lucide.Tag },
            { key: "context" as ReviewTab, label: "Context", icon: Lucide.Users },
            { key: "account" as ReviewTab, label: "Account", icon: Lucide.Wallet },
          ].map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? "var(--surface)" : "transparent",
                  color: isActive ? "var(--text)" : "var(--text-secondary)",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: isActive ? "var(--warning)" : "var(--surface-subtle)",
                      color: isActive ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {!inbox ? (
          <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>
        ) : displayedEntries.length === 0 ? (
          <EmptyState
            icon={<Lucide.CheckCircle2 className="h-7 w-7" style={{ color: "var(--success)" }} />}
            title="All caught up!"
            subtitle={
              activeTab === "all"
                ? "Nothing needs review right now."
                : `No items need ${activeTab} information.`
            }
            action={
              <button
                onClick={() => setNavTab("activity")}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
              >
                View Transactions
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {displayedEntries.map((entry) => (
              <ReviewTriageItem
                key={entry._id}
                entry={entry}
                onUpdate={updateEntry}
                catSuggestions={catSuggestions}
                onMakeRecurring={() => setSelectedEntry(entry)}
                toast={toast}
              />
            ))}
            
            {/* Batch actions */}
            {displayedEntries.length > 1 && (
              <div
                className="flex items-center justify-center gap-4 py-4 mt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {displayedEntries.length} items remaining
                </span>
              </div>
            )}
          </div>
        )}
      </SignedIn>

      {selectedEntry ? (
        <RecurringModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      ) : null}
    </div>
  );
}

/**
 * Individual review item with inline quick actions
 */
function ReviewTriageItem({
  entry,
  onUpdate,
  catSuggestions,
  onMakeRecurring,
  toast,
}: {
  entry: any;
  onUpdate: (args: any) => Promise<any>;
  catSuggestions: string[];
  onMakeRecurring?: () => void;
  toast: any;
}) {
  const [category, setCategory] = useState(entry.category ?? "");
  const [contextTags, setContextTags] = useState<string[]>(entry.contextTags ?? []);
  const [methodOrAccount, setMethodOrAccount] = useState(entry.methodOrAccount ?? "");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Determine what needs attention
  const needsCategory = !entry.category;
  const needsContext = !entry.contextTags || entry.contextTags.length === 0;
  const needsAccount = !entry.methodOrAccount;

  // Quick suggestions for category
  const quickCategories = useMemo(() => {
    const base = entry.type === "income" ? INCOME_SPACES : EXPENSE_SPACES;
    return (base as unknown as string[]).slice(0, 5);
  }, [entry.type]);

  async function markResolved() {
    setBusy(true);
    try {
      const updates: any = {
        id: entry._id,
        needsReview: false,
      };
      
      if (category.trim()) updates.category = category.trim();
      if (contextTags.length > 0) updates.contextTags = contextTags;
      if (methodOrAccount.trim()) updates.methodOrAccount = methodOrAccount.trim();
      
      await onUpdate(updates);
      toast.success("Resolved");
    } catch (e: any) {
      toast.error("Failed to update", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  async function quickSetCategory(cat: string) {
    setBusy(true);
    try {
      await onUpdate({
        id: entry._id,
        category: cat,
        needsReview: false,
      });
      toast.success(`Set to ${cat}`);
    } catch (e: any) {
      toast.error("Failed to update", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  async function quickSetContext(ctx: string) {
    setBusy(true);
    try {
      const newContextTags = [...contextTags, ctx];
      await onUpdate({
        id: entry._id,
        contextTags: newContextTags,
        needsReview: false,
      });
      toast.success(`Added ${ctx}`);
    } catch (e: any) {
      toast.error("Failed to update", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  async function quickSetAccount(account: string) {
    setBusy(true);
    try {
      await onUpdate({
        id: entry._id,
        methodOrAccount: account,
        needsReview: false,
      });
      toast.success(`Set account to ${account}`);
    } catch (e: any) {
      toast.error("Failed to update", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  // Badges showing what needs attention
  const badges = [];
  if (needsCategory) badges.push({ label: "Needs category", color: "var(--warning)" });
  if (needsContext) badges.push({ label: "Needs context", color: "var(--accent)" });
  if (needsAccount) badges.push({ label: "Needs account", color: "var(--text-tertiary)" });

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-lg font-semibold tabular-nums"
              style={{ color: entry.type === "income" ? "var(--success)" : "var(--text)" }}
            >
              {entry.type === "income" ? "+" : "-"}{centsToDollars(entry.amountCents)}
            </span>
            {entry.type === "income" ? (
              <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
            ) : (
              <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            )}
          </div>
          
          {/* Date and existing info */}
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            {entry.note && (
              <>
                <span>•</span>
                <span className="truncate">{entry.note}</span>
              </>
            )}
          </div>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {badges.map((badge, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${badge.color}20`,
                  color: badge.color,
                  border: `1px solid ${badge.color}40`,
                }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: expanded ? "var(--surface-2)" : "transparent",
              color: "var(--text-secondary)",
            }}
          >
            {expanded ? (
              <Lucide.ChevronUp className="h-5 w-5" />
            ) : (
              <Lucide.ChevronDown className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Quick category chips - always visible if needed */}
      {needsCategory && !expanded && (
        <div className="flex flex-wrap gap-2 mb-3">
          {quickCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => quickSetCategory(cat)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => setExpanded(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              border: "1px dashed var(--border)",
            }}
          >
            More...
          </button>
        </div>
      )}

      {/* Quick context chips - always visible if needed */}
      {needsContext && !needsCategory && !expanded && (
        <div className="flex flex-wrap gap-2 mb-3">
          {(["Personal", "Business", "Shared", "Household"] as const).map((ctx) => {
            const Icon = CONTEXT_TAG_ICONS[ctx] || Lucide.Tag;
            return (
              <button
                key={ctx}
                onClick={() => quickSetContext(ctx)}
                disabled={busy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon className="h-3 w-3" />
                {ctx}
              </button>
            );
          })}
        </div>
      )}

      {/* Quick account chips - always visible if needed */}
      {needsAccount && !needsCategory && !needsContext && !expanded && (
        <div className="flex flex-wrap gap-2 mb-3">
          {["Cash", "Checking", "Credit Card", "Savings"].map((account) => (
            <button
              key={account}
              onClick={() => quickSetAccount(account)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              {account}
            </button>
          ))}
        </div>
      )}

      {/* Expanded form */}
      {expanded && (
        <div className="space-y-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Category field */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
              Category
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {catSuggestions.slice(0, 8).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: category === cat ? "var(--primary)" : "var(--surface-2)",
                    color: category === cat ? "var(--primary-foreground)" : "var(--text)",
                    border: category === cat ? "none" : "1px solid var(--border)",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Or type a custom category..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          {/* Context tags */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
              Context
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map((tag) => {
                const isSelected = contextTags.includes(tag);
                const Icon = CONTEXT_TAG_ICONS[tag] || Lucide.Tag;
                return (
                  <button
                    key={tag}
                    onClick={() => 
                      setContextTags((prev) => 
                        isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "var(--surface-2)",
                      color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                      border: isSelected ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account/Method */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
              Account / Method
            </label>
            <div className="flex flex-wrap gap-2">
              {["Cash", "Checking", "Savings", "Credit Card"].map((account) => (
                <button
                  key={account}
                  onClick={() => setMethodOrAccount(account)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: methodOrAccount === account ? "var(--primary)" : "var(--surface-2)",
                    color: methodOrAccount === account ? "var(--primary-foreground)" : "var(--text)",
                    border: methodOrAccount === account ? "none" : "1px solid var(--border)",
                  }}
                >
                  {account}
                </button>
              ))}
              <input
                value={!["Cash", "Checking", "Savings", "Credit Card"].includes(methodOrAccount) ? methodOrAccount : ""}
                onChange={(e) => setMethodOrAccount(e.target.value)}
                placeholder="Other..."
                className="flex-1 min-w-[80px] rounded-full px-3 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={markResolved}
              disabled={busy}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Saving..." : "Mark Resolved"}
            </button>
            <button
              onClick={() => onMakeRecurring?.()}
              className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              Save as Pattern
            </button>
          </div>
        </div>
      )}

      {/* Quick resolve button when not expanded */}
      {!expanded && (category || contextTags.length > 0 || methodOrAccount) && (
        <button
          onClick={markResolved}
          disabled={busy}
          className="w-full py-2 rounded-lg text-sm font-medium mt-2"
          style={{
            backgroundColor: "var(--success-subtle)",
            color: "var(--success)",
            border: "1px solid var(--success)",
          }}
        >
          {busy ? "Saving..." : "Mark Resolved"}
        </button>
      )}
    </div>
  );
}
