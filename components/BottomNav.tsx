"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTabs } from "@/components/TabShell";

const tabs = [
  { href: "/log", label: "Add", icon: "＋", key: "log" },
  { href: "/inbox", label: "Review", icon: "✉", key: "inbox" },
  { href: "/history", label: "Activity", icon: "≡", key: "history" },
  { href: "/summary", label: "Overview", icon: "▦", key: "summary" },
  { href: "/recurring", label: "Patterns", icon: "🔁", key: "patterns" },
];

export default function BottomNav() {
  const pathname = usePathname();
  let tabsCtx: any = null;
  try {
    tabsCtx = useTabs();
  } catch (e) {
    tabsCtx = null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t" style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.9)" }}>
      <div className="mx-auto max-w-md px-6 py-3">
        <div className="grid grid-cols-5 gap-2">
          {tabs.map((t) => {
            const active = tabsCtx ? tabsCtx.current === t.key : pathname === t.href;
            return tabsCtx ? (
              <button
                key={t.href}
                onClick={() => {
                  // micro interaction: immediate visual feedback while navigating
                  const el = window.event?.currentTarget as HTMLElement | undefined;
                  if (el) el.style.transform = "scale(0.98)";
                  requestAnimationFrame(() => {
                    if (el) el.style.transform = "";
                  });
                  tabsCtx.navigate(t.key);
                }}
                className={["flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs transition-transform duration-100", active ? "" : "text-neutral-400 hover:text-neutral-200"].join(" ")}
                style={active ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : undefined}
                aria-pressed={active}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ) : (
              <Link
                key={t.href}
                href={t.href}
                className={["flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs", active ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-200"].join(" ")}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
