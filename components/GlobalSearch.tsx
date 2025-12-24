"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Search,
  LayoutGrid,
  Plus,
  History,
  Inbox,
  BarChart3,
  Settings,
  Layers,
  RefreshCw,
  ArrowRight,
  Hash,
} from "lucide-react";

const pages = [
  { href: "/overview", label: "Overview", icon: LayoutGrid, keywords: ["home", "dashboard"] },
  { href: "/log", label: "Add Entry", icon: Plus, keywords: ["new", "create", "add", "log"] },
  { href: "/activity", label: "Transactions", icon: History, keywords: ["history", "activity", "list"] },
  { href: "/review", label: "Review Queue", icon: Inbox, keywords: ["inbox", "needs review", "uncategorized"] },
  { href: "/rules", label: "Rules", icon: Layers, keywords: ["patterns", "recurring"] },
  { href: "/recurring", label: "Recurring", icon: RefreshCw, keywords: ["repeat", "subscription"] },
  { href: "/insights", label: "Insights", icon: BarChart3, keywords: ["analytics", "charts", "summary"] },
  { href: "/settings", label: "Settings", icon: Settings, keywords: ["profile", "account", "preferences"] },
];

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch recent entries for search
  const recentEntries = useQuery(api.entries.listEntries, { limit: 50 }) as any[] | undefined;

  // Filter results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    
    // Pages that match
    const pageResults = pages.filter((p) => {
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.includes(q))
      );
    }).map((p) => ({ type: "page" as const, ...p }));

    // Entries that match (if query is at least 2 chars)
    let entryResults: Array<{ type: "entry"; entry: any }> = [];
    if (q.length >= 2 && recentEntries) {
      entryResults = recentEntries
        .filter((e) => {
          const haystack = [
            e.category ?? "",
            e.bucket ?? "",
            e.note ?? "",
            ...(e.tags ?? []),
          ].join(" ").toLowerCase();
          return haystack.includes(q);
        })
        .slice(0, 5)
        .map((e) => ({ type: "entry" as const, entry: e }));
    }

    return [...pageResults, ...entryResults];
  }, [query, recentEntries]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          if (selected.type === "page") {
            router.push(selected.href);
          } else {
            // Navigate to entry in activity with the entry ID
            router.push(`/activity?q=${encodeURIComponent(selected.entry.category || selected.entry.bucket || "")}`);
          }
          onClose();
        }
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIndex, router, onClose]);

  if (!open) return null;

  function handleSelect(result: typeof results[0]) {
    if (result.type === "page") {
      router.push(result.href);
    } else {
      router.push(`/activity?q=${encodeURIComponent(result.entry.category || result.entry.bucket || "")}`);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[15%] w-full max-w-lg -translate-x-1/2 px-4">
        <div
          className="overflow-hidden rounded-xl border bg-[var(--surface)] shadow-xl animate-slide-down"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b" style={{ borderColor: "var(--border)" }}>
            <Search className="h-5 w-5 text-[var(--text-tertiary)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, transactions..."
              className="flex-1 bg-transparent py-4 text-[var(--text)] placeholder-[var(--text-placeholder)] outline-none text-sm"
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-[var(--text-tertiary)] bg-[var(--surface-subtle)] rounded border" style={{ borderColor: "var(--border)" }}>
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                No results found
              </div>
            ) : (
              <>
                {/* Pages section */}
                {results.some((r) => r.type === "page") && (
                  <div className="px-3 py-2">
                    <div className="px-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Pages
                    </div>
                    {results
                      .filter((r) => r.type === "page")
                      .map((result, idx) => {
                        if (result.type !== "page") return null;
                        const Icon = result.icon;
                        const globalIdx = results.indexOf(result);
                        return (
                          <button
                            key={result.href}
                            onClick={() => handleSelect(result)}
                            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors ${
                              globalIdx === selectedIndex
                                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                                : "text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="flex-1 text-left">{result.label}</span>
                            <ArrowRight className="h-4 w-4 opacity-50" />
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* Entries section */}
                {results.some((r) => r.type === "entry") && (
                  <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="px-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Recent Entries
                    </div>
                    {results
                      .filter((r) => r.type === "entry")
                      .map((result) => {
                        if (result.type !== "entry") return null;
                        const e = result.entry;
                        const globalIdx = results.indexOf(result);
                        return (
                          <button
                            key={e._id}
                            onClick={() => handleSelect(result)}
                            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors ${
                              globalIdx === selectedIndex
                                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                                : "text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                            }`}
                          >
                            <Hash className="h-4 w-4 text-[var(--text-tertiary)]" />
                            <div className="flex-1 text-left">
                              <div className="font-medium">{e.category || e.bucket || "Uncategorized"}</div>
                              <div className="text-xs text-[var(--text-secondary)]">
                                ${(e.amountCents / 100).toFixed(2)} · {e.type}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 opacity-50" />
                          </button>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-[var(--text-tertiary)]" style={{ borderColor: "var(--border)" }}>
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
