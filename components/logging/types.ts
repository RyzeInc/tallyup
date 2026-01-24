/**
 * QuickLog Types - Single source of truth for the unified logging form
 */
import type { Id } from "convex/_generated/dataModel";

// ============================================
// Mode & Transaction Type
// ============================================
export type LogMode = "create" | "resolve";
export type TxType = "spent" | "received" | "transfer";

// ============================================
// Context - Scope (single-select) + Flags (multi-select)
// ============================================
export type ContextScope = "personal" | "shared" | "household" | "partner";
export type ContextFlag =
  | "dependent"
  | "business"
  | "client"
  | "reimbursable"
  | "tax_deductible";

// ============================================
// Intent - Two dimensions
// ============================================
export type IntentNecessity = "essential" | "discretionary";
export type IntentPlanning = "planned" | "unexpected";

export type Intent = {
  necessity?: IntentNecessity;
  planning?: IntentPlanning;
};

// ============================================
// Account Selection
// ============================================
export type AccountSelection = {
  accountId?: Id<"accounts">; // for spent/received
  method?: string; // optional freeform
  fromAccountId?: Id<"accounts">; // transfer source
  toAccountId?: Id<"accounts">; // transfer destination
};

// ============================================
// Recurring Configuration
// ============================================
export type RecurringCadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type Recurring = {
  cadence?: RecurringCadence;
  anchorDate?: string; // ISO date
};

// ============================================
// Transaction Draft (form state)
// ============================================
export type TxDraft = {
  id?: Id<"entries">; // present in resolve mode for existing tx
  type: TxType;
  amount: string; // keep as string while editing
  dateISO: string; // YYYY-MM-DD
  merchant?: string; // Who you paid (e.g., Uber, Walmart)
  title?: string; // What it was for (e.g., Groceries, Lunch with team)
  note?: string;

  categoryId?: string;
  /** Subcategory within the selected category */
  subcategoryId?: string | null;
  
  /** For transfers: Transfer In category (from where) */
  transferFromCategoryId?: string | null;
  /** For transfers: Transfer Out category (to where) */
  transferToCategoryId?: string | null;

  // richer metadata
  contextScope?: ContextScope;
  contextFlags: ContextFlag[];
  intent: Intent;
  tags: string[];
  account: AccountSelection;
  goalId?: Id<"goals">;

  recurring?: Recurring;

  // computed by submit logic
  needsReview: boolean;
};

// ============================================
// Sheet Keys
// ============================================
export type SheetKey =
  | null
  | "context"
  | "intent"
  | "account"
  | "tags"
  | "note"
  | "recurring"
  | "goal"
  | "subcategory";

// ============================================
// Submit Result
// ============================================
export type SubmitResult =
  | { ok: true; txId: string }
  | { ok: false; error: string };

// ============================================
// Data Source Props (for pickers)
// ============================================
export type CategoryOption = {
  id: string;
  name: string;
  description?: string;
  /** Category slug for matching */
  slug?: string;
  /** Parent category ID for hierarchical categories */
  parentId?: string;
  /** Whether this is a parent category (has children) */
  hasChildren?: boolean;
};

export type AccountOption = {
  id: Id<"accounts">;
  name: string;
  kind?: string;
};

export type GoalOption = {
  id: Id<"goals">;
  name: string;
};

// ============================================
// Details Bar Count Indicators
// ============================================
export type DetailCounts = {
  tags: number;
  hasNote: boolean;
  hasContext: boolean;
  hasIntent: boolean;
  hasAccount: boolean;
  hasRecurring: boolean;
  hasGoal: boolean;
};
