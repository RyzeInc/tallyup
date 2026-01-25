/**
 * QuickLog State Machine - Deterministic reducer with validation
 */
import type {
  LogMode,
  SheetKey,
  SubmitResult,
  TxDraft,
  TxType,
  ContextScope,
  ContextFlag,
  Intent,
  AccountSelection,
  Recurring,
} from "./types";

// ============================================
// Machine Status
// ============================================
export type MachineStatus = "editing" | "submitting" | "success" | "error";

// ============================================
// State Shape
// ============================================
export type QuickLogState = {
  mode: LogMode;
  status: MachineStatus;
  openSheet: SheetKey;

  draft: TxDraft;

  // UX flags
  dirty: boolean;
  lastError?: string;

  // runtime: focus hints
  focusTarget?: "amount" | "merchant" | "category";
};

// ============================================
// Init Args
// ============================================
export type InitArgs = {
  mode: LogMode;
  nowDateISO: string;
  existing?: Partial<TxDraft>; // for resolve mode load
};

// ============================================
// Events (Actions)
// ============================================
export type Event =
  | { type: "OPEN"; payload: InitArgs }
  | { type: "CLOSE" }
  | { type: "SET_TYPE"; txType: TxType }
  | { type: "SET_AMOUNT"; amount: string }
  | { type: "SET_DATE"; dateISO: string }
  | { type: "SET_MERCHANT"; merchant: string }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_NOTE"; note: string }
  | { type: "SET_CATEGORY"; categoryId?: string }
  | { type: "SET_SUBCATEGORY"; subcategoryId?: string | null }
  | { type: "SET_TRANSFER_FROM"; categoryId?: string | null }
  | { type: "SET_TRANSFER_TO"; categoryId?: string | null }
  | { type: "SET_CONTEXT_SCOPE"; scope?: ContextScope }
  | { type: "TOGGLE_CONTEXT_FLAG"; flag: ContextFlag }
  | { type: "SET_INTENT"; patch: Partial<Intent> }
  | { type: "SET_TAGS"; tags: string[] }
  | { type: "SET_ACCOUNT"; patch: Partial<AccountSelection> }
  | { type: "SET_GOAL"; goalId?: TxDraft["goalId"] }
  | { type: "SET_RECURRING"; patch?: Recurring } // undefined clears
  | { type: "OPEN_SHEET"; sheet: Exclude<SheetKey, null> }
  | { type: "CLOSE_SHEET" }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCESS"; result: Extract<SubmitResult, { ok: true }> }
  | { type: "SUBMIT_ERROR"; result: Extract<SubmitResult, { ok: false }> }
  | { type: "RESET_AFTER_SUCCESS" };

// ============================================
// Create Initial State
// ============================================
export function createInitialState(args: InitArgs): QuickLogState {
  // Debug: log what we're initializing with
  console.log("[QuickLog machine] createInitialState called with existing:", {
    title: args.existing?.title,
    merchant: args.existing?.merchant,
    subcategoryId: args.existing?.subcategoryId,
    categoryId: args.existing?.categoryId,
  });
  const base: TxDraft = {
    id: args.existing?.id,
    type: args.existing?.type ?? "spent",
    amount: args.existing?.amount ?? "",
    dateISO: args.existing?.dateISO ?? args.nowDateISO,
    merchant: args.existing?.merchant ?? "",
    title: args.existing?.title ?? "",
    note: args.existing?.note ?? "",
    categoryId: args.existing?.categoryId,
    subcategoryId: args.existing?.subcategoryId,
    transferFromCategoryId: args.existing?.transferFromCategoryId,
    transferToCategoryId: args.existing?.transferToCategoryId,
    contextScope: args.existing?.contextScope,
    contextFlags: args.existing?.contextFlags ?? [],
    intent: args.existing?.intent ?? {},
    tags: args.existing?.tags ?? [],
    account: args.existing?.account ?? {},
    goalId: args.existing?.goalId,
    recurring: args.existing?.recurring,
    needsReview: args.existing?.needsReview ?? false,
  };

  return {
    mode: args.mode,
    status: "editing",
    openSheet: null,
    draft: base,
    dirty: false,
    lastError: undefined,
    focusTarget: "amount",
  };
}

// ============================================
// Validation
// ============================================
export type ValidationResult = {
  canSubmit: boolean;
  missing: Array<"amount" | "date" | "category" | "transferAccounts">;
};

export function validate(state: QuickLogState): ValidationResult {
  const missing: Array<"amount" | "date" | "category" | "transferAccounts"> = [];

  const amt = parseAmount(state.draft.amount);
  if (!amt || amt <= 0) missing.push("amount");
  if (!state.draft.dateISO) missing.push("date");

  if (state.draft.type === "transfer") {
    if (
      !state.draft.account.fromAccountId ||
      !state.draft.account.toAccountId
    ) {
      missing.push("transferAccounts");
    }
  }

  if (state.mode === "resolve") {
    if (!state.draft.categoryId) missing.push("category");
  }

  return { canSubmit: missing.length === 0, missing };
}

// ============================================
// Derive needsReview
// ============================================
export function deriveNeedsReview(state: QuickLogState): boolean {
  // In create mode: if category or merchant missing -> needsReview.
  if (state.mode !== "create") return false;
  const hasCategory = !!state.draft.categoryId;
  const hasMerchant = !!(
    state.draft.merchant && state.draft.merchant.trim().length > 0
  );
  return !(hasCategory && hasMerchant);
}

