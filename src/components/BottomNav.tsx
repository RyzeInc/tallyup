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

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto max-w-md px-6 py-3">
        <div className="grid grid-cols-6 gap-2">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname?.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  "flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs",
                  active ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-200",
                ].join(" ")}
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
