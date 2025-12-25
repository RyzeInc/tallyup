"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
      <div
        className="mx-auto max-w-md px-4 pt-6 pb-28"
        style={{ minHeight: "calc(100vh - 84px)", position: "relative" }}
      >
        {/* Minimal header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            TallyUp
          </h1>
          <ThemeToggle />
        </header>

        <main>{children}</main>
      </div>
      <BottomNav currentPath={pathname ?? "/"} />
    </div>
  );
}
