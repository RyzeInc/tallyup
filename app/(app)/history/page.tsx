"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import RecurringModal from "@/components/RecurringModal";
import ActivityTable from "@/components/activity/ActivityTable";
import FilterBar from "@/components/activity/FilterBar";
import DateRangeControl from "@/components/activity/DateRangeControl";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { EntryType, startOfMonthLocalTs, startOfWeekLocalTs, todayYYYYMMDD, yyyymmddToLocalMidnightTs } from "@/components/utils";
import { useRouter, useSearchParams } from "next/navigation";

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [type, setType] = useState<"all" | EntryType>(() => (searchParams.get("type") as any) ?? "all");
  const [bucket, setBucket] = useState<string>(() => searchParams.get("bucket") ?? "");
  const q = searchParams.get("q") ?? "";
  const reviewOnly = searchParams.get("review") === "1";

  const [range, setRange] = useState<"week" | "month" | "custom">(() => (searchParams.get("range") as any) ?? "month");
  const [from, setFrom] = useState(() => searchParams.get("from") ?? todayYYYYMMDD());
  const [to, setTo] = useState(() => searchParams.get("to") ?? todayYYYYMMDD());

  // sync state -> URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (type && type !== "all") p.set("type", type);
    if (bucket) p.set("bucket", bucket);
    if (range && range !== "month") p.set("range", range);
    if (range === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    const qs = p.toString();
    const url = qs ? `/activity?${qs}` : `/activity`;
    router.replace(url);
  }, [type, bucket, range, from, to, router]);

  const deleteEntry = useMutation(api.entries.deleteEntry);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (range === "week") return { startDate: startOfWeekLocalTs(now), endDate: Date.now() + 1 };
    if (range === "month") return { startDate: startOfMonthLocalTs(now), endDate: Date.now() + 1 };
    const s = yyyymmddToLocalMidnightTs(from);
    const e = yyyymmddToLocalMidnightTs(to) + 24 * 60 * 60 * 1000;
    return { startDate: Math.min(s, e), endDate: Math.max(s, e) };
  }, [range, from, to]);

  // paginated entries: cursor-based pages from server
  const [pages, setPages] = useState<any[][]>([]);
  const [seenIds, setSeenIds] = useState<Record<string, boolean>>({});
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [cursorList, setCursorList] = useState<Array<number | undefined>>([undefined]);

  const currentCursor = cursorList[cursorList.length - 1];

  const categoryParam = searchParams.get("category") ?? undefined;
  const tagParam = searchParams.get("tag") ?? undefined;

  const pageResult = useQuery(api.entries.listEntriesPaged, {
    type: type === "all" ? undefined : type,
    buckets: bucket.trim() ? [bucket] : undefined,
    categories: categoryParam ? [categoryParam] : undefined,
    tags: tagParam ? [tagParam] : undefined,
    startDate,
    endDate,
    needsReview: reviewOnly ? true : undefined,
    search: q ? q : undefined,
    limit: 60,
    cursorDate: currentCursor,
  }) as any | undefined;

  // when filters change, reset pages
  useEffect(() => {
    setPages([]);
    setNextCursor(undefined);
    setCursorList([undefined]);
    setSeenIds({});
  }, [type, bucket, range, from, to]);

  // append page result when it arrives
  useEffect(() => {
    if (!pageResult?.rows) return;
    const newRows: any[] = [];
    const seen = { ...seenIds };
    for (const r of pageResult.rows) {
      if (!seen[r._id]) {
        newRows.push(r);
        seen[r._id] = true;
      }
    }
    if (newRows.length) setPages((p) => [...p, newRows]);
    setSeenIds(seen);
    setNextCursor(pageResult.nextCursor);
  }, [pageResult]);

  const allEntries = pages.flat();

  const [selected, setSelected] = useState<any | null>(null);

  async function loadMore() {
    if (!nextCursor) return;
    setCursorList((c) => [...c, nextCursor]);
  }

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="Filter & explore your past."
        actions={<div className="text-sm text-neutral-400">Tip: Use "Save as pattern" to save repetitive transactions.</div>}
      />

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 mb-3">Sign in to view history.</div>
          <SignInButton mode="modal">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="mb-4">
          <FilterBar buckets={[]} />
          <div className="mt-3">
            <DateRangeControl range={range} setRange={(r) => setRange(r as any)} from={from} to={to} setFrom={setFrom} setTo={setTo} />
          </div>
        </div>

        {pages.length === 0 ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : allEntries.length === 0 ? (
          <EmptyState title="No entries" subtitle="No entries in this range." />
        ) : (
          <div className="space-y-3">
            <ActivityTable
              entries={allEntries}
              onDelete={(id) => deleteEntry({ id })}
              onSavePattern={(e) => setSelected(e)}
              onBulkComplete={() => {
                // reset pages to refresh from server
                setPages([]);
                setCursorList([undefined]);
                setSeenIds({});
              }}
            />

            {nextCursor ? (
              <div className="mt-2 text-center">
                <button onClick={loadMore} className="rounded-md px-4 py-2 border">Load more</button>
              </div>
            ) : null}
          </div>
        )}

        {selected ? <RecurringModal entry={selected} onClose={() => setSelected(null)} onCreated={(id) => setSelected(null)} /> : null}
      </SignedIn>
    </div>
  );
}

function pill(active: boolean) {
  return [
    "rounded-full px-3 py-1 text-xs font-semibold",
    active ? "bg-accent text-accent-foreground" : "border text-neutral-700",
  ].join(" ");
}
function dateInput() {
  return "w-full rounded-xl border px-3 py-2 text-sm";
}
