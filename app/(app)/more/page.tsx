"use client";

import Link from "next/link";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

interface MenuItem {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  badge?: number;
}

export default function MorePage() {
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  const menuItems: MenuItem[] = [
    {
      href: "/recurring",
      label: "Patterns",
      description: "Track subscriptions & bills",
      icon: <Lucide.RefreshCw className="h-6 w-6" style={{ color: "var(--primary)" }} />,
      iconBg: "var(--accent-subtle)",
    },
    {
      href: "/inbox",
      label: "Review",
      description: "Categorize transactions",
      icon: <Lucide.Inbox className="h-6 w-6" style={{ color: "var(--warning)" }} />,
      iconBg: "var(--warning-subtle)",
      badge: reviewCount,
    },
    {
      href: "/summary",
      label: "Summary",
      description: "Category breakdown",
      icon: <Lucide.PieChart className="h-6 w-6" style={{ color: "var(--success)" }} />,
      iconBg: "var(--success-subtle)",
    },
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
      label: "Help",
      description: "FAQs & documentation",
      icon: <Lucide.HelpCircle className="h-6 w-6" style={{ color: "var(--text-secondary)" }} />,
      iconBg: "var(--surface-2)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        title="More"
        subtitle="Settings & tools"
        compact
      />

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
