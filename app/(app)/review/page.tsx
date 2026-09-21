"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import RecurringModal from "@/components/RecurringModal";
import { 
  centsToDollars, 
  uniqCaseInsensitive,
  getCategoryDisplayName,
} from "@/components/utils";
import { CONTEXT_TAGS } from "@/lib/constants";
import { useToast } from "@/components/ToastProvider";
import EmptyState from "@/components/ui/EmptyState";
import * as Lucide from "lucide-react";
import { useTabs } from "@/components/navigation/tabs";
import Link from "next/link";
import type { Doc, Id } from "convex/_generated/dataModel";

/**
 * Unified Review Page
 * 
 * Two modes:
 * - Quick Triage: Fast resolution with inline actions (formerly /inbox)
 * - Guided Review: Step-by-step wizard for new users (formerly /review)
 * 
 * Mode can be toggled via a switch at the top of the page.
 */

type ReviewMode = "triage" | "guided";
type ReviewTab = "category" | "context" | "account" | "all";
type Step = "confirm" | "category" | "tags" | "done";
type EntryDoc = Doc<"entries">;
type EditableEntry = EntryDoc & { type: "expense" | "income" };
type UpdateEntryArgs = {
  id: Id<"entries">;
  category?: string;
  contextTags?: string[];
  methodOrAccount?: string;
  accountId?: Id<"accounts">;
  needsReview?: boolean;
};
type ToastApi = ReturnType<typeof useToast>;

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return undefined;
}

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

