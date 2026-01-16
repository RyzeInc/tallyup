"use client";

import * as React from "react";
import { reducer, createInitialState, validate, deriveNeedsReview } from "./machine";
import type { LogMode, TxDraft, CategoryOption, AccountOption, GoalOption, SheetKey, ContextFlag, Intent } from "./types";
import * as Lucide from "lucide-react";

import {
  TypeToggle,
  AmountInput,
  MerchantInput,
  DateButton,
  CategoryField,
  DetailsExpander,
  SummaryChips,
  StickyFooter,
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
  expenseCategories: CategoryOption[];
  incomeCategories: CategoryOption[];

  // persist:
  onSubmit: (draft: TxDraft) => Promise<{ ok: true; txId: string } | { ok: false; error: string }>;

  // optional:
  onClose?: () => void;

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

  // Determine categories based on txType, filtering out hidden ones
  const categories = React.useMemo(() => {
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
    return baseCategories.filter(
      (cat) => !hiddenSet.has(cat.name.toLowerCase())
    );
  }, [
    state.draft.type,
    props.expenseCategories,
    props.incomeCategories,
    props.hiddenExpenseCategories,
    props.hiddenIncomeCategories,
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

  // Keyboard behavior: Enter from amount -> merchant, Enter from merchant -> submit if valid
  const amountRef = React.useRef<HTMLInputElement>(null);
  const merchantRef = React.useRef<HTMLInputElement>(null);

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
        {/* Type Toggle */}
        <TypeToggle
          value={state.draft.type}
          onChange={(v) => dispatch({ type: "SET_TYPE", txType: v })}
        />

        {/* Amount */}
        <AmountInput
          ref={amountRef}
          value={state.draft.amount}
          onChange={(v) => dispatch({ type: "SET_AMOUNT", amount: v })}
          onEnterNext={() => merchantRef.current?.focus()}
          showError={showValidationErrors && missing.includes("amount")}
          autoFocus
        />

        {/* Merchant */}
        <MerchantInput
          ref={merchantRef}
          value={state.draft.merchant ?? ""}
          onChange={(v) => dispatch({ type: "SET_MERCHANT", merchant: v })}
          onEnterSubmit={() => dispatch({ type: "SUBMIT" })}
        />

        {/* Date + Category Row */}
        <div className="grid grid-cols-2 gap-3">
          <DateButton
            dateISO={state.draft.dateISO}
            onChange={(iso) => dispatch({ type: "SET_DATE", dateISO: iso })}
            showError={showValidationErrors && missing.includes("date")}
          />

          <CategoryField
            value={state.draft.categoryId}
            categories={categories}
            onChange={(id) => dispatch({ type: "SET_CATEGORY", categoryId: id })}
            required={props.mode === "resolve"}
            showError={showValidationErrors && missing.includes("category")}
          />
        </div>

        {/* Account Selection - Prominent placement for easy card/account selection */}
        {props.accounts.length > 0 && (
          <div>
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Account / Card
            </div>
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
          </div>
        )}

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
    </div>
  );
}
