"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { EXPENSE_SPACES, INCOME_SPACES, CATEGORY_ID_TO_NAME } from "@/components/utils";

/**
 * CategoryOption represents a unified category option for pickers
 * 
 * Supports both:
 * - Built-in categories (from EXPENSE_SPACES/INCOME_SPACES with snake_case IDs)
 * - Custom user categories (from the categories table with Convex IDs)
 */
export interface CategoryOption {
  /** Unique identifier - either snake_case for built-in or Convex ID for custom */
  id: string;
  /** Display name */
  name: string;
  /** Optional icon name (lucide icon) */
  icon?: string;
  /** Optional color for display */
  color?: string;
  /** Description/subtitle */
  description?: string;
  /** Whether this is a built-in category */
  isBuiltIn: boolean;
  /** The category type */
  categoryType: "expense" | "income" | "transfer";
}

/**
 * Built-in expense category definitions with IDs matching CATEGORY_ID_TO_NAME
 */
const BUILT_IN_EXPENSE_CATEGORIES: CategoryOption[] = [
  { id: "housing", name: "Housing", isBuiltIn: true, categoryType: "expense" },
  { id: "utilities", name: "Utilities", isBuiltIn: true, categoryType: "expense" },
  { id: "groceries", name: "Groceries", isBuiltIn: true, categoryType: "expense" },
  { id: "food", name: "Food & Dining", isBuiltIn: true, categoryType: "expense" },
  { id: "transportation", name: "Transportation", isBuiltIn: true, categoryType: "expense" },
  { id: "health", name: "Health", isBuiltIn: true, categoryType: "expense" },
  { id: "supplements", name: "Supplements", description: "Vitamins, protein, health supplements", isBuiltIn: true, categoryType: "expense" },
  { id: "insurance", name: "Insurance", isBuiltIn: true, categoryType: "expense" },
  { id: "debt", name: "Debt", isBuiltIn: true, categoryType: "expense" },
  { id: "subscriptions", name: "Subscriptions", description: "Recurring digital/media services", isBuiltIn: true, categoryType: "expense" },
  { id: "work", name: "Work / Business", isBuiltIn: true, categoryType: "expense" },
  { id: "personal_care", name: "Personal Care", isBuiltIn: true, categoryType: "expense" },
  { id: "entertainment", name: "Entertainment", isBuiltIn: true, categoryType: "expense" },
  { id: "education", name: "Education", isBuiltIn: true, categoryType: "expense" },
  { id: "gifts_giving", name: "Gifts & Giving", isBuiltIn: true, categoryType: "expense" },
  { id: "savings_investing", name: "Savings & Investing", isBuiltIn: true, categoryType: "expense" },
  { id: "miscellaneous", name: "Miscellaneous", isBuiltIn: true, categoryType: "expense" },
];

/**
 * Built-in income category definitions
 */
const BUILT_IN_INCOME_CATEGORIES: CategoryOption[] = [
  { id: "wages_salary", name: "Wages & Salary", isBuiltIn: true, categoryType: "income" },
  { id: "contract_freelance", name: "Contract / Freelance", isBuiltIn: true, categoryType: "income" },
  { id: "business_revenue", name: "Business Revenue", isBuiltIn: true, categoryType: "income" },
  { id: "investment_income", name: "Investment Income", isBuiltIn: true, categoryType: "income" },
  { id: "transfers", name: "Transfers", isBuiltIn: true, categoryType: "income" },
];

export interface UseFilteredCategoriesOptions {
  /** Filter by type: 'expense', 'income', or 'all' */
  type?: "expense" | "income" | "all";
  /** Include user's custom categories from the database */
  includeCustom?: boolean;
}

export interface UseFilteredCategoriesResult {
  /** All available categories (filtered by preferences and type) */
  categories: CategoryOption[];
  /** Expense categories only */
  expenseCategories: CategoryOption[];
  /** Income categories only */
  incomeCategories: CategoryOption[];
  /** Loading state */
  isLoading: boolean;
  /** Get display name for a category ID (handles both built-in and custom) */
  getCategoryName: (categoryIdOrName: string | undefined) => string;
  /** Get category by ID */
  getCategoryById: (id: string) => CategoryOption | undefined;
}

/**
 * Hook to get filtered category lists based on user preferences
 * 
 * This hook:
 * 1. Fetches user preferences to filter out hidden categories
 * 2. Optionally fetches custom categories from the database
 * 3. Returns unified CategoryOption arrays for use in pickers
 * 
 * @example
 * ```tsx
 * const { categories, getCategoryName, isLoading } = useFilteredCategories({ type: 'expense' });
 * 
 * if (isLoading) return <Spinner />;
 * 
 * return categories.map(cat => (
 *   <CategoryChip key={cat.id} name={cat.name} />
 * ));
 * ```
 */