export default function UnifiedReviewPage() {
  const { setActiveTab: setNavTab } = useTabs();
  const toast = useToast();
  
  // Mode toggle: "triage" for quick resolution, "guided" for step-by-step wizard
  const [mode, setMode] = useState<ReviewMode>("triage");
  
  // Triage mode state
  const [activeTab, setActiveTab] = useState<ReviewTab>("all");
  const [selectedEntry, setSelectedEntry] = useState<EditableEntry | null>(null);
  
  // Guided mode state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<Step>("confirm");
  const [pendingCategory, setPendingCategory] = useState("");
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [pendingAccountId, setPendingAccountId] = useState<Id<"accounts"> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);

  const inbox = useQuery(api.entries.listInbox, { limit: 200 }) as EntryDoc[] | undefined;
  
  // Fetch user preferences for hidden categories/tags
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});

  const ensureSystemCategories = useMutation(api.categories.ensureSystemCategories);
  const expenseCategoryOptions = useQuery(api.categories.listCategories, { categoryType: "expense" }) as
    | { _id: string; name: string }[]
    | undefined;
  const incomeCategoryOptions = useQuery(api.categories.listCategories, { categoryType: "income" }) as
    | { _id: string; name: string }[]
    | undefined;
  const accounts = useQuery(api.accounts.listAccounts, {}) as
    | { _id: Id<"accounts">; name: string }[]
    | undefined;

  const updateEntry = useMutation(api.entries.updateEntry);

  useEffect(() => {
    ensureSystemCategories().catch(() => {});
  }, [ensureSystemCategories]);
  
  // Get context tags filtered by user preferences
  const filteredContextTags = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenContextTags ?? []).map(t => t.toLowerCase()));
    return CONTEXT_TAGS.filter(tag => !hiddenSet.has(tag.toLowerCase()));
  }, [userPrefs?.hiddenContextTags]);
  
  // Get filtered expense/income categories
  const filteredExpenseCategories = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenExpenseCategories ?? []).map((c) => c.toLowerCase()));
    return (expenseCategoryOptions ?? [])
      .map((c) => c.name)
      .filter((name) => !hiddenSet.has(name.toLowerCase()));
  }, [expenseCategoryOptions, userPrefs?.hiddenExpenseCategories]);
  
  const filteredIncomeCategories = useMemo(() => {
    const hiddenSet = new Set((userPrefs?.hiddenIncomeCategories ?? []).map((c) => c.toLowerCase()));
    return (incomeCategoryOptions ?? [])
      .map((c) => c.name)
      .filter((name) => !hiddenSet.has(name.toLowerCase()));
  }, [incomeCategoryOptions, userPrefs?.hiddenIncomeCategories]);

  const allCategoryOptions = useMemo(() => {
    return [...(expenseCategoryOptions ?? []), ...(incomeCategoryOptions ?? [])];
  }, [expenseCategoryOptions, incomeCategoryOptions]);

  // Categorize entries by what they're missing (for triage tabs)
  const categorizedEntries = useMemo(() => {
    if (!inbox) return { category: [], context: [], account: [], all: [] };
    
    const needsCategory = inbox.filter(e => !e.category && !e.categoryId);
    const needsContext = inbox.filter(e => !e.contextTags || e.contextTags.length === 0);
    const needsAccount = inbox.filter(e => !e.accountId);
    
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
      ...(filteredExpenseCategories as unknown as string[]),
      ...(filteredIncomeCategories as unknown as string[]),
    ]).slice(0, 30);
  }, [filteredExpenseCategories, filteredIncomeCategories]);

  // Tab counts
  const tabCounts = {
    category: categorizedEntries.category.length,
    context: categorizedEntries.context.length,
    account: categorizedEntries.account.length,
    all: categorizedEntries.all.length,
  };

  // Guided mode helpers
  const currentEntry = inbox?.[currentIndex] ?? null;
  const totalCount = inbox?.length ?? 0;
  const guidedNeedsAccount = !!currentEntry && !currentEntry.accountId;

  useEffect(() => {
    setPendingAccountId(currentEntry?.accountId ?? undefined);
  }, [currentEntry?.accountId, currentEntry?._id]);

  const resetForNextEntry = useCallback(() => {
    setPendingCategory("");
    setPendingTags([]);
    setStep("confirm");
  }, []);

  const goToNext = useCallback(() => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((i) => i + 1);
      resetForNextEntry();
    } else {
      setStep("done");
    }
  }, [currentIndex, totalCount, resetForNextEntry]);

  const skipEntry = useCallback(() => {
    goToNext();
  }, [goToNext]);

  const confirmAndContinue = useCallback(() => {
    if (currentEntry?.category || currentEntry?.categoryId) {
      const display = getCategoryDisplayName(
        currentEntry.categoryId ?? currentEntry.category,
        allCategoryOptions
      );
      setPendingCategory(display);
    }
    if (currentEntry?.tags?.length) {
      setPendingTags(currentEntry.tags);
    }
    setStep("category");
  }, [currentEntry, allCategoryOptions]);

  const selectCategory = useCallback((cat: string) => {
    setPendingCategory(cat);
    setStep("tags");
  }, []);

  const finishReview = useCallback(async () => {
    if (!currentEntry) return;

    setSaving(true);
    try {
      const accountName = pendingAccountId
        ? accounts?.find((a) => a._id === pendingAccountId)?.name
        : undefined;
      const needsAccount = !currentEntry.accountId && !pendingAccountId;
      await updateEntry({
        id: currentEntry._id,
        category: pendingCategory || undefined,
        tags: pendingTags.length > 0 ? pendingTags : undefined,
        accountId: pendingAccountId ?? undefined,
        methodOrAccount: accountName ?? undefined,
        needsReview: needsAccount ? undefined : false,
      });
      setCompleted((c) => c + 1);
      toast.success("Entry reviewed", { description: pendingCategory ? `Categorized as ${pendingCategory}` : undefined });
      goToNext();
    } catch (e) {
      console.error("Failed to update entry:", e);
      toast.error("Failed to save", { description: "Please try again" });
    } finally {
      setSaving(false);
    }
  }, [currentEntry, pendingCategory, pendingTags, pendingAccountId, updateEntry, goToNext, toast, accounts]);

  const toggleTag = useCallback((tag: string) => {
    setPendingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const categoryOptions = useMemo(() => {
    if (!currentEntry) return [];
    const isIncome = currentEntry.type === "income";
    return isIncome ? filteredIncomeCategories : filteredExpenseCategories;
  }, [currentEntry, filteredExpenseCategories, filteredIncomeCategories]);

  // Reset guided mode when switching to it
  const handleModeChange = (newMode: ReviewMode) => {
    if (newMode === "guided") {
      setCurrentIndex(0);
      setStep("confirm");
      setPendingCategory("");
      setPendingTags([]);
      setCompleted(0);
    }
    setMode(newMode);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header with mode toggle */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-h1" style={{ color: "var(--text)" }}>Review</h1>
            <p className="text-meta mt-1" style={{ color: "var(--text-secondary)" }}>
              {mode === "guided" && step === "done"
                ? `All done! Reviewed ${completed} entries.`
                : `${inbox?.length ?? 0} entries to review`}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </Link>
        </div>

        {/* Mode toggle */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <button
            onClick={() => handleModeChange("triage")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: mode === "triage" ? "var(--surface)" : "transparent",
              color: mode === "triage" ? "var(--text)" : "var(--text-secondary)",
              boxShadow: mode === "triage" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Lucide.Zap className="h-4 w-4" />
            Quick Triage
          </button>
          <button
            onClick={() => handleModeChange("guided")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: mode === "guided" ? "var(--surface)" : "transparent",
              color: mode === "guided" ? "var(--text)" : "var(--text-secondary)",
              boxShadow: mode === "guided" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Lucide.Compass className="h-4 w-4" />
            Guided Review
          </button>
        </div>

        {/* Info box for guided mode */}
        {mode === "guided" && step !== "done" && totalCount > 0 && (
          <div 
            className="mt-4 p-3 rounded-lg text-xs"
            style={{ backgroundColor: "var(--accent-subtle)", color: "var(--text-secondary)" }}
          >
            <strong style={{ color: "var(--text)" }}>What happens if I skip?</strong> Nothing bad! 
            Unreviewed entries still appear in your activity and totals. 
            Adding a category just helps with better reports and insights. 
            You can always come back later.
          </div>
        )}

        {/* Progress bar for guided mode */}
        {mode === "guided" && step !== "done" && totalCount > 0 && (
          <div className="mt-4">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--surface-subtle)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${((completed + 1) / totalCount) * 100}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-micro" style={{ color: "var(--text-secondary)" }}>
              <span>{completed + 1} of {totalCount}</span>
              <span>{Math.round(((completed + 1) / totalCount) * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      <SignedOut>
        <EmptyState
          icon={<Lucide.LogIn className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Sign in required"
          subtitle="Sign in to review items."
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
        {mode === "triage" ? (
          /* TRIAGE MODE */
          <>
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
                    onMakeRecurring={() => {
                      if (isEditableEntry(entry)) setSelectedEntry(entry);
                    }}
                    toast={toast}
                    filteredExpenseCategories={filteredExpenseCategories}
                    filteredIncomeCategories={filteredIncomeCategories}
                    filteredContextTags={filteredContextTags}
                    accounts={accounts ?? []}
                    allCategoryOptions={allCategoryOptions}
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
          </>
        ) : (
          /* GUIDED MODE */
          <>
            {step === "done" ? (
              /* Completion screen */
              <div
                className="rounded-xl p-8 text-center"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
                  style={{ backgroundColor: "var(--success-subtle)" }}
                >
                  <Lucide.CheckCircle2 className="h-8 w-8" style={{ color: "var(--success)" }} />
                </div>
                <h2 className="text-h1 mb-2" style={{ color: "var(--text)" }}>All caught up!</h2>
                <p className="text-meta mb-6" style={{ color: "var(--text-secondary)" }}>
                  You reviewed {completed} {completed === 1 ? "entry" : "entries"}
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/dashboard"
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    Back to Home
                  </Link>
                  <Link
                    href="/insights"
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors border"
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    View Insights
                  </Link>
                </div>
              </div>
            ) : !currentEntry ? (
              /* No entries to review */
              <EmptyState
                icon={<Lucide.CheckCircle2 className="h-8 w-8" style={{ color: "var(--success)" }} />}
                title="Nothing to review"
                subtitle="All your entries are categorized"
                action={
                  <Link
                    href="/dashboard"
                    className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
                    style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                  >
                    Back to Home
                  </Link>
                }
              />
            ) : (
              /* Review wizard steps */
              <div className="space-y-4">
                {/* Entry card */}
                <div
                  className="rounded-xl p-5"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor:
                          currentEntry.type === "income"
                            ? "var(--success-subtle)"
                            : "var(--surface-subtle)",
                      }}
                    >
                      {currentEntry.type === "income" ? (
                        <Lucide.ArrowDownLeft className="h-6 w-6" style={{ color: "var(--success)" }} />
                      ) : (
                        <Lucide.ArrowUpRight className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-h2 truncate" style={{ color: "var(--text)" }}>
                        {currentEntry.note || currentEntry.merchant || "Untitled"}
                      </div>
                      <div className="text-meta mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {new Date(currentEntry.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      {currentEntry.methodOrAccount && (
                        <div className="text-meta mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          {currentEntry.methodOrAccount}
                        </div>
                      )}
                    </div>
                    <div
                      className="text-xl font-bold tabular-nums"
                      style={{
                        color: currentEntry.type === "income" ? "var(--success)" : "var(--text)",
                      }}
                    >
                      {currentEntry.type === "income" ? "+" : "−"}
                      {centsToDollars(Math.abs(currentEntry.amountCents))}
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className="mt-4 flex gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          currentEntry.type === "income"
                            ? "var(--success-subtle)"
                            : "var(--danger-subtle)",
                        color:
                          currentEntry.type === "income" ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {currentEntry.type === "income" ? (
                        <>
                          <Lucide.ArrowDownLeft className="h-3 w-3" />
                          Received
                        </>
                      ) : (
                        <>
                          <Lucide.ArrowUpRight className="h-3 w-3" />
                          Spent
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Step content */}
                {step === "confirm" && (
                  <div
                    className="rounded-xl p-5"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <h3 className="text-h2 mb-4" style={{ color: "var(--text)" }}>
                      Step 1: Confirm details
                    </h3>
                    <p className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                      Does this look correct?
                    </p>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                        <span className="text-meta">Type</span>
                        <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                          {currentEntry.type === "income" ? "Received" : "Spent"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                        <span className="text-meta">Amount</span>
                        <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                          {centsToDollars(currentEntry.amountCents)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-meta">Date</span>
                        <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                          {new Date(currentEntry.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {guidedNeedsAccount && (accounts ?? []).length > 0 && (
                      <div className="mb-6">
                        <div className="text-meta mb-2" style={{ color: "var(--text-secondary)" }}>
                          Choose an account
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(accounts ?? []).map((account) => {
                            const isSelected = pendingAccountId === account._id;
                            return (
                              <button
                                key={account._id}
                                onClick={() => setPendingAccountId(account._id)}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                                style={{
                                  backgroundColor: isSelected ? "var(--primary)" : "var(--surface-2)",
                                  color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                                  border: isSelected ? "none" : "1px solid var(--border)",
                                }}
                              >
                                {account.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={skipEntry}
                        className="flex-1 rounded-lg py-3 text-sm font-medium border transition-colors hover:bg-[var(--surface-subtle)]"
                        style={{ borderColor: "var(--border)", color: "var(--text)" }}
                      >
                        Skip
                      </button>
                      <button
                        onClick={confirmAndContinue}
                        className="flex-1 rounded-lg py-3 text-sm font-semibold"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                      >
                        Looks good
                      </button>
                    </div>
                  </div>
                )}

                {step === "category" && (
                  <div
                    className="rounded-xl p-5"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <h3 className="text-h2 mb-4" style={{ color: "var(--text)" }}>
                      Step 2: Choose category
                    </h3>
                    <p className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                      What type of {currentEntry.type === "income" ? "income" : "expense"} is this?
                    </p>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {categoryOptions.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => selectCategory(cat)}
                          className={`rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                            pendingCategory === cat
                              ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
                              : "hover:bg-[var(--surface-subtle)]"
                          }`}
                          style={{
                            border: `1px solid ${pendingCategory === cat ? "var(--accent)" : "var(--border)"}`,
                            color: pendingCategory === cat ? "var(--accent)" : "var(--text)",
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setStep("confirm")}
                      className="w-full text-center text-meta font-medium py-2"
                      style={{ color: "var(--accent)" }}
                    >
                      ← Back
                    </button>
                  </div>
                )}

                {step === "tags" && (
                  <div
                    className="rounded-xl p-5"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <h3 className="text-h2 mb-4" style={{ color: "var(--text)" }}>
                      Step 3: Add context tags
                    </h3>
                    <p className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                      Select any that apply (optional)
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {filteredContextTags.map((tag) => {
                        const isSelected = pendingTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              isSelected
                                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                                : "border hover:bg-[var(--surface-subtle)]"
                            }`}
                            style={{
                              borderColor: isSelected ? undefined : "var(--border)",
                              color: isSelected ? undefined : "var(--text)",
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected summary */}
                    <div className="mb-6 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                      <div className="text-micro mb-2" style={{ color: "var(--text-secondary)" }}>Review summary:</div>
                      <div className="text-body" style={{ color: "var(--text)" }}>
                        <strong>Category:</strong> {pendingCategory || "None"}
                      </div>
                      {pendingTags.length > 0 && (
                        <div className="text-body mt-1" style={{ color: "var(--text)" }}>
                          <strong>Tags:</strong> {pendingTags.join(", ")}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep("category")}
                        className="flex-1 rounded-lg py-3 text-sm font-medium border transition-colors hover:bg-[var(--surface-subtle)]"
                        style={{ borderColor: "var(--border)", color: "var(--text)" }}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={finishReview}
                        disabled={saving}
                        className="flex-1 rounded-lg py-3 text-sm font-semibold disabled:opacity-60"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                      >
                        {saving ? "Saving…" : "Done"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </SignedIn>

      {selectedEntry ? (
        <RecurringModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      ) : null}
    </div>
  );
}

/**
 * Individual review item with inline quick actions (for triage mode)
 */
function ReviewTriageItem({
  entry,
  onUpdate,
  catSuggestions,
  onMakeRecurring,
  toast,
  filteredExpenseCategories,
  filteredIncomeCategories,
  filteredContextTags,
  accounts,
  allCategoryOptions,
}: {
  entry: EntryDoc;
  onUpdate: (args: UpdateEntryArgs) => Promise<unknown>;
  catSuggestions: string[];
  onMakeRecurring?: () => void;
  toast: ToastApi;
  filteredExpenseCategories: readonly string[];
  filteredIncomeCategories: readonly string[];
  filteredContextTags: readonly string[];
  accounts: Array<{ _id: Id<"accounts">; name: string }>;
  allCategoryOptions: Array<{ _id: string; name: string }>;
}) {
  const initialCategory = useMemo(() => {
    return getCategoryDisplayName(
      entry.categoryId ?? entry.category,
      allCategoryOptions
    );
  }, [entry.categoryId, entry.category, allCategoryOptions]);
  const [category, setCategory] = useState(initialCategory);
  const [contextTags, setContextTags] = useState<string[]>(entry.contextTags ?? []);
  const [methodOrAccount, setMethodOrAccount] = useState(entry.methodOrAccount ?? "");
  const [accountId, setAccountId] = useState<Id<"accounts"> | undefined>(entry.accountId ?? undefined);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Determine what needs attention
  const needsCategory = !entry.category && !entry.categoryId;
  const needsContext = !entry.contextTags || entry.contextTags.length === 0;
  const needsAccount = !entry.accountId;

  // Quick suggestions for category
  const quickCategories = useMemo(() => {
    const base = entry.type === "income" ? filteredIncomeCategories : filteredExpenseCategories;
    return (base as unknown as string[]).slice(0, 5);
  }, [entry.type, filteredExpenseCategories, filteredIncomeCategories]);

  async function markResolved() {
    setBusy(true);
    try {
      const updates: UpdateEntryArgs = {
        id: entry._id,
        needsReview: false,
      };
      
      if (category.trim()) updates.category = category.trim();
      if (contextTags.length > 0) updates.contextTags = contextTags;
      if (accountId) {
        updates.accountId = accountId;
        const accountName = accounts.find((a) => a._id === accountId)?.name;
        if (accountName) {
          updates.methodOrAccount = accountName;
        }
      } else if (methodOrAccount.trim()) {
        updates.methodOrAccount = methodOrAccount.trim();
      }
      
      await onUpdate(updates);
      toast.success("Resolved");
    } catch (e: unknown) {
      toast.error("Failed to update", { description: errorMessage(e) });
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
    } catch (e: unknown) {
      toast.error("Failed to update", { description: errorMessage(e) });
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
    } catch (e: unknown) {
      toast.error("Failed to update", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function quickSetAccount(account: { _id: Id<"accounts">; name: string }) {
    setBusy(true);
    try {
      await onUpdate({
        id: entry._id,
        accountId: account._id,
        methodOrAccount: account.name,
        needsReview: false,
      });
      setAccountId(account._id);
      setMethodOrAccount(account.name);
      toast.success(`Set account to ${account.name}`);
    } catch (e: unknown) {
      toast.error("Failed to update", { description: errorMessage(e) });
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
      {needsAccount && !needsCategory && !needsContext && !expanded && accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {accounts.slice(0, 6).map((account) => (
            <button
              key={account._id}
              onClick={() => quickSetAccount(account)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              {account.name}
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
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Manage categories in Settings to add or rename options.
            </div>
          </div>

          {/* Context tags */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
              Context
            </label>
            <div className="flex flex-wrap gap-2">
              {filteredContextTags.map((tag) => {
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
              {(accounts ?? []).map((account) => {
                const isSelected = accountId === account._id;
                return (
                  <button
                    key={account._id}
                    onClick={() => {
                      setAccountId(account._id);
                      setMethodOrAccount(account.name);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "var(--surface-2)",
                      color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                      border: isSelected ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {account.name}
                  </button>
                );
              })}
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

function isEditableEntry(entry: EntryDoc): entry is EditableEntry {
  return entry.type === "expense" || entry.type === "income";
}
