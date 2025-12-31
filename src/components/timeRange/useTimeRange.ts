"use client";

import { useContext } from "react";
import { TimeRangeContext } from "@/src/components/timeRange/TimeRangeProvider";

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) {
    throw new Error("useTimeRange must be used within TimeRangeProvider");
  }
  return ctx;
}
