"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as Lucide from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";

type FilterType = "all" | "expense" | "income";

export default function FilterBar() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [type, setType] = useState<FilterType>(() => {
    const raw = searchParams.get("type");
    return raw === "expense" || raw === "income" ? raw : "all";
  });
  const [needsReview, setNeedsReview] = useState(() => searchParams.get("review") === "1");
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "");
  const [tag, setTag] = useState(() => searchParams.get("tag") ?? "");

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as Doc<"entries">[] | undefined;
  const reviewCount = inbox?.length ?? 0;
  const userPrefs = useQuery(api.preferences.getUserPreferences, {});

  const categories = useQuery(api.categories.listCategories, {
    categoryType: type === "all" ? undefined : type,
  }) as { _id: string; name: string }[] | undefined;
  const hiddenNames = React.useMemo(() => {
    if (type === "expense") return userPrefs?.hiddenExpenseCategories ?? [];
    if (type === "income") return userPrefs?.hiddenIncomeCategories ?? [];
    return [
      ...(userPrefs?.hiddenExpenseCategories ?? []),
      ...(userPrefs?.hiddenIncomeCategories ?? []),
    ];
  }, [type, userPrefs?.hiddenExpenseCategories, userPrefs?.hiddenIncomeCategories]);
  const hiddenSet = React.useMemo(
    () => new Set(hiddenNames.map((c) => c.toLowerCase())),
    [hiddenNames]
  );
  const visibleCategories = React.useMemo(() => {
    return (categories ?? []).filter((c) => !hiddenSet.has(c.name.toLowerCase()));
  }, [categories, hiddenSet]);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (q) p.set("q", q);
      else p.delete("q");
      const qs = p.toString();
      router.replace(qs ? `/activity?${qs}` : `/activity`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setTypeAndPush(t: string) {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (t && t !== "all") p.set("type", t);
    else p.delete("type");
    p.delete("category");
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
    setType(t as FilterType);
    setCategory("");
  }

  function toggleReview() {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (needsReview) {
      p.delete("review");
      setNeedsReview(false);
    } else {
      p.set("review", "1");
      setNeedsReview(true);
    }
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
  }

  function setCategoryAndPush(c: string) {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (c) p.set("category", c);
    else p.delete("category");
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
    setCategory(c);
  }

  function setTagAndPush(tg: string) {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (tg) p.set("tag", tg);
    else p.delete("tag");
    const qs = p.toString();
    router.replace(qs ? `/activity?${qs}` : `/activity`);
    setTag(tg);
  }

  const filterChip = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
        : "hover:bg-[var(--surface-subtle)]"
    }`;

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Lucide.Search className="h-5 w-5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
        <input
          type="text"
          placeholder="Search transactions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent text-body outline-none placeholder:text-[var(--text-tertiary)]"
          style={{ color: "var(--text)" }}
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <Lucide.X className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        )}
      </div>

      {/* Filter Chips Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type Filters */}
        <button
          onClick={() => setTypeAndPush("all")}
          className={filterChip(type === "all")}
          style={{
            border: `1px solid ${type === "all" ? "var(--accent)" : "var(--border)"}`,
            color: type === "all" ? "var(--accent)" : "var(--text)",
          }}
        >
          All
        </button>
        <button
          onClick={() => setTypeAndPush("expense")}
          className={filterChip(type === "expense")}
          style={{
            border: `1px solid ${type === "expense" ? "var(--accent)" : "var(--border)"}`,
            color: type === "expense" ? "var(--accent)" : "var(--text)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <Lucide.ArrowUpRight className="h-4 w-4" />
            Spent
          </span>
        </button>
        <button
          onClick={() => setTypeAndPush("income")}
          className={filterChip(type === "income")}
          style={{
            border: `1px solid ${type === "income" ? "var(--accent)" : "var(--border)"}`,
            color: type === "income" ? "var(--accent)" : "var(--text)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <Lucide.ArrowDownLeft className="h-4 w-4" />
            Received
          </span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px mx-1" style={{ backgroundColor: "var(--border)" }} />

        {/* Needs Review */}
        <button
          onClick={toggleReview}
          className={`relative ${filterChip(needsReview)}`}
          style={{
            border: `1px solid ${needsReview ? "var(--warning)" : "var(--border)"}`,
            color: needsReview ? "var(--warning)" : "var(--text)",
            backgroundColor: needsReview ? "var(--warning-subtle)" : undefined,
          }}
        >
          <span className="flex items-center gap-1.5">
            <Lucide.AlertCircle className="h-4 w-4" />
            Needs review
            {reviewCount > 0 && (
              <span
                className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: needsReview ? "var(--warning)" : "var(--danger)",
                  color: "#fff",
                }}
              >
                {reviewCount > 99 ? "99+" : reviewCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Category Pills (scrollable) */}
      {visibleCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {visibleCategories.slice(0, 8).map((c) => {
            const isSelected = category === c._id || category === c.name;
            return (
            <button
              key={c._id}
              onClick={() => setCategoryAndPush(isSelected ? "" : c._id)}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: isSelected ? "var(--accent)" : "var(--surface)",
                color: isSelected ? "var(--accent-foreground)" : "var(--text-secondary)",
                border: isSelected ? "none" : "1px solid var(--border)",
              }}
            >
              {c.name}
            </button>
          );
          })}
        </div>
      )}

      {/* Tag Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {["Subscription", "Deductible", "Reimbursable", "Shared", "Medical"].map((t) => (
          <button
            key={t}
            onClick={() => setTagAndPush(tag === t ? "" : t)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: tag === t ? "var(--accent)" : "transparent",
              color: tag === t ? "var(--accent-foreground)" : "var(--text-tertiary)",
              border: tag === t ? "none" : "1px solid var(--border)",
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
