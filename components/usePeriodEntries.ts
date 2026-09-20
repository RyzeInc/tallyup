"use client";
import { useEffect } from "react";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";

/** Complete, reactive period data. Undefined means totals are not ready yet. */
export function usePeriodEntries(startDate: number, endDate: number, enabled = true) {
  const { isAuthenticated } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(api.entries.listActivityEntries,
    enabled && isAuthenticated ? { startDate, endDate } : "skip", { initialNumItems: 250 });
  useEffect(() => { if (status === "CanLoadMore") loadMore(250); }, [status, loadMore]);
  return status === "Exhausted" ? results : undefined;
}
