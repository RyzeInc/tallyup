/**
 * Plaid Configuration
 * 
 * This module provides Plaid client configuration for sandbox integration.
 * In production, this would switch to development or production environments.
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

// Environment configuration
export const PLAID_ENV = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";

// Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

// Export the Plaid client
export const plaidClient = new PlaidApi(configuration);

// Products to request during Link
export const PLAID_PRODUCTS: Products[] = [
  Products.Transactions,
  Products.Auth,
  Products.Identity,
  Products.Liabilities,
  Products.Investments,
];

// Supported country codes
export const PLAID_COUNTRY_CODES: CountryCode[] = [CountryCode.Us];

// Plaid Link redirect URI (for OAuth institutions)
export const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || "";

// Sandbox credentials for development/testing
export const SANDBOX_CREDENTIALS = {
  username: "user_good",
  password: "pass_good",
};

// Transaction sync configuration
export const TRANSACTION_SYNC_CONFIG = {
  // Number of days to look back for initial sync
  initialDaysBack: 730, // 2 years
  // Maximum transactions per request
  batchSize: 500,
  // How often to sync (in milliseconds)
  syncIntervalMs: 4 * 60 * 60 * 1000, // 4 hours
};

// Account type mapping from Plaid to TallyUp
export const PLAID_ACCOUNT_TYPE_MAP: Record<string, "checking" | "savings" | "credit" | "investment" | "loan" | "other"> = {
  depository: "checking",
  checking: "checking",
  savings: "savings",
  credit: "credit",
  loan: "loan",
  investment: "investment",
  mortgage: "loan",
  brokerage: "investment",
  "401k": "investment",
  ira: "investment",
  other: "other",
};

// Transaction category mapping (Plaid personal_finance_category to TallyUp categories)
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  // Income
  INCOME_DIVIDENDS: "Investment Income",
  INCOME_INTEREST_EARNED: "Interest",
  INCOME_RETIREMENT_PENSION: "Retirement",
  INCOME_TAX_REFUND: "Tax Refund",
  INCOME_UNEMPLOYMENT: "Unemployment",
  INCOME_WAGES: "Salary",
  INCOME_OTHER_INCOME: "Other Income",
  
  // Food and Drink
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "Alcohol",
  FOOD_AND_DRINK_COFFEE: "Coffee",
  FOOD_AND_DRINK_FAST_FOOD: "Fast Food",
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK_RESTAURANT: "Dining Out",
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: "Food & Drink",
  
  // Transportation
  TRANSPORTATION_BIKES_AND_SCOOTERS: "Transportation",
  TRANSPORTATION_GAS: "Gas",
  TRANSPORTATION_PARKING: "Parking",
  TRANSPORTATION_PUBLIC_TRANSIT: "Public Transit",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Rideshare",
  TRANSPORTATION_TOLLS: "Tolls",
  TRANSPORTATION_OTHER_TRANSPORTATION: "Transportation",
  
  // Travel
  TRAVEL_FLIGHTS: "Flights",
  TRAVEL_LODGING: "Hotels",
  TRAVEL_RENTAL_CARS: "Rental Cars",
  TRAVEL_OTHER_TRAVEL: "Travel",
  
  // Transfer
  TRANSFER_IN_ACCOUNT_TRANSFER: "Transfer",
  TRANSFER_OUT_ACCOUNT_TRANSFER: "Transfer",
  TRANSFER_IN_CASH_ADVANCES_AND_LOANS: "Cash Advance",
  TRANSFER_OUT_CASH_ADVANCES_AND_LOANS: "Loan Payment",
  TRANSFER_IN_DEPOSIT: "Deposit",
  TRANSFER_OUT_WITHDRAWAL: "Withdrawal",
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: "Investment",
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: "Investment",
  TRANSFER_IN_SAVINGS: "Savings",
  TRANSFER_OUT_SAVINGS: "Savings",
  TRANSFER_IN_OTHER_TRANSFER: "Transfer",
  TRANSFER_OUT_OTHER_TRANSFER: "Transfer",
  
  // Personal Care
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Fitness",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "Beauty",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "Laundry",
  PERSONAL_CARE_OTHER_PERSONAL_CARE: "Personal Care",
  
  // Entertainment
  ENTERTAINMENT_CASINOS_AND_GAMBLING: "Entertainment",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Music",
  ENTERTAINMENT_MOVIES_AND_DVS: "Movies",
  ENTERTAINMENT_GAMES: "Games",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: "Entertainment",
  ENTERTAINMENT_TV_AND_MOVIES: "Streaming",
  ENTERTAINMENT_VIDEO_GAMES: "Games",
  ENTERTAINMENT_OTHER_ENTERTAINMENT: "Entertainment",
  
  // Shopping
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: "Books",
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "Clothing",
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: "Convenience",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "Shopping",
  GENERAL_MERCHANDISE_DISCOUNT_STORES: "Shopping",
  GENERAL_MERCHANDISE_ELECTRONICS: "Electronics",
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: "Gifts",
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: "Office Supplies",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "Online Shopping",
  GENERAL_MERCHANDISE_PET_SUPPLIES: "Pets",
  GENERAL_MERCHANDISE_SPORTING_GOODS: "Sports",
  GENERAL_MERCHANDISE_SUPERSTORES: "Shopping",
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: "Tobacco",
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: "Shopping",
  
  // Home
  HOME_IMPROVEMENT_FURNITURE: "Furniture",
  HOME_IMPROVEMENT_HARDWARE: "Hardware",
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: "Home Repair",
  HOME_IMPROVEMENT_SECURITY: "Security",
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: "Home",
  
  // Rent and Utilities
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Utilities",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Internet",
  RENT_AND_UTILITIES_RENT: "Rent",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "Utilities",
  RENT_AND_UTILITIES_TELEPHONE: "Phone",
  RENT_AND_UTILITIES_WATER: "Water",
  RENT_AND_UTILITIES_OTHER_UTILITIES: "Utilities",
  
  // Healthcare
  MEDICAL_DENTAL_CARE: "Dental",
  MEDICAL_EYE_CARE: "Vision",
  MEDICAL_HOSPITALS_AND_CLINICS: "Medical",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "Pharmacy",
  MEDICAL_PRIMARY_CARE: "Medical",
  MEDICAL_VETERINARY_SERVICES: "Vet",
  MEDICAL_OTHER_MEDICAL: "Healthcare",
  
  // Education
  GENERAL_SERVICES_EDUCATION: "Education",
  
  // Bank Fees
  BANK_FEES_ATM_FEES: "Bank Fees",
  BANK_FEES_FOREIGN_TRANSACTION_FEES: "Bank Fees",
  BANK_FEES_INSUFFICIENT_FUNDS: "Bank Fees",
  BANK_FEES_INTEREST_CHARGE: "Interest",
  BANK_FEES_OVERDRAFT_FEES: "Bank Fees",
  BANK_FEES_OTHER_BANK_FEES: "Bank Fees",
  
  // Loan Payments
  LOAN_PAYMENTS_CAR_PAYMENT: "Auto Loan",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Credit Card Payment",
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: "Loan Payment",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "Mortgage",
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: "Student Loans",
  LOAN_PAYMENTS_OTHER_PAYMENT: "Loan Payment",
  
  // Government
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: "Donations",
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: "Government",
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: "Taxes",
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: "Government",
};

// Helper to get TallyUp category from Plaid category
export function mapPlaidCategory(plaidCategory: string | null | undefined): string {
  if (!plaidCategory) return "Uncategorized";
  return PLAID_CATEGORY_MAP[plaidCategory] || "Uncategorized";
}

// Helper to get TallyUp account type from Plaid account type
export function mapPlaidAccountType(
  type: string | null | undefined,
  subtype: string | null | undefined
): "checking" | "savings" | "credit" | "investment" | "loan" | "other" {
  // Try subtype first (more specific)
  if (subtype && PLAID_ACCOUNT_TYPE_MAP[subtype.toLowerCase()]) {
    return PLAID_ACCOUNT_TYPE_MAP[subtype.toLowerCase()];
  }
  // Fall back to type
  if (type && PLAID_ACCOUNT_TYPE_MAP[type.toLowerCase()]) {
    return PLAID_ACCOUNT_TYPE_MAP[type.toLowerCase()];
  }
  return "other";
}
