/**
 * Dashboard Widget System - Types
 * 
 * Defines the widget system for the customizable dashboard CMS.
 * Users can arrange, resize, and toggle widgets to personalize their view.
 */

export type WidgetSize = "small" | "medium" | "large" | "full";

// Note: "period-comparison" is rendered in the header card, not as a movable widget
export type WidgetId = 
  | "safe-to-spend"
  | "payday-countdown"
  | "budget-health"
  | "goals-preview"
  | "net-worth"
  | "upcoming-bills"
  | "recent-transactions"
  | "category-breakdown"
  | "review-alert"
  | "accountability"
  | "quick-actions"
  // New widgets from other pages
  | "coach-quick-ask"
  | "coach-insights"
  | "spending-trend"
  | "income-expense"
  | "mini-calendar"
  | "accounts-summary"
  | "cash-flow-sparkline"
  | "net-income-calendar";

export interface WidgetConfig {
  id: WidgetId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  minHeight?: number; // in grid units
  category: "overview" | "budgeting" | "tracking" | "actions";
}

export interface WidgetPlacement {
  widgetId: WidgetId;
  order: number;
  size: WidgetSize;
  visible: boolean;
  // Optional settings per widget
  settings?: Record<string, unknown>;
}

export interface DashboardLayout {
  version: number; // For future migrations
  widgets: WidgetPlacement[];
  updatedAt: number;
}

// Default layout for new users
// Note: period-comparison is rendered in the header card, not in the widget grid
export const DEFAULT_LAYOUT: DashboardLayout = {
  version: 1,
  widgets: [
    { widgetId: "accountability", order: 0, size: "full", visible: true },
    { widgetId: "review-alert", order: 1, size: "full", visible: true },
    { widgetId: "net-worth", order: 2, size: "full", visible: true },
    { widgetId: "safe-to-spend", order: 3, size: "medium", visible: true },
    { widgetId: "payday-countdown", order: 4, size: "medium", visible: true },
    { widgetId: "budget-health", order: 5, size: "full", visible: true },
    { widgetId: "goals-preview", order: 6, size: "full", visible: true },
    { widgetId: "upcoming-bills", order: 7, size: "full", visible: true },
    { widgetId: "quick-actions", order: 8, size: "full", visible: true },
    { widgetId: "recent-transactions", order: 9, size: "full", visible: true },
    { widgetId: "category-breakdown", order: 10, size: "full", visible: true },
    // New widgets - hidden by default (users can enable them)
    { widgetId: "coach-quick-ask", order: 11, size: "full", visible: false },
    { widgetId: "coach-insights", order: 12, size: "full", visible: false },
    { widgetId: "spending-trend", order: 13, size: "full", visible: false },
    { widgetId: "income-expense", order: 14, size: "medium", visible: false },
    { widgetId: "mini-calendar", order: 15, size: "full", visible: false },
    { widgetId: "accounts-summary", order: 16, size: "full", visible: false },
    { widgetId: "cash-flow-sparkline", order: 17, size: "full", visible: false },
    { widgetId: "net-income-calendar", order: 18, size: "full", visible: false },
  ],
  updatedAt: Date.now(),
};

