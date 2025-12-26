"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { todayYYYYMMDD, cacheKey, uniqCaseInsensitive, INCOME_SPACES, EXPENSE_SPACES, CONTEXT_TAGS } from "@/components/utils";
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
  const [note, setNote] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [touched, setTouched] = useState({ amount: false, date: false, bucket: false, tags: false });
  
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
      }
    } catch {}
  }, []);

  async function onSave(e?: React.FormEvent) {
    e?.preventDefault();
    // mark touched so UI shows validation
    setTouched({ amount: true, date: true, bucket: true, tags: true });

    // basic required validation
    let hasError = false;
    if (!amountCents || amountCents <= 0) hasError = true;
    if (!date) hasError = true;
    if (!bucket) hasError = true;
    if (tags.length === 0) hasError = true;
    if (hasError) return setStatus({ kind: "err", msg: "Please fill required fields." });

    try {
      const payload: any = { type, amountCents, date: (() => { const [y,m,d] = date.split("-"); return new Date(Number(y), Number(m)-1, Number(d)).getTime(); })() };
      if (bucket) payload.category = bucket === "Other" ? customBucket.trim() || "Other" : bucket;
      if (note?.trim()) payload.note = note.trim();
      if (methodOrAccount?.trim()) payload.methodOrAccount = methodOrAccount.trim();
      if (tags.length > 0) payload.tags = tags;
      const res = await addEntry(payload);

      // persist smart defaults (include tags)
      try {
        localStorage.setItem(
          "tallyup.lastEntry",
          JSON.stringify({
            type,
            bucket: bucket === "Other" ? customBucket || "Other" : bucket,
            tags: tags.length ? tags : undefined,
          })
        );
      } catch {}

      const id = (res as any)?.id as string | undefined;
      setStatus({ kind: "ok", msg: "Saved.", undoId: id });
      setTimeout(() => setStatus({ kind: "idle" }), 2000);
      // clear selected tags after successful save
      setTags([]);

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
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType("expense")}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "expense"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border hover:bg-[var(--surface-subtle)]"
          }`}
          style={{
            borderColor: type === "expense" ? undefined : "var(--border)",
            color: type === "expense" ? undefined : "var(--text)",
          }}
        >
          Spent
        </button>
        <button
          type="button"
          onClick={() => setType("income")}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "income"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border hover:bg-[var(--surface-subtle)]"
          }`}
          style={{
            borderColor: type === "income" ? undefined : "var(--border)",
            color: type === "income" ? undefined : "var(--text)",
          }}
        >
          Received
        </button>
      </div>

      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        Amount
      </label>
      <CurrencyInput
        valueCents={amountCents ?? undefined}
        onChange={(c) => setAmountCents(c)}
        invalid={touched.amount && (!amountCents || amountCents <= 0)}
        onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, date: true }))}
            className="w-full rounded-lg border px-3 py-2.5 text-sm"
            style={{
              borderColor: touched.date && !date ? "var(--danger)" : "var(--border)",
              backgroundColor: "var(--input)",
              color: "var(--text)",
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {type === "income" ? "Source" : "Space"}
          </label>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, bucket: true }))}
            className="w-full rounded-lg border px-3 py-2.5 text-sm appearance-none cursor-pointer"
            style={{
              borderColor: touched.bucket && !bucket ? "var(--danger)" : "var(--border)",
              backgroundColor: "var(--input)",
              color: "var(--text)",
            }}
          >
            <option value="">Choose category...</option>
            {(type === "income" ? INCOME_SPACES : EXPENSE_SPACES).map((space) => (
              <option key={space} value={space}>
                {space}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Context Tags - composable, not mutually exclusive */}
      <div className="mt-4">
        <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
          Context Tags
        </label>
        <div
          className="rounded-lg p-2"
          style={{ border: touched.tags && tags.length === 0 ? "1px solid var(--danger)" : "1px solid transparent" }}
        >
          <div className="flex flex-wrap gap-2">
            {CONTEXT_TAGS.map((tag) => {
              const isSelected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setTouched((t) => ({ ...t, tags: true }));
                    setTags((prev) =>
                      isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                    );
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border hover:bg-[var(--surface-subtle)]"
                  }`}
                  style={{
                    borderColor: isSelected ? undefined : "var(--border)",
                    color: isSelected ? undefined : "var(--text)",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

    
      <div className="mt-4">
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Note (optional)
        </label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Quick context" />
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Method / Account (optional)
        </label>
        <Input value={methodOrAccount} onChange={(e) => setMethodOrAccount(e.target.value)} placeholder={"e.g., Checking, Debit, Cash"} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-foreground)",
          }}
        >
          Save
        </button>
      </div>

      {/* Status feedback */}
      {status.kind !== "idle" && (
        <div className="mt-3 text-center text-sm">
          {status.kind === "ok" && (
            <span style={{ color: "var(--success)" }}>{status.msg}</span>
          )}
          {status.kind === "err" && (
            <span style={{ color: "var(--danger)" }}>{status.msg}</span>
          )}
        </div>
      )}
    </form>
  );
}
