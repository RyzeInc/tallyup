"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

export default function RecurringPage() {
  const rules = useQuery((api as any).recurring.listRecurringRules as any) as any[] | undefined;

  return (
    <div>
      <div className="mb-4">
        <div className="text-2xl font-semibold tracking-tight">Patterns</div>
        <div className="mt-1 text-sm text-neutral-400">Saved patterns you’ve confirmed.</div>
      </div>

      {!rules ? (
        <div className="text-sm text-neutral-400">Loading…</div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-300">No patterns yet.</div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r._id} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
              <div className="text-sm font-medium">{r.displayName ?? r.name}</div>
              <div className="text-xs text-neutral-400 mt-1">{r.intervalType} · {r.autolinkEnabled ? "Auto-applied" : "Manual"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