// Widget registry with metadata
// Note: period-comparison is not included as it's rendered in the header card
export const WIDGET_REGISTRY: Record<WidgetId, WidgetConfig> = {
  "safe-to-spend": {
    id: "safe-to-spend",
    name: "Safe to Spend",
    description: "How much you can safely spend",
    icon: "Shield",
    defaultSize: "medium",
    allowedSizes: ["small", "medium", "large"],
    category: "budgeting",
  },
  "payday-countdown": {
    id: "payday-countdown",
    name: "Payday Countdown",
    description: "Days until your next paycheck",
    icon: "Calendar",
    defaultSize: "medium",
    allowedSizes: ["small", "medium"],
    category: "tracking",
  },
  "budget-health": {
    id: "budget-health",
    name: "Budget Health",
    description: "Visual rings showing budget status",
    icon: "PieChart",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "budgeting",
  },
  "goals-preview": {
    id: "goals-preview",
    name: "Goals Progress",
    description: "Track progress toward your savings goals",
    icon: "Target",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "tracking",
  },
  "net-worth": {
    id: "net-worth",
    name: "Net Worth",
    description: "Summary of assets and liabilities",
    icon: "Landmark",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "overview",
  },
  "upcoming-bills": {
    id: "upcoming-bills",
    name: "Upcoming Bills",
    description: "Bills due in the next 30 days",
    icon: "Receipt",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "tracking",
  },
  "recent-transactions": {
    id: "recent-transactions",
    name: "Recent Activity",
    description: "Your most recent transactions",
    icon: "Clock",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "tracking",
  },
  "category-breakdown": {
    id: "category-breakdown",
    name: "Spending Breakdown",
    description: "Spending by category",
    icon: "BarChart3",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "overview",
  },
  "review-alert": {
    id: "review-alert",
    name: "Review Alert",
    description: "Items needing your attention",
    icon: "AlertCircle",
    defaultSize: "full",
    allowedSizes: ["full"],
    category: "actions",
  },
  "accountability": {
    id: "accountability",
    name: "Health Check",
    description: "Cross-entity sync alerts",
    icon: "Activity",
    defaultSize: "full",
    allowedSizes: ["full"],
    category: "actions",
  },
  "quick-actions": {
    id: "quick-actions",
    name: "Quick Actions",
    description: "Shortcuts to common tasks",
    icon: "Zap",
    defaultSize: "full",
    allowedSizes: ["medium", "full"],
    category: "actions",
  },
  // New widgets from other pages
  "coach-quick-ask": {
    id: "coach-quick-ask",
    name: "Ask Coach",
    description: "Quick question to your AI financial coach",
    icon: "MessageCircle",
    defaultSize: "full",
    allowedSizes: ["full"],
    category: "actions",
  },
  "coach-insights": {
    id: "coach-insights",
    name: "AI Insights",
    description: "Personalized financial insights from your coach",
    icon: "Sparkles",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "overview",
  },
  "spending-trend": {
    id: "spending-trend",
    name: "Spending Trend",
    description: "Weekly spending over time",
    icon: "TrendingDown",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "overview",
  },
  "income-expense": {
    id: "income-expense",
    name: "Income vs Expense",
    description: "Compare income and expenses this month",
    icon: "ArrowUpDown",
    defaultSize: "medium",
    allowedSizes: ["small", "medium", "large"],
    category: "overview",
  },
  "mini-calendar": {
    id: "mini-calendar",
    name: "Calendar Preview",
    description: "Upcoming week at a glance",
    icon: "CalendarDays",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "tracking",
  },
  "accounts-summary": {
    id: "accounts-summary",
    name: "Accounts",
    description: "Quick view of your connected accounts",
    icon: "Wallet",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "overview",
  },
  "cash-flow-sparkline": {
    id: "cash-flow-sparkline",
    name: "Cash Flow",
    description: "Daily cash flow mini chart",
    icon: "Activity",
    defaultSize: "full",
    allowedSizes: ["medium", "large", "full"],
    category: "overview",
  },
  "net-income-calendar": {
    id: "net-income-calendar",
    name: "12-Month Calendar",
    description: "Full net income calendar with monthly breakdown",
    icon: "CalendarRange",
    defaultSize: "full",
    allowedSizes: ["full"],
    category: "overview",
  },
};

// Utility to get grid column span from size
export function getGridSpan(size: WidgetSize): string {
  switch (size) {
    case "small":
      return "col-span-1";
    case "medium":
      return "col-span-1 md:col-span-1";
    case "large":
      return "col-span-2 md:col-span-1";
    case "full":
      return "col-span-2";
    default:
      return "col-span-2";
  }
}
