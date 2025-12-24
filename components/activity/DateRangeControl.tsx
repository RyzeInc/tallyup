"use client";

import React from "react";

export default function DateRangeControl({ range, setRange, from, to, setFrom, setTo }: { range: string; setRange: (r: string) => void; from: string; to: string; setFrom: (s: string) => void; setTo: (s: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setRange("week")} className={range === "week" ? "rounded-full px-3 py-1 text-xs font-semibold bg-accent text-accent-foreground" : "rounded-full px-3 py-1 text-xs font-semibold border text-neutral-700"}>This Week</button>
      <button onClick={() => setRange("month")} className={range === "month" ? "rounded-full px-3 py-1 text-xs font-semibold bg-accent text-accent-foreground" : "rounded-full px-3 py-1 text-xs font-semibold border text-neutral-700"}>This Month</button>
      <button onClick={() => setRange("custom")} className={range === "custom" ? "rounded-full px-3 py-1 text-xs font-semibold bg-accent text-accent-foreground" : "rounded-full px-3 py-1 text-xs font-semibold border text-neutral-700"}>Custom</button>
      {range === "custom" ? (
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }} />
        </div>
      ) : null}
    </div>
  );
}
