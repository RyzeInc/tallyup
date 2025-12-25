"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import RecurringModal from "@/components/RecurringModal";
import ActivityTable from "@/components/activity/ActivityTable";
import FilterBar from "@/components/activity/FilterBar";
import DateRangeControl from "@/components/activity/DateRangeControl";
import EmptyState from "@/components/ui/EmptyState";
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

  // Sync URL -> local state when `FilterBar` or other components update the query params.
  useEffect(() => {
    const spType = (searchParams.get("type") as any) ?? "all";
    const spBucket = searchParams.get("bucket") ?? "";
    const spRange = (searchParams.get("range") as any) ?? "month";
    const spFrom = searchParams.get("from") ?? todayYYYYMMDD();
    const spTo = searchParams.get("to") ?? todayYYYYMMDD();

    setType(spType);
    setBucket(spBucket);
    setRange(spRange as any);
    setFrom(spFrom);
    setTo(spTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    <div className="space-y-4 pb-4">
      {/* Header Card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-h1" style={{ color: "var(--text)" }}>Activity</h1>
          <DateRangeControl
            range={range}
            setRange={(r) => setRange(r as any)}
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
          />
        </div>
      </div>

      <SignedOut>
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to view your activity
          </div>
          <SignInButton mode="modal">
            <button
              className="rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Search + Filters */}
        <FilterBar buckets={[]} />

        {/* Results */}
        {pages.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-center gap-2 text-meta">
              <Lucide.Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-tertiary)" }} />
              <span>Loading transactions…</span>
            </div>
          </div>
        ) : allEntries.length === 0 ? (
          <EmptyState
            title="No transactions"
            subtitle="No entries match your current filters."
          />
        ) : (
          <div className="space-y-3">
            <ActivityTable
              entries={allEntries}
              onDelete={(id) => deleteEntry({ id })}
              onSavePattern={(e) => setSelected(e)}
              onBulkComplete={() => {
                setPages([]);
                setCursorList([undefined]);
                setSeenIds({});
              }}
            />

            {nextCursor && (
              <div className="text-center pt-2">
                <button
                  onClick={loadMore}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  <Lucide.ChevronDown className="h-4 w-4" />
                  Load more
                </button>
              </div>
            )}
          </div>
        )}

        {selected && (
          <RecurringModal
            entry={selected}
            onClose={() => setSelected(null)}
            onCreated={() => setSelected(null)}
          />
        )}
      </SignedIn>
    </div>
  );
}
