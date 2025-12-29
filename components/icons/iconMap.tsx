"use client";

import * as Lucide from "lucide-react";
import { ComponentType } from "react";

/**
 * Custom Icon System - No emoji fallback
 * 
 * All icons are Lucide React icons for consistency.
 * Categories, goals, and recurring all use this system.
 */

export type IconKey =
  // Categories - Expense
  | "groceries"
  | "restaurant"
  | "transport"
  | "fuel"
  | "housing"
  | "utilities"
  | "healthcare"
  | "entertainment"
  | "shopping"
  | "subscriptions"
  | "travel"
  | "education"
  | "personal"
  | "gifts"
  | "insurance"
  | "maintenance"
  // Categories - Income
  | "salary"
  | "freelance"
  | "gig"
  | "investment"
  | "refund"
  | "gift-received"
  // Goals
  | "goal"
  | "savings"
  | "emergency"
  | "vacation"
  | "debt"
  | "car"
  | "house"
  | "retirement"
  // System
  | "recurring"
  | "calendar"
  | "clock"
  | "check"
  | "alert"
  | "info"
  | "plus"
  | "minus"
  | "edit"
  | "trash"
  | "search"
  | "filter"
  | "settings"
  | "user"
  | "chart"
  | "wallet"
  | "money"
  | "default";

interface IconConfig {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
}

/**
 * Master icon registry - maps keys to Lucide icons
 */
export const ICON_MAP: Record<IconKey, IconConfig> = {
  // Categories - Expense
  groceries: { icon: Lucide.ShoppingCart, label: "Groceries" },
  restaurant: { icon: Lucide.Utensils, label: "Restaurant" },
  transport: { icon: Lucide.Bus, label: "Transport" },
  fuel: { icon: Lucide.Fuel, label: "Fuel" },
  housing: { icon: Lucide.Home, label: "Housing" },
  utilities: { icon: Lucide.Zap, label: "Utilities" },
  healthcare: { icon: Lucide.HeartPulse, label: "Healthcare" },
  entertainment: { icon: Lucide.Film, label: "Entertainment" },
  shopping: { icon: Lucide.ShoppingBag, label: "Shopping" },
  subscriptions: { icon: Lucide.CreditCard, label: "Subscriptions" },
  travel: { icon: Lucide.Plane, label: "Travel" },
  education: { icon: Lucide.GraduationCap, label: "Education" },
  personal: { icon: Lucide.User, label: "Personal" },
  gifts: { icon: Lucide.Gift, label: "Gifts" },
  insurance: { icon: Lucide.Shield, label: "Insurance" },
  maintenance: { icon: Lucide.Wrench, label: "Maintenance" },
  
  // Categories - Income
  salary: { icon: Lucide.Briefcase, label: "Salary" },
  freelance: { icon: Lucide.Laptop, label: "Freelance" },
  gig: { icon: Lucide.Car, label: "Gig Work" },
  investment: { icon: Lucide.TrendingUp, label: "Investment" },
  refund: { icon: Lucide.RotateCcw, label: "Refund" },
  "gift-received": { icon: Lucide.Gift, label: "Gift Received" },
  
  // Goals
  goal: { icon: Lucide.Target, label: "Goal" },
  savings: { icon: Lucide.PiggyBank, label: "Savings" },
  emergency: { icon: Lucide.ShieldAlert, label: "Emergency Fund" },
  vacation: { icon: Lucide.Palmtree, label: "Vacation" },
  debt: { icon: Lucide.CreditCard, label: "Debt Payoff" },
  car: { icon: Lucide.Car, label: "Car" },
  house: { icon: Lucide.Home, label: "House" },
  retirement: { icon: Lucide.Sunset, label: "Retirement" },
  
  // System
  recurring: { icon: Lucide.Repeat, label: "Recurring" },
  calendar: { icon: Lucide.Calendar, label: "Calendar" },
  clock: { icon: Lucide.Clock, label: "Clock" },
  check: { icon: Lucide.Check, label: "Check" },
  alert: { icon: Lucide.AlertTriangle, label: "Alert" },
  info: { icon: Lucide.Info, label: "Info" },
  plus: { icon: Lucide.Plus, label: "Add" },
  minus: { icon: Lucide.Minus, label: "Remove" },
  edit: { icon: Lucide.Pencil, label: "Edit" },
  trash: { icon: Lucide.Trash2, label: "Delete" },
  search: { icon: Lucide.Search, label: "Search" },
  filter: { icon: Lucide.Filter, label: "Filter" },
  settings: { icon: Lucide.Settings, label: "Settings" },
  user: { icon: Lucide.User, label: "User" },
  chart: { icon: Lucide.BarChart2, label: "Chart" },
  wallet: { icon: Lucide.Wallet, label: "Wallet" },
  money: { icon: Lucide.DollarSign, label: "Money" },
  default: { icon: Lucide.Circle, label: "Default" },
};

/**
 * Map category names to icon keys
 */
export const CATEGORY_ICON_MAP: Record<string, IconKey> = {
  // Expense categories
  "Groceries": "groceries",
  "Food": "groceries",
  "Restaurant": "restaurant",
  "Dining": "restaurant",
  "Transport": "transport",
  "Transportation": "transport",
  "Gas": "fuel",
  "Fuel": "fuel",
  "Rent": "housing",
  "Housing": "housing",
  "Mortgage": "housing",
  "Utilities": "utilities",
  "Electric": "utilities",
  "Water": "utilities",
  "Internet": "utilities",
  "Healthcare": "healthcare",
  "Medical": "healthcare",
  "Health": "healthcare",
  "Entertainment": "entertainment",
  "Fun": "entertainment",
  "Shopping": "shopping",
  "Clothes": "shopping",
  "Subscriptions": "subscriptions",
  "Software": "subscriptions",
  "Travel": "travel",
  "Vacation": "travel",
  "Education": "education",
  "Personal": "personal",
  "Self-care": "personal",
  "Gifts": "gifts",
  "Insurance": "insurance",
  "Maintenance": "maintenance",
  "Repairs": "maintenance",
  
  // Income categories
  "Salary": "salary",
  "Paycheck": "salary",
  "Freelance": "freelance",
  "Contract": "freelance",
  "Gig Work": "gig",
  "Side Hustle": "gig",
  "Investment": "investment",
  "Dividends": "investment",
  "Refund": "refund",
  "Reimbursement": "refund",
};

/**
 * Get icon key for a category name
 */
export function getCategoryIconKey(category: string): IconKey {
  return CATEGORY_ICON_MAP[category] ?? "default";
}

interface AppIconProps {
  iconKey: IconKey;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AppIcon - Render an icon from the icon system
 */
export function AppIcon({ iconKey, size = 18, className, style }: AppIconProps) {
  const config = ICON_MAP[iconKey] ?? ICON_MAP.default;
  const IconComponent = config.icon;
  
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", ...style }}
    >
      <IconComponent size={size} />
    </span>
  );
}

/**
 * CategoryIcon - Render icon for a category name
 */
export function CategoryIcon({ 
  category, 
  size = 18, 
  className,
  style,
}: { 
  category: string; 
  size?: number; 
  className?: string;
  style?: React.CSSProperties;
}) {
  const iconKey = getCategoryIconKey(category);
  return <AppIcon iconKey={iconKey} size={size} className={className} style={style} />;
}

/**
 * Icon picker options for UI
 */
export function getIconOptions(): Array<{ key: IconKey; label: string }> {
  return Object.entries(ICON_MAP).map(([key, config]) => ({
    key: key as IconKey,
    label: config.label,
  }));
}

export default AppIcon;