export function useFilteredCategories(
  options: UseFilteredCategoriesOptions = {}
): UseFilteredCategoriesResult {
  const { type = "all", includeCustom = true } = options;

  // Fetch user preferences for hidden categories
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});
  
  // Fetch custom categories if requested
  const customExpenseCategories = useQuery(
    api.categories.listCategories,
    includeCustom ? { categoryType: "expense" } : "skip"
  );
  const customIncomeCategories = useQuery(
    api.categories.listCategories,
    includeCustom ? { categoryType: "income" } : "skip"
  );

  const isLoading = userPrefs === undefined || 
    (includeCustom && (customExpenseCategories === undefined || customIncomeCategories === undefined));

  // Build hidden sets from preferences
  const hiddenExpenseSet = useMemo(
    () => new Set(userPrefs?.hiddenExpenseCategories ?? []),
    [userPrefs?.hiddenExpenseCategories]
  );
  
  const hiddenIncomeSet = useMemo(
    () => new Set(userPrefs?.hiddenIncomeCategories ?? []),
    [userPrefs?.hiddenIncomeCategories]
  );

  // Filter expense categories
  const expenseCategories = useMemo(() => {
    // Start with built-in categories, filtered by user preferences
    const builtIn = BUILT_IN_EXPENSE_CATEGORIES.filter(
      cat => !hiddenExpenseSet.has(cat.id) && !hiddenExpenseSet.has(cat.name)
    );

    // Add custom categories from database
    const custom: CategoryOption[] = (customExpenseCategories ?? []).map(cat => ({
      id: cat._id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isBuiltIn: false,
      categoryType: "expense" as const,
    }));

    return [...builtIn, ...custom];
  }, [hiddenExpenseSet, customExpenseCategories]);

  // Filter income categories
  const incomeCategories = useMemo(() => {
    // Start with built-in categories, filtered by user preferences
    const builtIn = BUILT_IN_INCOME_CATEGORIES.filter(
      cat => !hiddenIncomeSet.has(cat.id) && !hiddenIncomeSet.has(cat.name)
    );

    // Add custom categories from database
    const custom: CategoryOption[] = (customIncomeCategories ?? []).map(cat => ({
      id: cat._id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      isBuiltIn: false,
      categoryType: "income" as const,
    }));

    return [...builtIn, ...custom];
  }, [hiddenIncomeSet, customIncomeCategories]);

  // Combined categories based on type filter
  const categories = useMemo(() => {
    switch (type) {
      case "expense":
        return expenseCategories;
      case "income":
        return incomeCategories;
      case "all":
      default:
        return [...expenseCategories, ...incomeCategories];
    }
  }, [type, expenseCategories, incomeCategories]);

  // Build a lookup map for fast category name resolution
  const categoryLookup = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    
    // Add all categories to lookup
    for (const cat of [...expenseCategories, ...incomeCategories]) {
      map.set(cat.id, cat);
      // Also index by lowercase name for fallback matching
      map.set(cat.name.toLowerCase(), cat);
    }
    
    return map;
  }, [expenseCategories, incomeCategories]);

  // Get display name for a category (handles IDs, names, and legacy formats)
  const getCategoryName = useMemo(() => {
    return (categoryIdOrName: string | undefined): string => {
      if (!categoryIdOrName) return "Uncategorized";
      
      // First, check our lookup map
      const fromLookup = categoryLookup.get(categoryIdOrName) ?? 
                         categoryLookup.get(categoryIdOrName.toLowerCase());
      if (fromLookup) return fromLookup.name;
      
      // Check the static CATEGORY_ID_TO_NAME map (for snake_case IDs)
      const fromStatic = CATEGORY_ID_TO_NAME[categoryIdOrName];
      if (fromStatic) return fromStatic;
      
      // Check if it matches any EXPENSE_SPACES or INCOME_SPACES directly
      const allSpaces = [...EXPENSE_SPACES, ...INCOME_SPACES];
      const exactMatch = allSpaces.find(
        s => s.toLowerCase() === categoryIdOrName.toLowerCase()
      );
      if (exactMatch) return exactMatch;
      
      // Last resort: return the input as-is (it might already be a display name)
      return categoryIdOrName;
    };
  }, [categoryLookup]);

  // Get category by ID
  const getCategoryById = useMemo(() => {
    return (id: string): CategoryOption | undefined => {
      return categoryLookup.get(id);
    };
  }, [categoryLookup]);

  return {
    categories,
    expenseCategories,
    incomeCategories,
    isLoading,
    getCategoryName,
    getCategoryById,
  };
}

export default useFilteredCategories;
