"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  DEFAULT_BUCKETS,
  EntryType,
  cacheKey,
  dollarsToCents,
  centsToDollars,
  todayYYYYMMDD,
  uniqCaseInsensitive,
  yyyymmddToLocalMidnightTs,
} from "@/components/utils";
import RecurringModal from "@/components/RecurringModal";
import CurrencyInput from "@/components/ui/CurrencyInput";

export default function LogPage() {
  const { user } = useUser();

  const [type, setType] = useState<EntryType>("expense");
  const [amount, setAmount] = useState("");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayYYYYMMDD());

  const [bucket, setBucket] = useState<string>(DEFAULT_BUCKETS[0]);
  const [customBucket, setCustomBucket] = useState("");

  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [status, setStatus] = useState<
    { kind: "idle" } |
    { kind: "ok"; msg: string; undoId?: string } |
    { kind: "err"; msg: string }
  >({ kind: "idle" });

  const lastSavedRef = useRef<{ type: EntryType; bucket: string; category?: string; note?: string; methodOrAccount?: string; amount: string } | null>(null);

  const addEntry = useMutation(api.entries.addEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  const serverBuckets = useQuery(api.entries.listBuckets, { type });
  const effectiveBuckets = useMemo(() => {
    const merged = uniqCaseInsensitive([...(DEFAULT_BUCKETS as unknown as string[]), ...((serverBuckets as string[]) ?? [])]);
    const withoutOther = merged.filter((b) => b.toLowerCase() !== "other");
    return [...withoutOther, "Other"];
  }, [serverBuckets]);

  const effectiveBucket = bucket === "Other" ? (customBucket.trim() || "Other") : bucket;

  const serverCats = useQuery(api.entries.listCategories, { type, bucket: effectiveBucket });
  const [cachedCats, setCachedCats] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(cacheKey(user.id, type, effectiveBucket));
      if (!raw) return setCachedCats([]);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setCachedCats(parsed.filter((x) => typeof x === "string"));
    } catch {
      setCachedCats([]);
    }
  }, [user?.id, type, effectiveBucket]);

  const mergedCats = useMemo(() => {
    return uniqCaseInsensitive([...(cachedCats ?? []), ...((serverCats as string[]) ?? [])]).slice(0, 60);
  }, [cachedCats, serverCats]);

  async function onSave() {
    setStatus({ kind: "idle" });

    const cents = amountCents ?? dollarsToCents(amount);
    if (!cents || cents <= 0) return setStatus({ kind: "err", msg: "Enter a valid amount > 0." });

    const ts = yyyymmddToLocalMidnightTs(date);

    try {
      const res = await addEntry({
        type,
        bucket: effectiveBucket,
        category: category.trim() ? category.trim() : undefined,
        note: note.trim() ? note.trim() : undefined,
        methodOrAccount: methodOrAccount.trim() ? methodOrAccount.trim() : undefined,
        amountCents: cents,
        date: ts,
      });

      // auto-save new category to local cache
      if (user?.id && category.trim()) {
        const next = uniqCaseInsensitive([category.trim(), ...(cachedCats ?? [])]).slice(0, 60);
        setCachedCats(next);
        try {
          localStorage.setItem(cacheKey(user.id, type, effectiveBucket), JSON.stringify(next));
        } catch {}
      }

      lastSavedRef.current = {
        type,
        bucket: effectiveBucket,
        category: category.trim() ? category.trim() : undefined,
        note: note.trim() ? note.trim() : undefined,
        methodOrAccount: methodOrAccount.trim() ? methodOrAccount.trim() : undefined,
        amount,
      };
      // reset amountCents
      setAmountCents(null);

      setAmount("");
      setCategory("");
      setNote("");
      setMethodOrAccount("");

      const undoId = (res as any)?.id as string | undefined;
      setStatus({ kind: "ok", msg: "Saved.", undoId });
      setTimeout(() => setStatus({ kind: "idle" }), 5000);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to save." });
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

  function duplicateLast() {
    const last = lastSavedRef.current;
    if (!last) return;
    setType(last.type);
    setBucket(last.bucket === "Other" ? "Other" : last.bucket);
    if (last.bucket !== "Other") setCustomBucket("");
    setAmount(last.amount);
    setAmountCents(last.amount ? Math.round(Number(last.amount) * 100) : null);
    setCategory(last.category ?? "");
    setNote(last.note ?? "");
    setMethodOrAccount(last.methodOrAccount ?? "");
    setShowMore(Boolean(last.methodOrAccount));
  }

  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div>
      <div className="mb-4">
        <div className="text-2xl font-semibold tracking-tight">Add entry</div>
        <div className="mt-1 text-sm text-neutral-400">Just the basics — review anytime.</div>
      </div>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 mb-3">Sign in to start logging.</div>
          <SignInButton mode="modal">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("expense")}
            className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
              type === "expense" ? "" : "bg-neutral-900/30 border-neutral-800 text-neutral-200"
            }`}
            style={type === "expense" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" } : undefined}
          >
            Spent
          </button>
          <button
            onClick={() => setType("income")}
            className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
              type === "income" ? "" : "bg-neutral-900/30 border-neutral-800 text-neutral-200"
            }`}
            style={type === "income" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" } : undefined}
          >
            Received
          </button>
        </div>

        <label className="block text-xs text-neutral-400 mb-1">How much was it?</label>
        <CurrencyInput
          valueCents={amountCents ?? undefined}
          onChange={(c) => {
            setAmountCents(c);
            setAmount(c ? (c / 100).toFixed(2) : "");
          }}
        />

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={duplicateLast}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/30 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
          >
            Use last
          </button>
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/30 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-neutral-600"
          >
            {showMore ? "Less" : "Options"}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">When was this?</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Which part of your life?</label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              {effectiveBuckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {bucket === "Other" ? (
          <input
            value={customBucket}
            onChange={(e) => setCustomBucket(e.target.value)}
            placeholder="Type a custom bucket (e.g., Baby, School, Rental)"
            className="mb-4 w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
          />
        ) : null}

        <label className="block text-xs text-neutral-400 mb-1">Category (optional)</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="cat-suggestions"
          placeholder="Start typing… (auto-remembers)"
          className="mb-4 w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
        />
        <datalist id="cat-suggestions">
          {mergedCats.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        {showMore ? (
          <>
            <label className="block text-xs text-neutral-400 mb-1">
              {type === "expense" ? "Payment method (optional)" : "Account received on (optional)"}
            </label>
            <input
              value={methodOrAccount}
              onChange={(e) => setMethodOrAccount(e.target.value)}
              placeholder={type === "expense" ? "e.g., Debit, Discover, Checking" : "e.g., Checking, Cash"}
              className="mb-4 w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </>
        ) : null}

        <label className="block text-xs text-neutral-400 mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Quick context (why / who / reimbursable / client / etc.)"
          className="mb-4 w-full resize-none rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
        />

        <button
          onClick={onSave}
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold hover:opacity-95 active:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Save
        </button>

        <div className="mt-3 min-h-[1.25rem] text-sm flex items-center gap-3">
          {status.kind === "ok" ? <span style={{ color: "var(--success-foreground)" }}>{status.msg}</span> : null}
          {status.kind === "err" ? <span className="text-rose-400">{status.msg}</span> : null}
          {status.kind === "ok" && status.undoId ? (
            <>
              <button
                type="button"
                onClick={onUndo}
                className="text-xs text-neutral-300 underline underline-offset-4 hover:text-white"
              >
                Undo
              </button>

              <button
                type="button"
                onClick={() => {
                  // build a minimal entry object for the modal
                  const last = lastSavedRef.current;
                  if (!last || !status.undoId) return;
                  setSelected({
                    _id: status.undoId,
                    type: last.type,
                    bucket: last.bucket,
                    category: last.category,
                    note: last.note,
                    methodOrAccount: last.methodOrAccount,
                    amountCents: dollarsToCents(last.amount),
                  });
                }}
                className="ml-3 rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-200"
              >
                Save as pattern
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-6 text-xs text-neutral-500">
          If you skip Category, it goes to Review so you can finish later.
        </div>

        {selected ? <RecurringModal entry={selected} onClose={() => setSelected(null)} /> : null}

        <div className="mt-6 text-xs text-neutral-500">
          If you skip Category, it goes to Review so you can finish later.
        </div>
      </SignedIn>
    </div>
  );
}
