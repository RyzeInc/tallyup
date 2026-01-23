/**
 * Category Catalog - Plaid Taxonomy Aligned
 * 
 * Based on Plaid's Personal Finance Categories with PRIMARY → DETAILED hierarchy.
 * For expenses: PRIMARY = category, DETAILED = subcategory
 * For income: Flat categories (no subcategories)
 * For transfers: TRANSFER_IN and TRANSFER_OUT types (From/To)
 */

export type CategoryType = "expense" | "income" | "transfer";

export type SystemCategory = {
  slug: string;
  name: string;
  categoryType: CategoryType;
  /** Parent slug for hierarchy (null = top-level) */
  parentSlug?: string;
  /** Icon name (optional) */
  icon?: string;
  /** Display order within parent */
  displayOrder?: number;
};

// ============================================
// EXPENSE CATEGORIES (Plaid PRIMARY → DETAILED)
// Subcategory displayOrder follows user-specified global order
// ============================================

export const EXPENSE_CATEGORIES: SystemCategory[] = [
  // ── LOAN PAYMENTS ── (displayOrder 19-24)
  { slug: "loan_payments", name: "Loan Payments", categoryType: "expense", icon: "credit-card", displayOrder: 1 },
  { slug: "loan_car_payment", name: "Car Payment", categoryType: "expense", parentSlug: "loan_payments", displayOrder: 19 },
  { slug: "loan_credit_card", name: "Credit Card Payment", categoryType: "expense", parentSlug: "loan_payments", displayOrder: 20 },
  { slug: "loan_personal", name: "Personal Loan Payment", categoryType: "expense", parentSlug: "loan_payments", displayOrder: 21 },
  { slug: "loan_mortgage", name: "Mortgage Payment", categoryType: "expense", parentSlug: "loan_payments", displayOrder: 22 },
  { slug: "loan_student", name: "Student Loan Payment", categoryType: "expense", parentSlug: "loan_payments", displayOrder: 23 },
  { slug: "loan_other", name: "Other Payment", categoryType: "expense", parentSlug: "loan_payments", displayOrder: 24 },

  // ── BANK FEES ── (displayOrder 25-30)
  { slug: "bank_fees", name: "Bank Fees", categoryType: "expense", icon: "building-2", displayOrder: 2 },
  { slug: "bank_fees_atm", name: "ATM Fees", categoryType: "expense", parentSlug: "bank_fees", displayOrder: 25 },
  { slug: "bank_fees_foreign_transaction", name: "Foreign Transaction Fees", categoryType: "expense", parentSlug: "bank_fees", displayOrder: 26 },
  { slug: "bank_fees_insufficient_funds", name: "Insufficient Funds", categoryType: "expense", parentSlug: "bank_fees", displayOrder: 27 },
  { slug: "bank_fees_interest_charge", name: "Interest Charge", categoryType: "expense", parentSlug: "bank_fees", displayOrder: 28 },
  { slug: "bank_fees_overdraft", name: "Overdraft Fees", categoryType: "expense", parentSlug: "bank_fees", displayOrder: 29 },
  { slug: "bank_fees_other", name: "Other Bank Fees", categoryType: "expense", parentSlug: "bank_fees", displayOrder: 30 },

  // ── ENTERTAINMENT ── (displayOrder 31-36)
  { slug: "entertainment", name: "Entertainment", categoryType: "expense", icon: "film", displayOrder: 3 },
  { slug: "entertainment_casinos_gambling", name: "Casinos & Gambling", categoryType: "expense", parentSlug: "entertainment", displayOrder: 31 },
  { slug: "entertainment_music_audio", name: "Music & Audio", categoryType: "expense", parentSlug: "entertainment", displayOrder: 32 },
  { slug: "entertainment_sporting_events", name: "Sporting Events & Museums", categoryType: "expense", parentSlug: "entertainment", displayOrder: 33 },
  { slug: "entertainment_tv_movies", name: "TV & Movies", categoryType: "expense", parentSlug: "entertainment", displayOrder: 34 },
  { slug: "entertainment_video_games", name: "Video Games", categoryType: "expense", parentSlug: "entertainment", displayOrder: 35 },
  { slug: "entertainment_other", name: "Other Entertainment", categoryType: "expense", parentSlug: "entertainment", displayOrder: 36 },

  // ── FOOD AND DRINK ── (displayOrder 37-43)
  { slug: "food_and_drink", name: "Food & Drink", categoryType: "expense", icon: "utensils", displayOrder: 4 },
  { slug: "food_beer_wine_liquor", name: "Beer, Wine & Liquor", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 37 },
  { slug: "food_coffee", name: "Coffee", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 38 },
  { slug: "food_fast_food", name: "Fast Food", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 39 },
  { slug: "food_groceries", name: "Groceries", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 40 },
  { slug: "food_restaurant", name: "Restaurant", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 41 },
  { slug: "food_vending_machines", name: "Vending Machines", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 42 },
  { slug: "food_other", name: "Other Food & Drink", categoryType: "expense", parentSlug: "food_and_drink", displayOrder: 43 },

  // ── GENERAL MERCHANDISE ── (displayOrder 44-57)
  { slug: "general_merchandise", name: "General Merchandise", categoryType: "expense", icon: "shopping-bag", displayOrder: 5 },
  { slug: "merchandise_bookstores", name: "Bookstores & Newsstands", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 44 },
  { slug: "merchandise_clothing", name: "Clothing & Accessories", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 45 },
  { slug: "merchandise_convenience", name: "Convenience Stores", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 46 },
  { slug: "merchandise_department", name: "Department Stores", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 47 },
  { slug: "merchandise_discount", name: "Discount Stores", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 48 },
  { slug: "merchandise_electronics", name: "Electronics", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 49 },
  { slug: "merchandise_gifts", name: "Gifts & Novelties", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 50 },
  { slug: "merchandise_office", name: "Office Supplies", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 51 },
  { slug: "merchandise_online", name: "Online Marketplaces", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 52 },
  { slug: "merchandise_pets", name: "Pet Supplies", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 53 },
  { slug: "merchandise_sporting_goods", name: "Sporting Goods", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 54 },
  { slug: "merchandise_superstores", name: "Superstores", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 55 },
  { slug: "merchandise_tobacco", name: "Tobacco & Vape", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 56 },
  { slug: "merchandise_other", name: "Other General Merchandise", categoryType: "expense", parentSlug: "general_merchandise", displayOrder: 57 },

  // ── HOME IMPROVEMENT ── (displayOrder 58-62)
  { slug: "home_improvement", name: "Home Improvement", categoryType: "expense", icon: "home", displayOrder: 6 },
  { slug: "home_furniture", name: "Furniture", categoryType: "expense", parentSlug: "home_improvement", displayOrder: 58 },
  { slug: "home_hardware", name: "Hardware", categoryType: "expense", parentSlug: "home_improvement", displayOrder: 59 },
  { slug: "home_repair", name: "Repair & Maintenance", categoryType: "expense", parentSlug: "home_improvement", displayOrder: 60 },
  { slug: "home_security", name: "Security", categoryType: "expense", parentSlug: "home_improvement", displayOrder: 61 },
  { slug: "home_other", name: "Other Home Improvement", categoryType: "expense", parentSlug: "home_improvement", displayOrder: 62 },

  // ── MEDICAL ── (displayOrder 63-69)
  { slug: "medical", name: "Medical", categoryType: "expense", icon: "heart-pulse", displayOrder: 7 },
  { slug: "medical_dental", name: "Dental Care", categoryType: "expense", parentSlug: "medical", displayOrder: 63 },
  { slug: "medical_eye", name: "Eye Care", categoryType: "expense", parentSlug: "medical", displayOrder: 64 },
  { slug: "medical_hospitals", name: "Nursing Care", categoryType: "expense", parentSlug: "medical", displayOrder: 65 },
  { slug: "medical_pharmacy", name: "Pharmacies & Supplements", categoryType: "expense", parentSlug: "medical", displayOrder: 66 },
  { slug: "medical_primary_care", name: "Primary Care", categoryType: "expense", parentSlug: "medical", displayOrder: 67 },
  { slug: "medical_veterinary", name: "Veterinary Services", categoryType: "expense", parentSlug: "medical", displayOrder: 68 },
  { slug: "medical_other", name: "Other Medical", categoryType: "expense", parentSlug: "medical", displayOrder: 69 },

  // ── PERSONAL CARE ── (displayOrder 70-73)
  { slug: "personal_care", name: "Personal Care", categoryType: "expense", icon: "sparkles", displayOrder: 8 },
  { slug: "personal_gyms", name: "Gyms & Fitness Centers", categoryType: "expense", parentSlug: "personal_care", displayOrder: 70 },
  { slug: "personal_hair_beauty", name: "Hair & Beauty", categoryType: "expense", parentSlug: "personal_care", displayOrder: 71 },
  { slug: "personal_laundry", name: "Laundry & Dry Cleaning", categoryType: "expense", parentSlug: "personal_care", displayOrder: 72 },
  { slug: "personal_other", name: "Other Personal Care", categoryType: "expense", parentSlug: "personal_care", displayOrder: 73 },

  // ── GENERAL SERVICES ── (displayOrder 74-82)
  { slug: "general_services", name: "General Services", categoryType: "expense", icon: "briefcase", displayOrder: 9 },
  { slug: "services_accounting_tax", name: "Accounting & Financial Planning", categoryType: "expense", parentSlug: "general_services", displayOrder: 74 },
  { slug: "services_automotive", name: "Automotive", categoryType: "expense", parentSlug: "general_services", displayOrder: 75 },
  { slug: "services_childcare", name: "Childcare", categoryType: "expense", parentSlug: "general_services", displayOrder: 76 },
  { slug: "services_consulting", name: "Consulting & Legal", categoryType: "expense", parentSlug: "general_services", displayOrder: 77 },
  { slug: "services_education", name: "Education", categoryType: "expense", parentSlug: "general_services", displayOrder: 78 },
  { slug: "services_insurance", name: "Insurance", categoryType: "expense", parentSlug: "general_services", displayOrder: 79 },
  { slug: "services_postage_shipping", name: "Postage & Shipping", categoryType: "expense", parentSlug: "general_services", displayOrder: 80 },
  { slug: "services_storage", name: "Storage", categoryType: "expense", parentSlug: "general_services", displayOrder: 81 },
  { slug: "services_other", name: "Other General Services", categoryType: "expense", parentSlug: "general_services", displayOrder: 82 },

  // ── GOVERNMENT AND NON-PROFIT ── (displayOrder 83-86)
  { slug: "government_nonprofit", name: "Government & Non-Profit", categoryType: "expense", icon: "landmark", displayOrder: 10 },
  { slug: "government_donations", name: "Donations", categoryType: "expense", parentSlug: "government_nonprofit", displayOrder: 83 },
  { slug: "government_departments", name: "Government Departments & Agencies", categoryType: "expense", parentSlug: "government_nonprofit", displayOrder: 84 },
  { slug: "government_tax_payment", name: "Tax Payment", categoryType: "expense", parentSlug: "government_nonprofit", displayOrder: 85 },
  { slug: "government_other", name: "Other Government & Non-Profit", categoryType: "expense", parentSlug: "government_nonprofit", displayOrder: 86 },

  // ── TRANSPORTATION ── (displayOrder 87-93)
  { slug: "transportation", name: "Transportation", categoryType: "expense", icon: "car", displayOrder: 11 },
  { slug: "transport_bikes_scooters", name: "Bikes & Scooters", categoryType: "expense", parentSlug: "transportation", displayOrder: 87 },
  { slug: "transport_gas", name: "Gas", categoryType: "expense", parentSlug: "transportation", displayOrder: 88 },
  { slug: "transport_parking", name: "Parking", categoryType: "expense", parentSlug: "transportation", displayOrder: 89 },
  { slug: "transport_public_transit", name: "Public Transit", categoryType: "expense", parentSlug: "transportation", displayOrder: 90 },
  { slug: "transport_rideshare", name: "Taxis & Ride Shares", categoryType: "expense", parentSlug: "transportation", displayOrder: 91 },
  { slug: "transport_tolls", name: "Tolls", categoryType: "expense", parentSlug: "transportation", displayOrder: 92 },
  { slug: "transport_other", name: "Other Transportation", categoryType: "expense", parentSlug: "transportation", displayOrder: 93 },

  // ── TRAVEL ── (displayOrder 94-97)
  { slug: "travel", name: "Travel", categoryType: "expense", icon: "plane", displayOrder: 12 },
  { slug: "travel_flights", name: "Flights", categoryType: "expense", parentSlug: "travel", displayOrder: 94 },
  { slug: "travel_lodging", name: "Lodging", categoryType: "expense", parentSlug: "travel", displayOrder: 95 },
  { slug: "travel_rental_cars", name: "Rental Cars", categoryType: "expense", parentSlug: "travel", displayOrder: 96 },
  { slug: "travel_other", name: "Other Travel", categoryType: "expense", parentSlug: "travel", displayOrder: 97 },

  // ── RENT AND UTILITIES ── (displayOrder 98-104)
  { slug: "rent_utilities", name: "Rent & Utilities", categoryType: "expense", icon: "zap", displayOrder: 13 },
  { slug: "utilities_gas_electric", name: "Gas & Electricity", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 98 },
  { slug: "utilities_internet_cable", name: "Internet & Cable", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 99 },
  { slug: "utilities_rent", name: "Rent", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 100 },
  { slug: "utilities_sewage", name: "Sewage & Waste Management", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 101 },
  { slug: "utilities_telephone", name: "Telephone", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 102 },
  { slug: "utilities_water", name: "Water", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 103 },
  { slug: "utilities_other", name: "Other Utilities", categoryType: "expense", parentSlug: "rent_utilities", displayOrder: 104 },
];

