"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/log", label: "Add", icon: "＋" },
  { href: "/inbox", label: "Review", icon: "✉" },
  { href: "/history", label: "Activity", icon: "≡" },
  { href: "/summary", label: "Overview", icon: "▦" },
  { href: "/profile", label: "Profile", icon: "🔁" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto max-w-md px-6 py-3">
        <div className="grid grid-cols-5 gap-2">
          {tabs.map((t) => {
            const active = pathname === t.href;
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
