"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import * as Lucide from "lucide-react";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  pendingReviewCount?: number;
}

interface MenuGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Workflows",
    items: [
      { href: "/rules", label: "Rules", icon: <Lucide.BookOpen className="h-5 w-5" /> },
      { href: "/recurring", label: "Recurring", icon: <Lucide.FileText className="h-5 w-5" /> },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: <Lucide.Settings className="h-5 w-5" /> },
      { href: "/profile", label: "Profile", icon: <Lucide.User className="h-5 w-5" /> },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/help", label: "Help", icon: <Lucide.HelpCircle className="h-5 w-5" /> },
      { href: "/feedback", label: "Feedback", icon: <Lucide.MessageSquare className="h-5 w-5" /> },
    ],
  },
];

export default function MoreSheet({ open, onClose, pendingReviewCount }: MoreSheetProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="More options"
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 duration-200"
      >
        <div
          className="rounded-t-2xl border-t border-x p-4 pb-8"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Handle */}
          <div className="flex justify-center mb-3">
            <div
              className="h-1 w-10 rounded-full"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2" style={{ color: "var(--text)" }}>
              More
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-[var(--surface-subtle)] transition-colors"
              aria-label="Close"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          {/* Menu Groups */}
          <div className="space-y-6">
            {menuGroups.map((group) => (
              <div key={group.title}>
                <div className="text-micro mb-3 px-1">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-[var(--surface-subtle)] transition-colors"
                      style={{ color: "var(--text)" }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-body font-medium">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className="rounded-full px-2.5 py-1 text-sm font-semibold"
                          style={{
                            backgroundColor: "var(--accent)",
                            color: "var(--accent-foreground)",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      <Lucide.ChevronRight
                        className="h-4 w-4"
                        style={{ color: "var(--text-tertiary)" }}
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
