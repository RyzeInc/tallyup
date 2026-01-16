export type CategoryType = "expense" | "income";

export type SystemCategory = {
  slug: string;
  name: string;
  categoryType: CategoryType;
};

export const SYSTEM_CATEGORIES: SystemCategory[] = [
  { slug: "housing", name: "Housing", categoryType: "expense" },
  { slug: "utilities", name: "Utilities", categoryType: "expense" },
  { slug: "groceries", name: "Groceries", categoryType: "expense" },
  { slug: "food", name: "Food & Dining", categoryType: "expense" },
  { slug: "transportation", name: "Transportation", categoryType: "expense" },
  { slug: "health", name: "Health", categoryType: "expense" },
  { slug: "supplements", name: "Supplements", categoryType: "expense" },
  { slug: "insurance", name: "Insurance", categoryType: "expense" },
  { slug: "debt", name: "Debt", categoryType: "expense" },
  { slug: "subscriptions", name: "Subscriptions", categoryType: "expense" },
  { slug: "work", name: "Work / Business", categoryType: "expense" },
  { slug: "personal_care", name: "Personal Care", categoryType: "expense" },
  { slug: "entertainment", name: "Entertainment", categoryType: "expense" },
  { slug: "education", name: "Education", categoryType: "expense" },
  { slug: "gifts_giving", name: "Gifts & Giving", categoryType: "expense" },
  { slug: "savings_investing", name: "Savings & Investing", categoryType: "expense" },
  { slug: "miscellaneous", name: "Miscellaneous", categoryType: "expense" },
  { slug: "wages_salary", name: "Wages & Salary", categoryType: "income" },
  { slug: "contract_freelance", name: "Contract / Freelance", categoryType: "income" },
  { slug: "business_revenue", name: "Business Revenue", categoryType: "income" },
  { slug: "investment_income", name: "Investment Income", categoryType: "income" },
  { slug: "transfers", name: "Transfers", categoryType: "income" },
];

export function normalizeCategoryLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const SYSTEM_CATEGORY_BY_SLUG = new Map(
  SYSTEM_CATEGORIES.map((c) => [c.slug, c])
);

export const SYSTEM_CATEGORY_BY_NAME = new Map(
  SYSTEM_CATEGORIES.map((c) => [normalizeCategoryLabel(c.name), c])
);
