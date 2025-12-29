/**
 * Filter Types - Deterministic include/exclude logic
 * 
 * Rules:
 * - Neutral: No effect on filtering
 * - Include: Entry must match at least one include in the group
 * - Exclude: Entry is rejected if it matches any exclude
 * - Exclude takes precedence over include
 */

export type TriState = "neutral" | "include" | "exclude";

/**
 * FilterGroup represents one "dimension" of filtering:
 * - key: e.g. "category", "tag", "methodOrAccount"
 * - options: e.g. "Groceries", "Restaurants", ...
 */
export interface FilterGroup {
  key: string;
  label: string;
  options: string[];
}

/**
 * FilterState maps group keys to option states
 * Example: { category: { Groceries: "include", Restaurants: "exclude" } }
 */
export type FilterState = Record<
  string, // group key
  Record<string, TriState> // option -> tri-state
>;

/**
 * EntryLike is the minimum shape needed for filtering
 */
export interface EntryLike {
  category?: string | null;
  tags?: string[] | null;
  methodOrAccount?: string | null;
  bucket?: string | null;
  type: "income" | "expense";
  platformType?: string | null;
}