// ============================================
// INCOME CATEGORIES (displayOrder 1-7 for subcategories)
// ============================================

export const INCOME_CATEGORIES: SystemCategory[] = [
  { slug: "income_dividends", name: "Dividends", categoryType: "income", icon: "trending-up", displayOrder: 1 },
  { slug: "income_interest", name: "Interest Earned", categoryType: "income", icon: "percent", displayOrder: 2 },
  { slug: "income_retirement", name: "Retirement Pension", categoryType: "income", icon: "umbrella", displayOrder: 3 },
  { slug: "income_tax_refund", name: "Tax Refund", categoryType: "income", icon: "receipt", displayOrder: 4 },
  { slug: "income_unemployment", name: "Unemployment", categoryType: "income", icon: "file-text", displayOrder: 5 },
  { slug: "income_wages", name: "Wages", categoryType: "income", icon: "wallet", displayOrder: 6 },
  { slug: "income_other", name: "Other Income", categoryType: "income", icon: "plus-circle", displayOrder: 7 },
];

// ============================================
// TRANSFER CATEGORIES (From/To structure with displayOrder)
// ============================================

export const TRANSFER_CATEGORIES: SystemCategory[] = [
  // TRANSFER_IN types (Money coming in / From) - displayOrder 8-13
  { slug: "transfer_in", name: "Transfer In", categoryType: "transfer", icon: "arrow-down-left", displayOrder: 1 },
  { slug: "transfer_in_cash_advance", name: "Cash Advances & Loans", categoryType: "transfer", parentSlug: "transfer_in", displayOrder: 8 },
  { slug: "transfer_in_deposit", name: "Deposit", categoryType: "transfer", parentSlug: "transfer_in", displayOrder: 9 },
  { slug: "transfer_in_investment", name: "Investment & Retirement Funds", categoryType: "transfer", parentSlug: "transfer_in", displayOrder: 10 },
  { slug: "transfer_in_savings", name: "Savings", categoryType: "transfer", parentSlug: "transfer_in", displayOrder: 11 },
  { slug: "transfer_in_account", name: "Account Transfer", categoryType: "transfer", parentSlug: "transfer_in", displayOrder: 12 },
  { slug: "transfer_in_other", name: "Other Transfer In", categoryType: "transfer", parentSlug: "transfer_in", displayOrder: 13 },

  // TRANSFER_OUT types (Money going out / To) - displayOrder 14-18
  { slug: "transfer_out", name: "Transfer Out", categoryType: "transfer", icon: "arrow-up-right", displayOrder: 2 },
  { slug: "transfer_out_investment", name: "Investment & Retirement Funds", categoryType: "transfer", parentSlug: "transfer_out", displayOrder: 14 },
  { slug: "transfer_out_savings", name: "Savings", categoryType: "transfer", parentSlug: "transfer_out", displayOrder: 15 },
  { slug: "transfer_out_withdrawal", name: "Withdrawal", categoryType: "transfer", parentSlug: "transfer_out", displayOrder: 16 },
  { slug: "transfer_out_account", name: "Account Transfer", categoryType: "transfer", parentSlug: "transfer_out", displayOrder: 17 },
  { slug: "transfer_out_other", name: "Other Transfer Out", categoryType: "transfer", parentSlug: "transfer_out", displayOrder: 18 },
];

