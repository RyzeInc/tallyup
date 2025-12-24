"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { centsToDollars, dollarsToCents } from "./utils";
import { useToast } from "./ToastProvider";
import { useOptimisticLinks } from "./OptimisticLinksProvider";

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
  const [autolinkConfirm, setAutolinkConfirm] = useState(false);
  const [amount, setAmount] = useState(centsToDollars(entry.amountCents));
  const create = useMutation((api as any).recurring.createRecurringRule as any);
  const link = useMutation((api as any).recurring.linkEntriesToRule as any);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { push } = useToast();
  const { add } = useOptimisticLinks();

  async function onCreate() {
    if (autolink && !autolinkConfirm) {
      setErr("Please confirm that you understand what autolink does");
      return;
    }

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
        // optimistic local UI update
        add(entry._id);
        push({ title: "Recurring rule created", body: `${displayName || "Rule"} — linked 1 entry`, kind: "success" });

        await link({ ruleId: id, entryIds: [entry._id] });
        onCreated && onCreated(id);
      }

      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create");
      push({ title: "Failed to create", body: e?.message ?? "Unknown error", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{ backgroundColor: document.documentElement.classList.contains("dark") ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.12)" }}
      />
      <div className="relative z-10 w-[420px] rounded-2xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--card-foreground)" }}>
        <div className="text-sm font-semibold">Make Recurring</div>
        <div className="mt-2 text-xs text-neutral-400">Create a rule to automatically associate similar future transactions. We’ll never enable automatic linking without your explicit confirmation.</div>

        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="text-xs text-neutral-400 mb-1">Name</div>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-neutral-400 mb-1">Amount</div>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <div className="text-xs text-neutral-400 mb-1">Cadence</div>
              <select defaultValue="monthly" className="w-full rounded-xl border px-3 py-2 text-sm outline-none">
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autolink} onChange={(e) => { setAutolink(e.target.checked); if (!e.target.checked) setAutolinkConfirm(false); }} />
              <span className="text-xs text-neutral-400">Autolink future entries (off by default)</span>
            </label>

            {autolink ? (
              <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--popover)", color: "var(--popover-foreground)" }}>
                <div className="font-medium">Autolink confirmation</div>
                <div className="text-xs mt-1">Autolink will automatically link incoming entries that match this rule. It's best for stable, regular payments (e.g., rent, salary). Please confirm that you understand:</div>
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={autolinkConfirm} onChange={(e) => setAutolinkConfirm(e.target.checked)} />
                  <span className="text-xs">I understand and want to enable autolink</span>
                </label>
              </div>
            ) : null}
          </div>

          {err ? <div className="text-xs text-rose-400">{err}</div> : null}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="rounded-xl border px-3 py-2 text-xs">Cancel</button>
          <button onClick={onCreate} disabled={busy} className="ml-auto rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-900 disabled:opacity-60">Create recurring rule</button>
        </div>
      </div>
    </div>
  );
}
