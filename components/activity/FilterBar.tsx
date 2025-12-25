"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Pill from "@/components/ui/Pill";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AlertCircle } from "lucide-react";

export default function FilterBar({ buckets = [] as string[] }: { buckets?: string[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [type, setType] = useState(() => (searchParams.get("type") as any) ?? "all");
  const [needsReview, setNeedsReview] = useState(() => (searchParams.get("review") === "1"));
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "");
  const [tag, setTag] = useState(() => searchParams.get("tag") ?? "");

  // Get review count for badge
  const inbox = useQuery(api.entries.listInbox, { limit: 999 }) as any[] | undefined;
  const reviewCount = inbox?.length ?? 0;

  // fetch categories when a specific type is selected
  const categories = useQuery(api.entries.listCategories, {
    type: type === "all" ? ("expense" as any) : (type as any),
    bucket: undefined,
  }) as string[] | undefined;

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(searchParams as any);
      if (q) p.set("q", q); else p.delete("q");
      router.replace(`/activity?${p.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setTypeAndPush(t: string) {
    const p = new URLSearchParams(searchParams as any);
    if (t && t !== "all") p.set("type", t); else p.delete("type");
    // clear category when type changes
    p.delete("category");
    router.replace(`/activity?${p.toString()}`);
    setType(t as any);
    setCategory("");
  }

  function toggleReview() {
    const p = new URLSearchParams(searchParams as any);
    if (needsReview) {
      p.delete("review");
      setNeedsReview(false);
    } else {
      p.set("review", "1");
      setNeedsReview(true);
    }
    router.replace(`/activity?${p.toString()}`);
  }

  function setCategoryAndPush(c: string) {
    const p = new URLSearchParams(searchParams as any);
    if (c) p.set("category", c); else p.delete("category");
    router.replace(`/activity?${p.toString()}`);
    setCategory(c);
  }

  function setTagAndPush(tg: string) {
    const p = new URLSearchParams(searchParams as any);
    if (tg) p.set("tag", tg); else p.delete("tag");
    router.replace(`/activity?${p.toString()}`);
    setTag(tg);
  }

  return (
    <div className="mb-3 space-y-2">
      <div className="flex gap-2">
        <Input placeholder="Search merchant, note, tag, amount…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill active={type === "all"} onClick={() => setTypeAndPush("all")}>All</Pill>
        <Pill active={type === "expense"} onClick={() => setTypeAndPush("expense")}>Spent</Pill>
        <Pill active={type === "income"} onClick={() => setTypeAndPush("income")}>Received</Pill>
        
        {/* Needs Review filter with badge */}
        <button
          onClick={toggleReview}
          className={`relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            needsReview ? "bg-[var(--accent-subtle)] border-[var(--accent)]" : "hover:bg-[var(--surface-subtle)]"
          }`}
          style={{
            borderColor: needsReview ? "var(--accent)" : "var(--border)",
            color: needsReview ? "var(--accent)" : "var(--text)",
          }}
        >
          <AlertCircle className="h-4 w-4" />
          <span>Needs review</span>
          {reviewCount > 0 && (
            <span
              className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold"
              style={{
                backgroundColor: needsReview ? "var(--accent)" : "var(--danger)",
                color: "#fff",
              }}
            >
              {reviewCount > 99 ? "99+" : reviewCount}
            </span>
          )}
        </button>

        <div className="ml-2 flex gap-2">
          {((categories ?? []) as string[]).slice(0, 6).map((c) => (
            <button key={c} onClick={() => setCategoryAndPush(c)} className={"rounded-full px-3 py-1 text-xs " + (category === c ? "bg-accent text-accent-foreground" : "border text-neutral-700")}>{c}</button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          {buckets.slice(0, 4).map((b) => (
            <button
              key={b}
              onClick={() => {
                const p = new URLSearchParams(searchParams as any);
                if (p.get("bucket") === b) p.delete("bucket"); else p.set("bucket", b);
                router.replace(`/activity?${p.toString()}`);
              }}
              className="rounded-full px-3 py-1 text-xs border text-neutral-700"
            >
              {b}
            </button>
          ))}

          {/** tags quick filters */}
          <div className="flex gap-2 ml-2">
            {(["Subscription","Deductible","Reimbursable","Shared","Medical"] as string[]).map((t) => (
              <button key={t} onClick={() => setTagAndPush(tag === t ? "" : t)} className={"rounded-full px-3 py-1 text-xs " + (tag === t ? "bg-accent text-accent-foreground" : "border text-neutral-700")}>{t}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
