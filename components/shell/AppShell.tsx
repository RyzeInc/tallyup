"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
      if ((key === "l" || key === "n") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement as HTMLElement | null;
        const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.getAttribute("role") === "textbox");
        if (!isInput) {
          e.preventDefault();
          // open log page
          router.push("/log");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
      <div className="mx-auto max-w-md px-4 pt-6 pb-24" style={{ minHeight: "calc(100vh - 84px)", position: "relative" }}>
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-medium">TallyUp</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/log" className="rounded-md px-3 py-2 text-sm" aria-label="Log">
              Log
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main>{children}</main>
      </div>
      <BottomNav currentPath={pathname ?? "/"} />
    </div>
  );
}