// ============================================
// COMBINED SYSTEM CATEGORIES
// ============================================

export const SYSTEM_CATEGORIES: SystemCategory[] = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...TRANSFER_CATEGORIES,
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

// ============================================
// HIERARCHY HELPERS
// ============================================

/**
 * Get all top-level categories (no parentSlug)
 */
export function getTopLevelCategories(type?: CategoryType): SystemCategory[] {
  return SYSTEM_CATEGORIES.filter(c => 
    !c.parentSlug && (type === undefined || c.categoryType === type)
  );
}

/**
 * Get subcategories for a given parent slug
 */
export function getSubcategories(parentSlug: string): SystemCategory[] {
  return SYSTEM_CATEGORIES.filter(c => c.parentSlug === parentSlug);
}

/**
 * Get the parent category for a given category
 */
export function getParentCategory(category: SystemCategory): SystemCategory | undefined {
  if (!category.parentSlug) return undefined;
  return SYSTEM_CATEGORY_BY_SLUG.get(category.parentSlug);
}

/**
 * Get the full category hierarchy as a tree structure
 */
export type CategoryTreeNode = {
  category: SystemCategory;
  children: CategoryTreeNode[];
};

export function getCategoryTree(type?: CategoryType): CategoryTreeNode[] {
  const topLevel = getTopLevelCategories(type);
  
  const buildNode = (cat: SystemCategory): CategoryTreeNode => ({
    category: cat,
    children: getSubcategories(cat.slug).map(buildNode),
  });
  
  return topLevel.map(buildNode);
}

