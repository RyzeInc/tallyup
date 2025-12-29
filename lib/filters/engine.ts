/**
 * Filter Engine - Deterministic include/exclude filtering
 * 
 * Resolution rules (per group):
 * 1. If any exclude matches, entry FAILS (exclude takes precedence)
 * 2. If at least one include exists, entry must match one include to PASS
 * 3. If only neutrals, group has no effect (PASS)
 * 
 * Across groups: ALL groups must pass (AND logic)
 */

import { EntryLike, FilterState, TriState } from "./types";

/**
 * Extract values from entry for a given group key
 */
function getGroupValue(entry: EntryLike, groupKey: string): string[] {
  switch (groupKey) {
    case "category":
      return entry.category ? [entry.category] : [];
    case "methodOrAccount":
      return entry.methodOrAccount ? [entry.methodOrAccount] : [];
    case "bucket":
      return entry.bucket ? [entry.bucket] : [];
    case "tag":
    case "tags":
      return Array.isArray(entry.tags) ? entry.tags : [];
    case "type":
      return [entry.type];
    case "platform":
    case "platformType":
      return entry.platformType ? [entry.platformType] : [];
    default:
      return [];
  }
}

/**
 * Split option states into include and exclude sets
 */
function splitTriState(optionStates: Record<string, TriState>) {
  const include = new Set<string>();
  const exclude = new Set<string>();

  for (const [opt, state] of Object.entries(optionStates)) {
    if (state === "include") include.add(opt);
    if (state === "exclude") exclude.add(opt);
  }
  return { include, exclude };
}

/**
 * Returns true if entry matches the given FilterState deterministically.
 */
export function entryMatchesFilters(entry: EntryLike, state: FilterState): boolean {
  for (const [groupKey, optionStates] of Object.entries(state)) {
    const { include, exclude } = splitTriState(optionStates);

    // No active filters in this group
    if (include.size === 0 && exclude.size === 0) continue;

    const values = getGroupValue(entry, groupKey);

    // Exclude takes precedence (fail fast)
    if (values.some((v) => exclude.has(v))) return false;

    // If any includes exist, must match at least one
    if (include.size > 0) {
      const ok = values.some((v) => include.has(v));
      if (!ok) return false;
    }
  }

  return true;
}

/**
 * Filter an array of entries using the filter state
 */
export function filterEntries<T extends EntryLike>(entries: T[], state: FilterState): T[] {
  return entries.filter((entry) => entryMatchesFilters(entry, state));
}

/**
 * Builds a debug string explaining *why* something matched/failed.
 * Useful for validation + tests.
 */
export function explainEntryMatch(entry: EntryLike, state: FilterState): string[] {
  const lines: string[] = [];

  for (const [groupKey, optionStates] of Object.entries(state)) {
    const { include, exclude } = splitTriState(optionStates);
    if (include.size === 0 && exclude.size === 0) continue;

    const values = getGroupValue(entry, groupKey);
    const matchedEx = values.filter((v) => exclude.has(v));
    
    if (matchedEx.length) {
      lines.push(`[${groupKey}] FAIL excluded: ${matchedEx.join(", ")}`);
      continue;
    }

    if (include.size > 0) {
      const matchedIn = values.filter((v) => include.has(v));
      if (!matchedIn.length) {
        lines.push(`[${groupKey}] FAIL missing include: needs one of (${[...include].join(", ")})`);
      } else {
        lines.push(`[${groupKey}] OK include match: ${matchedIn.join(", ")}`);
      }
    } else {
      lines.push(`[${groupKey}] OK (only excludes active, none matched)`);
    }
  }

  if (!lines.length) lines.push("No active filters.");
  return lines;
}

/**
 * Get summary of active filters for display
 */
export function getFilterSummary(state: FilterState): { includes: string[]; excludes: string[] } {
  const includes: string[] = [];
  const excludes: string[] = [];

  for (const [groupKey, optionStates] of Object.entries(state)) {
    for (const [opt, triState] of Object.entries(optionStates)) {
      if (triState === "include") includes.push(`${groupKey}:${opt}`);
      if (triState === "exclude") excludes.push(`${groupKey}:${opt}`);
    }
  }

  return { includes, excludes };
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(state: FilterState): boolean {
  for (const optionStates of Object.values(state)) {
    for (const triState of Object.values(optionStates)) {
      if (triState !== "neutral") return true;
    }
  }
  return false;
}

/**
 * Reset all filters to neutral
 */
export function resetFilters(state: FilterState): FilterState {
  const result: FilterState = {};
  for (const [groupKey, optionStates] of Object.entries(state)) {
    result[groupKey] = {};
    for (const opt of Object.keys(optionStates)) {
      result[groupKey][opt] = "neutral";
    }
  }
  return result;
}
