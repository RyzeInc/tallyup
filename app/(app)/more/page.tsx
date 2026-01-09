"use client";

import Link from "next/link";
import * as Lucide from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { useTheme, type CustomizableNavItem } from "@/components/ThemeProvider";

interface MenuItem {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  badge?: number;
  navId?: CustomizableNavItem; // If set, only show when hidden from nav bar
}

// Icon mapping for customizable nav items
const navIconMap: Record<CustomizableNavItem, { icon: React.ReactNode; iconBg: string }> = {
  activity: {
    icon: <Lucide.Activity className="h-6 w-6" style={{ color: "var(--primary)" }} />,
    iconBg: "var(--accent-subtle)",
  },
  budgeting: {
    icon: <Lucide.Wallet className="h-6 w-6" style={{ color: "var(--primary)" }} />,
    iconBg: "var(--accent-subtle)",
  },
  recurring: {
    icon: <Lucide.RefreshCw className="h-6 w-6" style={{ color: "var(--primary)" }} />,
    iconBg: "var(--accent-subtle)",
  },
  goals: {
    icon: <Lucide.Target className="h-6 w-6" style={{ color: "var(--success)" }} />,
    iconBg: "var(--success-subtle)",
  },
  insights: {
    icon: <Lucide.TrendingUp className="h-6 w-6" style={{ color: "var(--success)" }} />,
    iconBg: "var(--success-subtle)",
  },
  calendar: {
    icon: <Lucide.Calendar className="h-6 w-6" style={{ color: "var(--success)" }} />,
    iconBg: "var(--success-subtle)",
  },
  review: {
    icon: <Lucide.Inbox className="h-6 w-6" style={{ color: "var(--warning)" }} />,
    iconBg: "var(--warning-subtle)",
  },
  accounts: {
    icon: <Lucide.CreditCard className="h-6 w-6" style={{ color: "var(--primary)" }} />,
    iconBg: "var(--accent-subtle)",
  },
};

export default function MorePage() {
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as Doc<"entries">[] | undefined;
  const reviewCount = inbox?.length ?? 0;
  const { isNavItemVisible } = useTheme();

  // Items that can be hidden from nav bar - only show here when hidden
  const hiddenNavItems: MenuItem[] = ([
    {
      href: "/activity",
      label: "Activity",
      description: "Transaction history",
      ...navIconMap.activity,
      navId: "activity" as const,
    },
    {
      href: "/budgeting",
      label: "Budgeting",
      description: "Budgets & spending",
      ...navIconMap.budgeting,
      navId: "budgeting" as const,
    },
    {
      href: "/recurring",
      label: "Recurring",
      description: "Subscriptions & bills",
      ...navIconMap.recurring,
      navId: "recurring" as const,
    },
    {
      href: "/goals",
      label: "Goals",
      description: "Savings goals",
      ...navIconMap.goals,
      navId: "goals" as const,
    },
    {
      href: "/insights",
      label: "Insights",
      description: "Financial trends",
      ...navIconMap.insights,
      navId: "insights" as const,
    },
    {
      href: "/calendar",
      label: "Calendar",
      description: "Net income & recurring view",
      ...navIconMap.calendar,
      navId: "calendar" as const,
    },
    {
      href: "/review",
      label: "Review",
      description: "Categorize transactions",
      ...navIconMap.review,
      badge: reviewCount,
      navId: "review" as const,
    },
    {
      href: "/accounts",
      label: "Accounts",
      description: "Banks, cards, and balances",
      ...navIconMap.accounts,
      navId: "accounts" as const,
    },
  ] as MenuItem[]).filter((item) => item.navId && !isNavItemVisible(item.navId));

  // Always-visible menu items
  const alwaysVisibleItems: MenuItem[] = [
    {
      href: "/settings",
      label: "Settings",
      description: "Appearance & preferences",
      icon: <Lucide.Settings className="h-6 w-6" style={{ color: "var(--text-secondary)" }} />,
      iconBg: "var(--surface-2)",
    },
    {
      href: "/profile",
      label: "Profile",
      description: "Your account details",
      icon: <Lucide.User className="h-6 w-6" style={{ color: "var(--text-secondary)" }} />,
      iconBg: "var(--surface-2)",
    },
    {
      href: "/help",
      label: "Learn",
      description: "FAQs & practical guides",
      icon: <Lucide.HelpCircle className="h-6 w-6" style={{ color: "var(--text-secondary)" }} />,
      iconBg: "var(--surface-2)",
    },
  ];

  // Combine: hidden nav items first, then always-visible items
  const menuItems = [...hiddenNavItems, ...alwaysVisibleItems];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Menu Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "var(--space-3)",
        }}
      >
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-3)",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border)",
              padding: "var(--space-5)",
              textDecoration: "none",
              textAlign: "center",
              minHeight: 140,
              position: "relative",
              transition: "all 150ms ease",
            }}
            className="hover:bg-[var(--surface-subtle)]"
          >
            {/* Badge */}
            {item.badge && item.badge > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "var(--danger)",
                  color: "#fff",
                }}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}

            {/* Icon */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--radius-lg)",
                backgroundColor: item.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.icon}
            </div>

            {/* Label & description */}
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "var(--text-micro)",
                  color: "var(--text-tertiary)",
                  marginTop: 2,
                }}
              >
                {item.description}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* App version */}
      <div
        style={{
          textAlign: "center",
          fontSize: "var(--text-micro)",
          color: "var(--text-tertiary)",
          marginTop: "var(--space-4)",
        }}
      >
        TallyUp v1.0
      </div>
    </div>
  );
}
