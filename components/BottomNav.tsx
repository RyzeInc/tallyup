"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/overview", label: "Overview", icon: "▦" },
  { href: "/activity", label: "Activity", icon: "≡" },
  { href: "/review", label: "Review", icon: "✉" },
  { href: "/rules", label: "Rules", icon: "⚙" },
  { href: "/insights", label: "Insights", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav({ currentPath }: { currentPath?: string }) {
  const pathname = currentPath ?? usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
      <div className="mx-auto max-w-md px-6 py-3">
        <div className="grid grid-cols-6 gap-2">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname?.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={["flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs", active ? "bg-accent text-accent-foreground" : "text-neutral-400 hover:text-neutral-600"].join(" ")}
                aria-current={active ? "page" : undefined}
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