// ============================================
// Reducer
// ============================================
export function reducer(state: QuickLogState, event: Event): QuickLogState {
  switch (event.type) {
    case "OPEN":
      return createInitialState(event.payload);

    case "CLOSE":
      // parent should actually unmount/close UI; this resets local state
      return state;

    case "SET_TYPE": {
      const next = {
        ...state,
        dirty: true,
        draft: { ...state.draft, type: event.txType },
      };

      // if switching away from transfer, clear from/to accounts
      if (event.txType !== "transfer") {
        next.draft.account = {
          ...next.draft.account,
          fromAccountId: undefined,
          toAccountId: undefined,
        };
      }
      return next;
    }

    case "SET_AMOUNT":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, amount: sanitizeAmount(event.amount) },
      };

    case "SET_DATE":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, dateISO: event.dateISO },
      };

    case "SET_MERCHANT":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, merchant: event.merchant },
      };

    case "SET_TITLE":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, title: event.title },
      };

    case "SET_NOTE":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, note: event.note },
      };

    case "SET_CATEGORY":
      return {
        ...state,
        dirty: true,
        // Clear subcategory when parent category changes
        draft: { ...state.draft, categoryId: event.categoryId, subcategoryId: undefined },
        // after selecting category, return focus to none
        focusTarget: undefined,
      };

    case "SET_SUBCATEGORY":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, subcategoryId: event.subcategoryId },
      };

    case "SET_TRANSFER_FROM":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, transferFromCategoryId: event.categoryId },
      };

    case "SET_TRANSFER_TO":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, transferToCategoryId: event.categoryId },
      };

    case "SET_CONTEXT_SCOPE":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, contextScope: event.scope },
      };

    case "TOGGLE_CONTEXT_FLAG": {
      const has = state.draft.contextFlags.includes(event.flag);
      const nextFlags = has
        ? state.draft.contextFlags.filter((f) => f !== event.flag)
        : [...state.draft.contextFlags, event.flag];

      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, contextFlags: nextFlags },
      };
    }

    case "SET_INTENT":
      return {
        ...state,
        dirty: true,
        draft: {
          ...state.draft,
          intent: { ...state.draft.intent, ...event.patch },
        },
      };

    case "SET_TAGS":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, tags: event.tags },
      };

    case "SET_ACCOUNT":
      return {
        ...state,
        dirty: true,
        draft: {
          ...state.draft,
          account: { ...state.draft.account, ...event.patch },
        },
      };

    case "SET_GOAL":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, goalId: event.goalId },
      };

    case "SET_RECURRING":
      return {
        ...state,
        dirty: true,
        draft: { ...state.draft, recurring: event.patch },
      };

    case "OPEN_SHEET":
      return { ...state, openSheet: event.sheet };

    case "CLOSE_SHEET":
      return { ...state, openSheet: null };

    case "SUBMIT": {
      // deterministic gate
      const { canSubmit, missing } = validate(state);
      if (!canSubmit) {
        // focus hint: first missing field
        const focusTarget = missing.includes("amount")
          ? "amount"
          : missing.includes("category")
            ? "category"
            : "merchant";
        return {
          ...state,
          status: "error",
          lastError: "Missing required fields.",
          focusTarget,
        };
      }

      const needsReview = deriveNeedsReview(state);
      return {
        ...state,
        status: "submitting",
        lastError: undefined,
        draft: { ...state.draft, needsReview },
      };
    }

    case "SUBMIT_SUCCESS":
      return { ...state, status: "success", lastError: undefined };

    case "SUBMIT_ERROR":
      return { ...state, status: "error", lastError: event.result.error };

    case "RESET_AFTER_SUCCESS":
      // parent can also just unmount; if not, reset to blank create state
      if (state.mode === "create") {
        const nowISO = state.draft.dateISO;
        return createInitialState({ mode: "create", nowDateISO: nowISO });
      }
      return state;

    default:
      return state;
  }
}

// ============================================
// Helpers
// ============================================
export function sanitizeAmount(input: string): string {
  // allow digits + one dot, limit 2 decimals
  const cleaned = input.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const whole = parts[0] ?? "";
  const dec = parts[1]?.slice(0, 2) ?? "";
  return parts.length > 1 ? `${whole}.${dec}` : whole;
}

export function parseAmount(amount: string): number | null {
  if (!amount) return null;
  const n = Number(amount);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert amount string (dollars) to cents
 */
export function amountToCents(amount: string): number | null {
  const n = parseAmount(amount);
  if (n === null) return null;
  return Math.round(n * 100);
}

/**
 * Convert cents to amount string (dollars)
 */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Convert YYYY-MM-DD to Date object (local midnight)
 */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Convert Date object to YYYY-MM-DD
 */
export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Map TxType to Convex entry type
 */
export function txTypeToEntryType(
  txType: TxType
): "expense" | "income" | "transfer" {
  switch (txType) {
    case "spent":
      return "expense";
    case "received":
      return "income";
    case "transfer":
      return "transfer";
  }
}

/**
 * Map Convex entry type to TxType
 */
export function entryTypeToTxType(
  entryType: "expense" | "income" | "transfer"
): TxType {
  switch (entryType) {
    case "expense":
      return "spent";
    case "income":
      return "received";
    case "transfer":
      return "transfer";
  }
}
