"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useUser, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import {
  LayoutGrid,
  Plus,
  History,
  Inbox,
  BarChart3,
  Settings,
  Search,
  Command,
  Menu,
  X,
  ChevronDown,
  Layers,
  RefreshCw,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import GlobalSearch from "@/components/GlobalSearch";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/log", label: "Add Entry", icon: Plus },
  { href: "/activity", label: "Transactions", icon: History },
  { href: "/review", label: "Review", icon: Inbox, badge: true },
  { href: "/rules", label: "Rules", icon: Layers },
  { href: "/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
      
      // Cmd/Ctrl + K for search
      if (key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      
      // L or N for quick log (when not in input)
      if ((key === "l" || key === "n") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement as HTMLElement | null;
        const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.getAttribute("role") === "textbox");
        if (!isInput) {
          e.preventDefault();
          router.push("/log");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[260px] lg:flex-col border-r bg-[var(--sidebar-bg)]" style={{ borderColor: "var(--border)" }}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-semibold text-sm">T</span>
          </div>
          <span className="font-semibold text-[var(--text)]">TallyUp</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]"
                    : "text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom nav items */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]"
                    : "text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--surface-subtle)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={closeSidebar} />
          <aside className="fixed inset-y-0 left-0 w-[280px] bg-[var(--sidebar-bg)] border-r shadow-xl animate-slide-up" style={{ borderColor: "var(--border)" }}>
            <div className="flex h-16 items-center justify-between px-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">T</span>
                </div>
                <span className="font-semibold text-[var(--text)]">TallyUp</span>
              </div>
              <button onClick={closeSidebar} className="p-2 rounded-lg hover:bg-[var(--surface-subtle)]">
                <X className="h-5 w-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            <nav className="px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]"
                        : "text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="my-4 border-t" style={{ borderColor: "var(--border)" }} />
              {bottomNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]"
                        : "text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 border-b bg-[var(--surface)]/80 backdrop-blur-sm" style={{ borderColor: "var(--border)" }}>
          <div className="flex h-full items-center justify-between px-4 lg:px-6">
            {/* Left side - mobile menu + search */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-subtle)]"
              >
                <Menu className="h-5 w-5 text-[var(--text-secondary)]" />
              </button>

              {/* Search button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] text-sm transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-[var(--text-tertiary)] bg-[var(--surface-subtle)] rounded">
                  <Command className="h-3 w-3" />K
                </kbd>
              </button>
            </div>

            {/* Right side - actions + user */}
            <div className="flex items-center gap-2">
              {/* Quick add button */}
              <Link
                href="/log"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Entry</span>
              </Link>

              <ThemeToggle />

              {/* User menu */}
              <SignedIn>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8",
                    },
                  }}
                />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-64px)]">
          <div className="mx-auto max-w-[var(--content-max-width)] px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t bg-[var(--surface)]/95 backdrop-blur-sm" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { href: "/overview", label: "Overview", icon: LayoutGrid },
            { href: "/activity", label: "Activity", icon: History },
            { href: "/log", label: "Add", icon: Plus, primary: true },
            { href: "/review", label: "Review", icon: Inbox },
            { href: "/settings", label: "Settings", icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            
            if (item.primary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-center h-12 w-12 rounded-full bg-[var(--accent)] text-white shadow-lg"
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-tertiary)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global search modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
