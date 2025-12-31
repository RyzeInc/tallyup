"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import * as Lucide from "lucide-react";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

interface MenuGroup {
  title: string;
  items: {
    href: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    badge?: number;
  }[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Workflows",
    items: [
      { 
        href: "/rules", 
        label: "Rules", 
        description: "Auto-categorize transactions",
        icon: <Lucide.BookOpen className="h-5 w-5" /> 
      },
      { 
        href: "/recurring", 
        label: "Recurring", 
        description: "Track subscriptions & bills",
        icon: <Lucide.RefreshCw className="h-5 w-5" /> 
      },
    ],
  },
  {
    title: "Account",
    items: [
      { 
        href: "/settings", 
        label: "Settings", 
        description: "Appearance & preferences",
        icon: <Lucide.Settings className="h-5 w-5" /> 
      },
      { 
        href: "/profile", 
        label: "Profile", 
        description: "Your account details",
        icon: <Lucide.User className="h-5 w-5" /> 
      },
    ],
  },
  {
    title: "Support",
    items: [
      { 
        href: "/help", 
        label: "Help", 
        description: "FAQs & documentation",
        icon: <Lucide.HelpCircle className="h-5 w-5" /> 
      },
      { 
        href: "/feedback", 
        label: "Feedback", 
        description: "Share ideas or report bugs",
        icon: <Lucide.MessageSquare className="h-5 w-5" /> 
      },
    ],
  },
];

export default function MoreSheet({ open, onClose }: MoreSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  // Trap focus inside sheet
  useEffect(() => {
    if (open && sheetRef.current) {
      const firstFocusable = sheetRef.current.querySelector<HTMLElement>("button, a");
      firstFocusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="More options"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "28rem",
        }}
      >
        <div
          style={{
            borderTopLeftRadius: "var(--card-radius)",
            borderTopRightRadius: "var(--card-radius)",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderBottom: "none",
            padding: "var(--space-4)",
            paddingBottom: "var(--space-8)",
          }}
        >
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <div
              style={{
                height: 4,
                width: 40,
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--border)",
              }}
            />
          </div>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text)" }}>
              More
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: "var(--space-2)",
                borderRadius: "var(--radius-full)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          {/* Menu Groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {menuGroups.map((group) => (
              <div key={group.title}>
                <div
                  style={{
                    fontSize: "var(--text-micro)",
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: "var(--space-2)",
                    paddingLeft: "4px",
                  }}
                >
                  {group.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-4)",
                        borderRadius: "var(--input-radius)",
                        textDecoration: "none",
                        color: "var(--text)",
                        minHeight: "52px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 40,
                          height: 40,
                          borderRadius: "var(--radius-md)",
                          backgroundColor: "var(--surface-2)",
                          color: "var(--text-secondary)",
                          flexShrink: 0,
                        }}
                      >
                        {item.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "var(--text-body)", fontWeight: 500 }}>
                          {item.label}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)", marginTop: "2px" }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-meta)",
                            fontWeight: 600,
                            backgroundColor: "var(--primary)",
                            color: "var(--primary-foreground)",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      <Lucide.ChevronRight
                        className="h-4 w-4"
                        style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
