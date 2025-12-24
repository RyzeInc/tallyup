"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { todayYYYYMMDD, cacheKey, uniqCaseInsensitive } from "@/components/utils";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useQuickLog } from "./QuickLogProvider";

export default function LogForm({ onDone }: { onDone?: (res: { id?: string }) => void }) {
  const quickLog = useQuickLog();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayYYYYMMDD());
  const [bucket, setBucket] = useState("");
  const [customBucket, setCustomBucket] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; msg?: string; undoId?: string }>({ kind: "idle" });

  const addEntry = useMutation(api.entries.addEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  // smart defaults: last entry
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tallyup.lastEntry");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.type) setType(parsed.type);
        if (parsed?.bucket) setBucket(parsed.bucket);
        if (parsed?.category) setCategory(parsed.category);
      }
    } catch {}
  }, []);

  async function onSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!amountCents || amountCents <= 0) return setStatus({ kind: "err", msg: "Enter a valid amount > 0." });

    try {
      const payload: any = { type, amountCents, date: (() => { const [y,m,d] = date.split("-"); return new Date(Number(y), Number(m)-1, Number(d)).getTime(); })() };
      if (bucket) payload.bucket = bucket === "Other" ? customBucket.trim() || "Other" : bucket;
      if (category?.trim()) payload.category = category.trim();
      if (note?.trim()) payload.note = note.trim();
      if (methodOrAccount?.trim()) payload.methodOrAccount = methodOrAccount.trim();
      const res = await addEntry(payload);

      // persist smart defaults
      try {
        localStorage.setItem("tallyup.lastEntry", JSON.stringify({ type, bucket: bucket === "Other" ? customBucket || "Other" : bucket, category }));
      } catch {}

      const id = (res as any)?.id as string | undefined;
      setStatus({ kind: "ok", msg: "Saved.", undoId: id });
      setTimeout(() => setStatus({ kind: "idle" }), 2000);

      // show global toast with undo
      try {
        quickLog.showToast("Saved", async () => {
          if (!id) return;
          try {
            await deleteEntry({ id: id as any });
            quickLog.showToast("Undone");
          } catch (e: any) {
            quickLog.showToast(e?.message ?? "Failed to undo.");
          }
        });
      } catch {}

      onDone?.({ id });

      return id;
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message ?? "Failed to save." });
    }
  }

  async function onUndo() {
    if (status.kind !== "ok" || !status.undoId) return;
    try {
      await deleteEntry({ id: status.undoId as any });
      setStatus({ kind: "ok", msg: "Undone." });
      setTimeout(() => setStatus({ kind: "idle" }), 1200);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to undo." });
    }
  }

  return (
    <form onSubmit={onSave}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setType("expense")} className={type === "expense" ? "rounded-full px-3 py-1 text-xs font-semibold bg-accent text-accent-foreground" : "rounded-full px-3 py-1 text-xs font-semibold border text-neutral-700"}>Spent</button>
        <button type="button" onClick={() => setType("income")} className={type === "income" ? "rounded-full px-3 py-1 text-xs font-semibold bg-accent text-accent-foreground" : "rounded-full px-3 py-1 text-xs font-semibold border text-neutral-700"}>Received</button>
      </div>

      <label className="block text-xs text-neutral-400 mb-1">Amount</label>
      <CurrencyInput valueCents={amountCents ?? undefined} onChange={(c) => setAmountCents(c)} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }} />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Space</label>
          <input value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="Personal" className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--input)", color: "var(--text)" }} />
        </div>
      </div>

      <label className="block text-xs text-neutral-400 mb-1 mt-3">Category (optional)</label>
      <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />

      {showMore ? (
        <>
          <label className="block text-xs text-neutral-400 mb-1 mt-3">Method / Account (optional)</label>
          <Input value={methodOrAccount} onChange={(e) => setMethodOrAccount(e.target.value)} placeholder="e.g., Checking" />
        </>
      ) : null}

      <label className="block text-xs text-neutral-400 mb-1 mt-3">Note (optional)</label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Quick context" />

      <div className="mt-4 flex items-center gap-2">
        <button type="submit" className="rounded-md px-4 py-2 bg-accent text-accent-foreground">Save</button>
        <button type="button" onClick={() => setShowMore((s) => !s)} className="rounded-md px-3 py-2 border">{showMore ? "Less" : "More"}</button>
        <div className="ml-auto text-sm">
          {status.kind === "ok" ? <span style={{ color: "var(--success-foreground)" }}>{status.msg}</span> : null}
          {status.kind === "err" ? <span className="text-danger">{status.msg}</span> : null}
        </div>
      </div>
    </form>
  );
}
