"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars, dollarsToCents } from "./utils";

export default function RecurringModal({
  entry,
  onClose,
  onCreated,
}: {
  entry: any;
  onClose: () => void;
  onCreated?: (ruleId: any) => void;
}) {
  const [displayName, setDisplayName] = useState(entry.bucket ? `${entry.bucket} ${entry.category ?? ""}`.trim() : entry.note ?? "");
  const [autolink, setAutolink] = useState(false);
  const [amount, setAmount] = useState(centsToDollars(entry.amountCents));
  const create = useMutation((api as any).recurring.createRecurringRule as any);
  const link = useMutation((api as any).recurring.linkEntriesToRule as any);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      const cents = dollarsToCents(amount) ?? entry.amountCents;
      const res = await create({
        type: entry.type,
        displayName: displayName.trim() || undefined,
        name: displayName.trim() || undefined,
        bucket: entry.bucket,
        category: entry.category,
        amountCents: cents,
        amountTolerancePercent: 5,
        autolinkEnabled: autolink,
        intervalType: "monthly",
        active: true,
      });

      const id = (res as any)?.id;
      if (id) {
        await link({ ruleId: id, entryIds: [entry._id] });
        onCreated && onCreated(id);
      }

      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-[420px] rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
        <div className="text-sm font-semibold">Make Recurring</div>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="text-xs text-neutral-400 mb-1">Name</div>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-neutral-400 mb-1">Amount</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <div className="text-xs text-neutral-400 mb-1">Cadence</div>
              <select defaultValue="monthly" className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autolink} onChange={(e) => setAutolink(e.target.checked)} />
            <span className="text-xs text-neutral-400">Autolink future entries (use cautiously)</span>
          </label>

          {err ? <div className="text-xs text-rose-400">{err}</div> : null}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-200">Cancel</button>
          <button onClick={onCreate} disabled={busy} className="ml-auto rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-900 disabled:opacity-60">Create</button>
        </div>
      </div>
    </div>
  );
}
