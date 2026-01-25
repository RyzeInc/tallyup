"use client";

import * as React from "react";
import { reducer, createInitialState, validate, deriveNeedsReview } from "./machine";
import type { LogMode, TxDraft, CategoryOption, AccountOption, GoalOption, SheetKey, ContextFlag, Intent } from "./types";
import * as Lucide from "lucide-react";

import {
  TypeToggle,
  AmountInput,
  MerchantInput,
  TitleInput,
  DateButton,
  CategoryField,
  DetailsExpander,
  SummaryChips,
  StickyFooter,
  AddAccountDialog,
} from "./ui";

export type QuickLogFormProps = {
  mode: LogMode;
  nowDateISO: string;

  // for resolve mode:
  existing?: Partial<TxDraft>;

  // data sources for pickers:
  accounts: AccountOption[];
  tagsCatalog: string[];
  goals: GoalOption[];
  /** Top-level expense categories (no subcategories) - for the Category dropdown */
  expenseCategories: CategoryOption[];
  /** Top-level income categories (no subcategories) - for the Category dropdown */
  incomeCategories: CategoryOption[];
  /** All expense categories including subcategories - for SubcategoryField */
  allExpenseCategories?: CategoryOption[];
  /** All income categories including subcategories - for SubcategoryField */
  allIncomeCategories?: CategoryOption[];
  /** Transfer categories (includes subcategories for From/To) */
  transferCategories?: CategoryOption[];

  // persist:
  onSubmit: (draft: TxDraft) => Promise<{ ok: true; txId: string } | { ok: false; error: string }>;

  // optional:
  onClose?: () => void;
  
  /** Called when user creates a custom category by typing */
  onCreateCategory?: (name: string, type: "expense" | "income") => Promise<CategoryOption> | CategoryOption;

  // Hidden categories/tags from user preferences (filter out from UI)
  hiddenExpenseCategories?: string[];
  hiddenIncomeCategories?: string[];
  hiddenContextTags?: string[];
};
export function QuickLogForm(props: QuickLogFormProps) {
  const [state, dispatch] = React.useReducer(
    reducer,
    createInitialState({
      mode: props.mode,
      nowDateISO: props.nowDateISO,
      existing: props.existing,
    })
  );

  // Add account dialog state
  const [showAddAccountDialog, setShowAddAccountDialog] = React.useState(false);

  // Top-level categories for the Category dropdown (no subcategories)
  const categories = React.useMemo(() => {
    // For transfers, use transfer categories (filter to top-level only)
    if (state.draft.type === "transfer") {
      return (props.transferCategories ?? []).filter(c => !c.parentId);
    }
    const baseCategories =
      state.draft.type === "received"
        ? props.incomeCategories
        : props.expenseCategories;
    const hiddenSet = new Set(
      (
        state.draft.type === "received"
          ? props.hiddenIncomeCategories
          : props.hiddenExpenseCategories
      )?.map((c) => c.toLowerCase())
    );
    // These should already be top-level only, but double-check
    return baseCategories
      .filter((cat) => !cat.parentId)
      .filter((cat) => !hiddenSet.has(cat.name.toLowerCase()));
  }, [
    state.draft.type,
    props.expenseCategories,
    props.incomeCategories,
    props.transferCategories,
    props.hiddenExpenseCategories,
    props.hiddenIncomeCategories,
  ]);

  // All categories including subcategories (for SubcategoryField)
  const allCategoriesForSubcategory = React.useMemo(() => {
    if (state.draft.type === "transfer") {
      return props.transferCategories ?? [];
    }
    return state.draft.type === "received"
      ? (props.allIncomeCategories ?? props.incomeCategories)
      : (props.allExpenseCategories ?? props.expenseCategories);
  }, [
    state.draft.type,
    props.allExpenseCategories,
    props.allIncomeCategories,
    props.expenseCategories,
    props.incomeCategories,
    props.transferCategories,
  ]);

  // keep mode/existing in sync if parent changes (dialog re-open, etc.)
  React.useEffect(() => {
    dispatch({
      type: "OPEN",
      payload: {
        mode: props.mode,
        nowDateISO: props.nowDateISO,
        existing: props.existing,
      },
    });
  }, [props.mode, props.nowDateISO, props.existing]);

  const { canSubmit, missing } = validate(state);

  // Show validation errors when user attempted submit with missing fields
  const showValidationErrors = state.status === "error" && state.lastError === "Missing required fields.";

  // Submit side-effect runner
  React.useEffect(() => {
    if (state.status !== "submitting") return;

    let cancelled = false;
    (async () => {
      const result = await props.onSubmit(state.draft);
      if (cancelled) return;
      if (result.ok) dispatch({ type: "SUBMIT_SUCCESS", result });
      else dispatch({ type: "SUBMIT_ERROR", result });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Auto-close on success (common for dialog)
  React.useEffect(() => {
    if (state.status !== "success") return;
    // policy: close dialog in resolve mode, reset in create mode
    if (props.mode === "resolve") {
      props.onClose?.();
    } else {
      dispatch({ type: "RESET_AFTER_SUCCESS" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, props.mode]);

  // Keyboard behavior: Enter from amount -> merchant, Enter from merchant -> title, Enter from title -> submit if valid
  const amountRef = React.useRef<HTMLInputElement>(null);
  const merchantRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (state.focusTarget === "amount") amountRef.current?.focus();
    if (state.focusTarget === "merchant") merchantRef.current?.focus();
  }, [state.focusTarget]);

  const title = props.mode === "resolve" ? "Add Details" : "Log";
  const ctaLabel = props.mode === "resolve" ? "Save" : "Save entry";

  // Compute detail counts
  const detailCounts = {
    tags: state.draft.tags.length,
    hasNote: !!(state.draft.note && state.draft.note.trim().length > 0),
    hasContext:
      !!state.draft.contextScope || state.draft.contextFlags.length > 0,
    hasIntent: Object.keys(state.draft.intent).length > 0,
    hasAccount:
      state.draft.type === "transfer"
        ? !!state.draft.account.fromAccountId &&
          !!state.draft.account.toAccountId
        : !!state.draft.account.accountId,
    hasRecurring: !!state.draft.recurring?.cadence,
    hasGoal: !!state.draft.goalId,
  };

  // Helper text
  const helperText = React.useMemo(() => {
    if (props.mode === "create") {
      const wouldNeedReview = deriveNeedsReview(state);
      if (wouldNeedReview) {
        return "Just the basics for now — add details later in Review.";
      }
      return "You can always edit this later.";
    }
    if (missing.length) {
      return "Add a category to complete.";
    }
    return "Ready to save!";
  }, [props.mode, state, missing.length]);

  // Toggle section: tap once to open, tap again to close
  const handleToggleSection = (section: Exclude<SheetKey, null>) => {
    if (state.openSheet === section) {
      dispatch({ type: "CLOSE_SHEET" });
    } else {
      dispatch({ type: "OPEN_SHEET", sheet: section });
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      {/* Header - Fixed, non-scrolling */}
      <div className="flex-shrink-0 flex items-start justify-between gap-4 px-4 pt-4 pb-2">
        <div>
          <div
            className="text-lg font-semibold"
            style={{ color: "var(--text)" }}
          >
            {title}
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {props.mode === "create"
              ? "Just the basics — add more anytime"
              : "Add a category to help with reports."}
          </div>
        </div>
        {props.onClose && (
          <button
            type="button"
            className="rounded-full p-2 transition-colors hover:bg-[var(--surface-subtle)]"
            onClick={props.onClose}
            aria-label="Close"
          >
            <Lucide.X
              className="h-5 w-5"
              style={{ color: "var(--text-tertiary)" }}
            />
          </button>
        )}
      </div>

      {/* Body - Scrollable region */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4 space-y-4">
        {/* Amount */}
        <AmountInput
          ref={amountRef}
          value={state.draft.amount}
          onChange={(v) => dispatch({ type: "SET_AMOUNT", amount: v })}
          onEnterNext={() => merchantRef.current?.focus()}
          showError={showValidationErrors && missing.includes("amount")}
          autoFocus
        />

        {/* Type Toggle */}
        <TypeToggle
          value={state.draft.type}
          onChange={(v) => dispatch({ type: "SET_TYPE", txType: v })}
        />

        {/* Merchant + Title Row */}
        <div className="flex gap-3">
          <MerchantInput
            ref={merchantRef}
            value={state.draft.merchant ?? ""}
            onChange={(v) => dispatch({ type: "SET_MERCHANT", merchant: v })}
            onEnterNext={() => titleRef.current?.focus()}
          />
          <TitleInput
            ref={titleRef}
            value={state.draft.title ?? ""}
            onChange={(v) => dispatch({ type: "SET_TITLE", title: v })}
            onEnterNext={() => dispatch({ type: "SUBMIT" })}
          />
        </div>

        {/* Date + Category Row */}
        <div className="grid grid-cols-2 gap-3">
          <DateButton
            dateISO={state.draft.dateISO}
            onChange={(iso) => dispatch({ type: "SET_DATE", dateISO: iso })}
            showError={showValidationErrors && missing.includes("date")}
          />

          {state.draft.type === "transfer" ? (
            // Transfer: Show static "Transfer" label - not editable
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-[11px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Category
                </div>
              </div>
              <div
                className="h-11 px-3 rounded-xl flex items-center text-sm font-medium"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Lucide.ArrowLeftRight className="h-4 w-4 mr-2" style={{ color: "var(--text-tertiary)" }} />
                Transfer
              </div>
            </div>
          ) : (
            <CategoryField
              value={state.draft.categoryId}
              categories={categories} // Already filtered to top-level only
              onChange={(id) => dispatch({ type: "SET_CATEGORY", categoryId: id })}
              onCreateCategory={props.onCreateCategory ? (name) => props.onCreateCategory!(name, state.draft.type === "received" ? "income" : "expense") : undefined}
              required={props.mode === "resolve"}
              showError={showValidationErrors && missing.includes("category")}
            />
          )}
        </div>

        {/* Account Selection - Prominent placement for easy card/account selection */}
        <div>
          {state.draft.type === "transfer" ? (
            // Transfer: Show From/To account selection
            <div className="space-y-3">
              <div>
                <div
                  className="text-[10px] font-medium uppercase tracking-wider mb-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  From Account
                </div>
                {props.accounts.length === 0 ? (
                  // Skeleton with Add button when no accounts
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAccountDialog(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--primary)",
                        border: "1px dashed var(--primary)",
                      }}
                    >
                      <Lucide.Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                    {props.accounts
                      .filter((acc) => acc.id !== state.draft.account.toAccountId)
                      .map((acc) => {
                        const isSelected = state.draft.account.fromAccountId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => dispatch({ type: "SET_ACCOUNT", patch: { fromAccountId: isSelected ? undefined : acc.id } })}
                            className="h-9 px-3 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-2"
                            style={{
                              backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                              color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                              border: isSelected ? "none" : "1px solid var(--border)",
                            }}
                          >
                            {acc.kind === "credit" && <Lucide.CreditCard className="h-3.5 w-3.5" />}
                            {acc.kind === "checking" && <Lucide.Landmark className="h-3.5 w-3.5" />}
                            {acc.kind === "savings" && <Lucide.PiggyBank className="h-3.5 w-3.5" />}
                            {!["credit", "checking", "savings"].includes(acc.kind ?? "") && <Lucide.Wallet className="h-3.5 w-3.5" />}
                            {acc.name}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
              <div>
                <div
                  className="text-[10px] font-medium uppercase tracking-wider mb-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  To Account
                </div>
                {props.accounts.length === 0 ? (
                  // Skeleton with Add button when no accounts
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAccountDialog(true)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--primary)",
                        border: "1px dashed var(--primary)",
                      }}
                    >
                      <Lucide.Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                    {props.accounts
                      .filter((acc) => acc.id !== state.draft.account.fromAccountId)
                      .map((acc) => {
                        const isSelected = state.draft.account.toAccountId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => dispatch({ type: "SET_ACCOUNT", patch: { toAccountId: isSelected ? undefined : acc.id } })}
                            className="h-9 px-3 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-2"
                            style={{
                              backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                              color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                              border: isSelected ? "none" : "1px solid var(--border)",
                            }}
                          >
                            {acc.kind === "credit" && <Lucide.CreditCard className="h-3.5 w-3.5" />}
                            {acc.kind === "checking" && <Lucide.Landmark className="h-3.5 w-3.5" />}
                            {acc.kind === "savings" && <Lucide.PiggyBank className="h-3.5 w-3.5" />}
                            {!["credit", "checking", "savings"].includes(acc.kind ?? "") && <Lucide.Wallet className="h-3.5 w-3.5" />}
                            {acc.name}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Regular: Single account selection
            <>
              <div
                className="text-[10px] font-medium uppercase tracking-wider mb-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                Account
              </div>
              {props.accounts.length === 0 ? (
                // Skeleton with Add button when no accounts
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAccountDialog(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: "transparent",
                      color: "var(--primary)",
                      border: "1px dashed var(--primary)",
                    }}
                  >
                    <Lucide.Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                  {props.accounts.map((acc) => {
                    const isSelected = state.draft.account.accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => dispatch({ type: "SET_ACCOUNT", patch: { accountId: isSelected ? undefined : acc.id } })}
                        className="h-9 px-3 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-2"
                        style={{
                          backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                          color: isSelected ? "var(--primary-foreground)" : "var(--text)",
                          border: isSelected ? "none" : "1px solid var(--border)",
                        }}
                      >
                        {acc.kind === "credit" && <Lucide.CreditCard className="h-3.5 w-3.5" />}
                        {acc.kind === "checking" && <Lucide.Landmark className="h-3.5 w-3.5" />}
                        {acc.kind === "savings" && <Lucide.PiggyBank className="h-3.5 w-3.5" />}
                        {!["credit", "checking", "savings"].includes(acc.kind ?? "") && <Lucide.Wallet className="h-3.5 w-3.5" />}
                        {acc.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Inline Details Expander */}
        <DetailsExpander
          expandedSection={state.openSheet}
          onToggleSection={handleToggleSection}
          counts={detailCounts}
          txType={state.draft.type}
          // Context
          contextScope={state.draft.contextScope}
          contextFlags={state.draft.contextFlags}
          onSetContextScope={(scope) =>
            dispatch({ type: "SET_CONTEXT_SCOPE", scope })
          }
          onToggleContextFlag={(flag: ContextFlag) =>
            dispatch({ type: "TOGGLE_CONTEXT_FLAG", flag })
          }
          hiddenContextTags={props.hiddenContextTags}
          // Intent
          intent={state.draft.intent}
          onSetIntent={(patch: Partial<Intent>) =>
            dispatch({ type: "SET_INTENT", patch })
          }
          // Account
          account={state.draft.account}
          accounts={props.accounts}
          onSetAccount={(patch) =>
            dispatch({ type: "SET_ACCOUNT", patch })
          }
          // Account creation - auto-select newly created account
          onAccountCreated={(accountId) => {
            // Auto-select the newly created account
            // The accountId is a string but dispatch expects Id<"accounts">
            // TypeScript will infer it correctly at runtime
            dispatch({ type: "SET_ACCOUNT", patch: { accountId: accountId as unknown as AccountOption["id"] } });
          }}
          // Tags
          tags={state.draft.tags}
          tagsCatalog={props.tagsCatalog}
          onSetTags={(tags) => dispatch({ type: "SET_TAGS", tags })}
          // Note
          note={state.draft.note ?? ""}
          onSetNote={(note) => dispatch({ type: "SET_NOTE", note })}
          // Recurring
          recurring={state.draft.recurring}
          onSetRecurring={(recurring) =>
            dispatch({ type: "SET_RECURRING", patch: recurring })
          }
          // Goal
          goalId={state.draft.goalId}
          goals={props.goals}
          onSetGoal={(goalId) => dispatch({ type: "SET_GOAL", goalId })}
          // Subcategory - pass ALL subcategories, let DetailsExpander filter by selected category
          subcategoryId={state.draft.subcategoryId}
          allSubcategories={allCategoriesForSubcategory.filter(c => c.parentId)} // All items with a parentId
          selectedCategoryId={state.draft.categoryId}
          onSetSubcategory={(subcatId, parentCategoryId) => {
            // Cross-entity sync: if subcategory selected and no category, auto-set category
            if (subcatId && parentCategoryId && !state.draft.categoryId) {
              dispatch({ type: "SET_CATEGORY", categoryId: parentCategoryId });
            }
            dispatch({ type: "SET_SUBCATEGORY", subcategoryId: subcatId });
          }}
          transferFromId={state.draft.transferFromCategoryId}
          transferToId={state.draft.transferToCategoryId}
          transferCategories={props.transferCategories}
          onSetTransferFrom={(id) => dispatch({ type: "SET_TRANSFER_FROM", categoryId: id })}
          onSetTransferTo={(id) => dispatch({ type: "SET_TRANSFER_TO", categoryId: id })}
          parentSlug={allCategoriesForSubcategory.find(c => c.id === state.draft.categoryId)?.slug ?? null}
        />

        {/* Summary Chips */}
        <SummaryChips
          draft={state.draft}
          categories={categories}
          accounts={props.accounts}
          goals={props.goals}
        />
        
        {/* Spacer for any remaining content to clear footer */}
        <div className="h-4" aria-hidden="true" />
      </div>

      {/* Footer CTA - Fixed at bottom, non-scrolling */}
      <StickyFooter
        mode={props.mode}
        status={state.status}
        ctaLabel={ctaLabel}
        canSubmit={canSubmit}
        onSubmit={() => dispatch({ type: "SUBMIT" })}
        helperText={helperText}
        error={state.status === "error" ? state.lastError : undefined}
      />

      {/* Add Account Dialog */}
      <AddAccountDialog
        open={showAddAccountDialog}
        onOpenChange={setShowAddAccountDialog}
        onAccountCreated={(accountId) => {
          // Auto-select the newly created account
          dispatch({ type: "SET_ACCOUNT", patch: { accountId: accountId as unknown as AccountOption["id"] } });
        }}
      />
    </div>
  );
}