/**
 * Flatten a category tree for display (with indentation level)
 */
export type FlatCategoryItem = {
  category: SystemCategory;
  level: number;
  isParent: boolean;
};

export function flattenCategoryTree(type?: CategoryType): FlatCategoryItem[] {
  const result: FlatCategoryItem[] = [];
  
  const walk = (nodes: CategoryTreeNode[], level: number) => {
    for (const node of nodes) {
      result.push({
        category: node.category,
        level,
        isParent: node.children.length > 0,
      });
      walk(node.children, level + 1);
    }
  };
  
  walk(getCategoryTree(type), 0);
  return result;
}

/**
 * Check if a category has subcategories
 */
export function hasSubcategories(slug: string): boolean {
  return SYSTEM_CATEGORIES.some(c => c.parentSlug === slug);
}

/**
 * Get display name with optional parent prefix
 */
export function getCategoryDisplayName(category: SystemCategory, includeParent = false): string {
  if (!includeParent || !category.parentSlug) {
    return category.name;
  }
  const parent = SYSTEM_CATEGORY_BY_SLUG.get(category.parentSlug);
  return parent ? `${parent.name} › ${category.name}` : category.name;
}

// ============================================
// TRANSFER HELPERS
// ============================================

/**
 * Get all TRANSFER_IN subcategories (From options)
 */
export function getTransferInCategories(): SystemCategory[] {
  return getSubcategories("transfer_in");
}

/**
 * Get all TRANSFER_OUT subcategories (To options)
 */
export function getTransferOutCategories(): SystemCategory[] {
  return getSubcategories("transfer_out");
}
