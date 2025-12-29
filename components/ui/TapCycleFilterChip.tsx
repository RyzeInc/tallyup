"use client";

import { useCallback, useState } from "react";
import * as Lucide from "lucide-react";

/**
 * TapCycleFilterChip - Tap-based include/exclude cycling filter
 * 
 * States cycle on tap:
 * 1. Neutral (default, no effect) - muted outline
 * 2. Include (explicitly include matching) - accent color
 * 3. Exclude (explicitly remove matching) - subdued alert color
 * 
 * Design rules:
 * - Single tap cycles through states
 * - Visual feedback is immediate and clear
 * - No modals or dropdowns
 * - Tap targets ≥ 44px
 */

export type FilterState = "neutral" | "include" | "exclude";

interface TapCycleFilterChipProps {
  /** Display label for the filter */
  label: string;
  /** Optional icon to show before label */
  icon?: React.ReactNode;
  /** Current filter state */
  state: FilterState;
  /** Called when state changes */
  onStateChange: (state: FilterState) => void;
  /** Number of matching items (optional badge) */
  count?: number;
  /** Compact mode for smaller chips */
  compact?: boolean;
}

export function TapCycleFilterChip({
  label,
  icon,
  state,
  onStateChange,
  count,
  compact = false,
}: TapCycleFilterChipProps) {
  // Cycle through states: neutral → include → exclude → neutral
  const handleTap = useCallback(() => {
    const next: FilterState =
      state === "neutral" ? "include" :
      state === "include" ? "exclude" :
      "neutral";
    onStateChange(next);
  }, [state, onStateChange]);

  // State-based styling
  const getStyles = () => {
    switch (state) {
      case "include":
        return {
          backgroundColor: "var(--accent-subtle)",
          borderColor: "var(--primary)",
          color: "var(--primary)",
          iconColor: "var(--primary)",
        };
      case "exclude":
        return {
          backgroundColor: "var(--danger-subtle)",
          borderColor: "var(--danger)",
          color: "var(--danger)",
          iconColor: "var(--danger)",
        };
      case "neutral":
      default:
        return {
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
          iconColor: "var(--text-tertiary)",
        };
    }
  };

  const styles = getStyles();

  return (
    <button
      onClick={handleTap}
      className={`
        flex items-center gap-1.5 rounded-full font-medium transition-all
        ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"}
      `}
      style={{
        backgroundColor: styles.backgroundColor,
        border: `1.5px solid ${styles.borderColor}`,
        color: styles.color,
        minHeight: compact ? 32 : 40,
      }}
      aria-label={`${label}: ${state}`}
      aria-pressed={state !== "neutral"}
    >
      {/* State indicator icon */}
      {state === "include" && (
        <Lucide.Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
      )}
      {state === "exclude" && (
        <Lucide.X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
      )}
      
      {/* Optional custom icon (only in neutral state) */}
      {state === "neutral" && icon && (
        <span style={{ color: styles.iconColor }}>{icon}</span>
      )}
      
      {/* Label */}
      <span>{label}</span>
      
      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <span
          className={`
            flex items-center justify-center rounded-full font-bold
            ${compact ? "h-4 min-w-[16px] px-1 text-[10px]" : "h-5 min-w-[20px] px-1.5 text-[11px]"}
          `}
          style={{
            backgroundColor: state === "neutral" ? "var(--surface-2)" : styles.borderColor,
            color: state === "neutral" ? "var(--text-tertiary)" : "#fff",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/**
 * FilterChipGroup - Manages multiple filter chips with composed logic
 */
interface FilterChipGroupProps {
  children: React.ReactNode;
  /** Label for the group */
  label?: string;
  /** Layout direction */
  direction?: "horizontal" | "vertical";
}

export function FilterChipGroup({
  children,
  label,
  direction = "horizontal",
}: FilterChipGroupProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="text-micro font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </div>
      )}
      <div
        className={`
          flex gap-2
          ${direction === "horizontal" ? "flex-wrap" : "flex-col"}
        `}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Hook to manage filter chip states
 */
interface UseFilterChipsOptions<T extends string> {
  initialStates?: Partial<Record<T, FilterState>>;
}

export function useFilterChips<T extends string>(
  keys: readonly T[],
  options: UseFilterChipsOptions<T> = {}
) {
  const { initialStates } = options;

  // Create initial state map
  const createInitialState = () => {
    const map: Record<T, FilterState> = {} as Record<T, FilterState>;
    for (const key of keys) {
      map[key] = (initialStates as Record<T, FilterState> | undefined)?.[key] ?? "neutral";
    }
    return map;
  };

  const [states, setStates] = useState<Record<T, FilterState>>(createInitialState);

  const setState = useCallback((key: T, state: FilterState) => {
    setStates((prev) => ({ ...prev, [key]: state }));
  }, []);

  const resetAll = useCallback(() => {
    setStates(createInitialState());
  }, [keys, initialStates]);

  const getIncluded = useCallback(() => {
    return keys.filter((k) => states[k] === "include");
  }, [keys, states]);

  const getExcluded = useCallback(() => {
    return keys.filter((k) => states[k] === "exclude");
  }, [keys, states]);

  const hasActiveFilters = useCallback(() => {
    return keys.some((k) => states[k] !== "neutral");
  }, [keys, states]);

  return {
    states,
    setState,
    resetAll,
    getIncluded,
    getExcluded,
    hasActiveFilters,
  };
}

/**
 * Example usage:
 * 
 * const categories = ["Food", "Transport", "Entertainment"] as const;
 * const { states, setState, getIncluded, getExcluded, hasActiveFilters } = useFilterChips(categories);
 * 
 * // In JSX:
 * <FilterChipGroup label="Categories">
 *   {categories.map((cat) => (
 *     <TapCycleFilterChip
 *       key={cat}
 *       label={cat}
 *       state={states[cat]}
 *       onStateChange={(s) => setState(cat, s)}
 *     />
 *   ))}
 * </FilterChipGroup>
 * 
 * // Apply to query:
 * const includeCategories = getIncluded();
 * const excludeCategories = getExcluded();
 */
