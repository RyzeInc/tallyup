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

// Transaction category mapping (Plaid personal_finance_category to TallyUp display names)
// Note: This maps to user-friendly display names. For slug mapping, see convex/plaid.ts
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  // Income
  INCOME_DIVIDENDS: "Dividends",
  INCOME_INTEREST_EARNED: "Interest Earned",
  INCOME_RETIREMENT_PENSION: "Retirement Pension",
  INCOME_TAX_REFUND: "Tax Refund",
  INCOME_UNEMPLOYMENT: "Unemployment",
  INCOME_WAGES: "Wages",
  INCOME_OTHER_INCOME: "Other Income",
  
  // Food and Drink
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "Beer, Wine & Liquor",
  FOOD_AND_DRINK_COFFEE: "Coffee",
  FOOD_AND_DRINK_FAST_FOOD: "Fast Food",
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK_RESTAURANT: "Restaurant",
  FOOD_AND_DRINK_VENDING_MACHINES: "Vending Machines",
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: "Other Food & Drink",
  
  // Transportation
  TRANSPORTATION_BIKES_AND_SCOOTERS: "Bikes & Scooters",
  TRANSPORTATION_GAS: "Gas",
  TRANSPORTATION_PARKING: "Parking",
  TRANSPORTATION_PUBLIC_TRANSIT: "Public Transit",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Taxis & Ride Shares",
  TRANSPORTATION_TOLLS: "Tolls",
  TRANSPORTATION_OTHER_TRANSPORTATION: "Other Transportation",
  
  // Travel
  TRAVEL_FLIGHTS: "Flights",
  TRAVEL_LODGING: "Lodging",
  TRAVEL_RENTAL_CARS: "Rental Cars",
  TRAVEL_OTHER_TRAVEL: "Other Travel",
  
  // Transfer
  TRANSFER_IN_ACCOUNT_TRANSFER: "Account Transfer",
  TRANSFER_OUT_ACCOUNT_TRANSFER: "Account Transfer",
  TRANSFER_IN_CASH_ADVANCES_AND_LOANS: "Cash Advances & Loans",
  TRANSFER_OUT_CASH_ADVANCES_AND_LOANS: "Cash Advances & Loans",
  TRANSFER_IN_DEPOSIT: "Deposit",
  TRANSFER_OUT_WITHDRAWAL: "Withdrawal",
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: "Investment & Retirement Funds",
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: "Investment & Retirement Funds",
  TRANSFER_IN_SAVINGS: "Savings",
  TRANSFER_OUT_SAVINGS: "Savings",
  TRANSFER_IN_OTHER_TRANSFER: "Other Transfer",
  TRANSFER_OUT_OTHER_TRANSFER: "Other Transfer",
  
  // Personal Care
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Gyms & Fitness Centers",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "Hair & Beauty",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "Laundry & Dry Cleaning",
  PERSONAL_CARE_OTHER_PERSONAL_CARE: "Other Personal Care",
  
  // Entertainment
  ENTERTAINMENT_CASINOS_AND_GAMBLING: "Casinos & Gambling",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Music & Audio",
  ENTERTAINMENT_MOVIES_AND_DVS: "TV & Movies",
  ENTERTAINMENT_GAMES: "Video Games",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: "Sporting Events & Museums",
  ENTERTAINMENT_TV_AND_MOVIES: "TV & Movies",
  ENTERTAINMENT_VIDEO_GAMES: "Video Games",
  ENTERTAINMENT_OTHER_ENTERTAINMENT: "Other Entertainment",
  
  // General Merchandise
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: "Bookstores & Newsstands",
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "Clothing & Accessories",
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: "Convenience Stores",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "Department Stores",
  GENERAL_MERCHANDISE_DISCOUNT_STORES: "Discount Stores",
  GENERAL_MERCHANDISE_ELECTRONICS: "Electronics",
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: "Gifts & Novelties",
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: "Office Supplies",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "Online Marketplaces",
  GENERAL_MERCHANDISE_PET_SUPPLIES: "Pet Supplies",
  GENERAL_MERCHANDISE_SPORTING_GOODS: "Sporting Goods",
  GENERAL_MERCHANDISE_SUPERSTORES: "Superstores",
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: "Tobacco & Vape",
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: "Other Merchandise",
  
  // Home Improvement
  HOME_IMPROVEMENT_FURNITURE: "Furniture",
  HOME_IMPROVEMENT_HARDWARE: "Hardware",
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: "Repair & Maintenance",
  HOME_IMPROVEMENT_SECURITY: "Security",
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: "Other Home Improvement",
  
  // Rent and Utilities
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Gas & Electricity",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Internet & Cable",
  RENT_AND_UTILITIES_RENT: "Rent",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "Sewage & Waste Management",
  RENT_AND_UTILITIES_TELEPHONE: "Telephone",
  RENT_AND_UTILITIES_WATER: "Water",
  RENT_AND_UTILITIES_OTHER_UTILITIES: "Other Utilities",
  
  // Medical
  MEDICAL_DENTAL_CARE: "Dental Care",
  MEDICAL_EYE_CARE: "Eye Care",
  MEDICAL_HOSPITALS_AND_CLINICS: "Hospitals & Clinics",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "Pharmacies & Supplements",
  MEDICAL_PRIMARY_CARE: "Primary Care",
  MEDICAL_VETERINARY_SERVICES: "Veterinary Services",
  MEDICAL_OTHER_MEDICAL: "Other Medical",
  
  // General Services
  GENERAL_SERVICES_EDUCATION: "Education",
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: "Accounting & Tax Prep",
  GENERAL_SERVICES_AUTOMOTIVE: "Automotive",
  GENERAL_SERVICES_CHILDCARE: "Childcare",
  GENERAL_SERVICES_CONSULTING_AND_LEGAL: "Consulting & Legal",
  GENERAL_SERVICES_INSURANCE: "Insurance",
  GENERAL_SERVICES_POSTAGE_AND_SHIPPING: "Postage & Shipping",
  GENERAL_SERVICES_STORAGE: "Storage",
  GENERAL_SERVICES_VETERINARY_SERVICES: "Veterinary Services",
  GENERAL_SERVICES_OTHER_GENERAL_SERVICES: "Other Services",
  
  // Bank Fees
  BANK_FEES_ATM_FEES: "ATM Fees",
  BANK_FEES_FOREIGN_TRANSACTION_FEES: "Foreign Transaction Fees",
  BANK_FEES_INSUFFICIENT_FUNDS: "Insufficient Funds",
  BANK_FEES_INTEREST_CHARGE: "Interest Charge",
  BANK_FEES_OVERDRAFT_FEES: "Overdraft Fees",
  BANK_FEES_OTHER_BANK_FEES: "Other Bank Fees",
  
  // Loan Payments
  LOAN_PAYMENTS_CAR_PAYMENT: "Car Payment",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Credit Card Payment",
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: "Personal Loan Payment",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "Mortgage Payment",
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: "Student Loan Payment",
  LOAN_PAYMENTS_OTHER_PAYMENT: "Other Loan Payment",
  
  // Government & Non-Profit
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: "Donations",
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: "Government Departments",
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: "Tax Payment",
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: "Other Government",
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
