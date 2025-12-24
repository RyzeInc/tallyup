"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import TagChips from "@/components/TagChips";
import {
  DEFAULT_BUCKETS,
  DEFAULT_TAGS,
  EntryType,
  cacheKey,
  dollarsToCents,
  todayYYYYMMDD,
  uniqCaseInsensitive,
  yyyymmddToLocalMidnightTs,
} from "@/components/utils";

export default function LogPage() {
  const { user } = useUser();

  const [type, setType] = useState<EntryType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayYYYYMMDD());

  const [bucket, setBucket] = useState<string>(DEFAULT_BUCKETS[0]);
  const [customBucket, setCustomBucket] = useState("");

  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; msg?: string }>({ kind: "idle" });

  const addEntry = useMutation(api.entries.addEntry);

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

    const cents = dollarsToCents(amount);
    if (!cents || cents <= 0) return setStatus({ kind: "err", msg: "Enter a valid amount > 0." });

    const ts = yyyymmddToLocalMidnightTs(date);

    try {
      await addEntry({
        type,
        bucket: effectiveBucket,
        category: category.trim() ? category.trim() : undefined,
        tags: tags.length ? tags : undefined,
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

      setAmount("");
      setCategory("");
      setNote("");
      setMethodOrAccount("");
      setTags([]);

      setStatus({ kind: "ok", msg: "Saved." });
      setTimeout(() => setStatus({ kind: "idle" }), 1200);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to save." });
    }
  }

  return (
    <div>
      <div className="mb-4">
        <div className="text-2xl font-semibold tracking-tight">Log</div>
        <div className="mt-1 text-sm text-neutral-400">Capture now. Refine later.</div>
      </div>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 mb-3">Sign in to start logging.</div>
          <SignInButton mode="modal">
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-900">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("expense")}
            className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
              type === "expense" ? "bg-white text-neutral-900 border-white" : "bg-neutral-900/30 border-neutral-800 text-neutral-200"
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => setType("income")}
            className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
              type === "income" ? "bg-white text-neutral-900 border-white" : "bg-neutral-900/30 border-neutral-800 text-neutral-200"
            }`}
          >
            Income
          </button>
        </div>

        <label className="block text-xs text-neutral-400 mb-1">Amount</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="$0.00"
          className="mb-4 w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-lg outline-none focus:border-neutral-500"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">When</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Bucket / Purpose</label>
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

        <div className="mb-3">
          <div className="text-xs text-neutral-400 mb-2">Tags (optional)</div>
          <TagChips value={tags} onChange={setTags} options={DEFAULT_TAGS as unknown as string[]} />
        </div>

        <label className="block text-xs text-neutral-400 mb-1">
          {type === "expense" ? "Payment method (optional)" : "Account received on (optional)"}
        </label>
        <input
          value={methodOrAccount}
          onChange={(e) => setMethodOrAccount(e.target.value)}
          placeholder={type === "expense" ? "e.g., Debit, Discover, Checking" : "e.g., Checking, Cash"}
          className="mb-4 w-full rounded-2xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm outline-none focus:border-neutral-500"
        />

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
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:opacity-95 active:opacity-90"
        >
          Save
        </button>

        <div className="mt-3 min-h-[1.25rem] text-sm">
          {status.kind === "ok" ? <span className="text-emerald-400">{status.msg}</span> : null}
          {status.kind === "err" ? <span className="text-rose-400">{status.msg}</span> : null}
        </div>

        <div className="mt-6 text-xs text-neutral-500">
          If you skip Category, it goes to Inbox so you can finish later.
        </div>
      </SignedIn>
    </div>
  );
}
