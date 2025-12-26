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
  INCOME_SPACES,
  EXPENSE_SPACES,
  CONTEXT_TAGS,
} from "@/components/utils";
import RecurringModal from "@/components/RecurringModal";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Combobox from "@/components/ui/Combobox";

export default function LogPage() {
  const { user } = useUser();

  const [type, setType] = useState<EntryType>("expense");
  const [amount, setAmount] = useState("");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayYYYYMMDD());

  const [bucket, setBucket] = useState<string>(DEFAULT_BUCKETS[0]);
  const [customBucket, setCustomBucket] = useState("");
  const [note, setNote] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [touched, setTouched] = useState({ amount: false, date: false, bucket: false });

  // Collapsible optional sections - initialize based on existing data
  const [showTags, setShowTags] = useState(false);
  const [showPayMode, setShowPayMode] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Refs for focus management
  const payModeInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [status, setStatus] = useState<
    { kind: "idle" } |
    { kind: "ok"; msg: string; undoId?: string } |
    { kind: "err"; msg: string }
  >({ kind: "idle" });

  const lastSavedRef = useRef<{
    type: EntryType;
    bucket: string;
    category?: string;
    note?: string;
    methodOrAccount?: string;
    amount: string;
    tags?: string[];
  } | null>(null);

  const addEntry = useMutation(api.entries.addEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  const serverBuckets = useQuery(api.entries.listBuckets, { type });
  const effectiveBuckets = useMemo(() => {
    const merged = uniqCaseInsensitive([...(DEFAULT_BUCKETS as unknown as string[]), ...((serverBuckets as string[]) ?? [])]);
    const withoutOther = merged.filter((b) => b.toLowerCase() !== "other");
    return [...withoutOther, "Other"];
  }, [serverBuckets]);

  const effectiveBucket = bucket === "Other" ? (customBucket.trim() || "Other") : bucket;

  // validation touched state controls required-field UI

  async function onSave() {
    setStatus({ kind: "idle" });

    const cents = amountCents ?? dollarsToCents(amount);
    if (!cents || cents <= 0) return setStatus({ kind: "err", msg: "Enter a valid amount > 0." });

    const ts = yyyymmddToLocalMidnightTs(date);

    // mark touched for UI (tags no longer required)
    setTouched({ amount: true, date: true, bucket: true });

    if (!effectiveBucket) return setStatus({ kind: "err", msg: "Please fill required fields." });

    try {
      const res = await addEntry({
        type,
        category: effectiveBucket,
        note: note.trim() ? note.trim() : undefined,
        methodOrAccount: methodOrAccount.trim() ? methodOrAccount.trim() : undefined,
        amountCents: cents,
        date: ts,
        tags: tags.length > 0 ? tags : undefined,
      });

      lastSavedRef.current = {
        type,
        bucket: effectiveBucket,
        note: note.trim() ? note.trim() : undefined,
        methodOrAccount: methodOrAccount.trim() ? methodOrAccount.trim() : undefined,
        amount,
        tags: tags.length > 0 ? tags : undefined,
      };
      // reset amountCents
      setAmountCents(null);

      setAmount("");
      setNote("");
      setMethodOrAccount("");
      setTags([]);

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

  

  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div className="space-y-4 pb-4">
      {/* Header Card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-h1" style={{ color: "var(--text)" }}>Log entry</h1>
        <p className="text-meta mt-1">Just the basics — review anytime.</p>
      </div>

      <SignedOut>
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to start logging
          </div>
          <SignInButton mode="modal">
            <button
              className="rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Type Toggle */}
        <div
          className="grid grid-cols-2 gap-1 rounded-xl p-1"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setType("expense")}
            className="rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: type === "expense" ? "var(--accent)" : "transparent",
              color: type === "expense" ? "var(--accent-foreground)" : "var(--text-secondary)",
            }}
          >
            Spent
          </button>
          <button
            onClick={() => setType("income")}
            className="rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: type === "income" ? "var(--success)" : "transparent",
              color: type === "income" ? "#fff" : "var(--text-secondary)",
            }}
          >
            Received
          </button>
        </div>

        {/* Amount Input */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--surface)", border: touched.amount && (!amountCents && !amount) ? "1px solid var(--danger)" : "1px solid var(--border)" }}
        >
          <label className="text-micro mb-2 block">Amount</label>
          <CurrencyInput
            id="amount"
            ariaLabel="Amount"
            valueCents={amountCents ?? undefined}
            onChange={(c) => {
              setAmountCents(c);
              setAmount(c ? (c / 100).toFixed(2) : "");
            }}
            invalid={touched.amount && (!amountCents && !amount)}
            onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
          />
        </div>

        {/* Date + Space Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface)", border: touched.date && !date ? "1px solid var(--danger)" : "1px solid var(--border)" }}>
            <label className="text-micro mb-2 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, date: true }))}
              className="w-full rounded-lg px-3 py-2.5 text-body outline-none"
              style={{
                backgroundColor: "var(--surface-subtle)",
                color: "var(--text)",
                border: "none",
              }}
            />
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface)", border: touched.bucket && !effectiveBucket ? "1px solid var(--danger)" : "1px solid var(--border)" }}>
            <label className="text-micro mb-2 block">{type === "income" ? "Source" : "Space"}</label>
              <Combobox
                value={bucket}
                onChange={(v) => setBucket(v)}
                options={useMemo(() => {
                  const base = type === "income" ? INCOME_SPACES : EXPENSE_SPACES;
                  const merged = uniqCaseInsensitive([...base]);
                  if (!merged.includes("Other")) merged.push("Other");
                  return merged;
                }, [type])}
                placeholder="Choose category..."
                onBlur={() => setTouched((t) => ({ ...t, bucket: true }))}
              />
          </div>
        </div>

        {bucket === "Other" && (
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <label className="text-micro mb-2 block">Custom space</label>
            <input
              value={customBucket}
              onChange={(e) => setCustomBucket(e.target.value)}
              placeholder="e.g., Baby, School, Rental"
              className="w-full rounded-lg px-3 py-2.5 text-body outline-none"
              style={{
                backgroundColor: "var(--surface-subtle)",
                color: "var(--text)",
                border: "none",
              }}
            />
          </div>
        )}

        {/* Optional Fields - Action Chips Row */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 flex-nowrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {/* Context Tag Chip */}
            <button
              type="button"
              onClick={() => {
                setShowTags(!showTags);
              }}
              aria-expanded={showTags}
              aria-controls="context-tags-section"
              className="inline-flex items-center justify-center gap-2 rounded-2xl text-body font-medium transition-colors"
              style={{
                minHeight: 44,
                paddingLeft: 16,
                paddingRight: 16,
                whiteSpace: "nowrap",
                flex: "1 1 0%",
                minWidth: 0,
                textAlign: "center",
                backgroundColor: showTags || tags.length > 0 ? "var(--accent-subtle)" : "transparent",
                color: showTags || tags.length > 0 ? "var(--accent)" : "var(--text)",
                border: showTags || tags.length > 0 ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              {showTags ? (
                <>Tags{tags.length > 0 && ` (${tags.length})`}</>
              ) : tags.length > 0 ? (
                <>Tags ({tags.length})</>
              ) : (
                <>
                  <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>+</span>
                  Add Tag
                </>
              )}
            </button>

            {/* Pay Mode Chip */}
            <button
              type="button"
              onClick={() => {
                const willShow = !showPayMode;
                setShowPayMode(willShow);
                if (willShow) {
                  setTimeout(() => payModeInputRef.current?.focus(), 50);
                }
              }}
              aria-expanded={showPayMode}
              aria-controls="pay-mode-section"
              className="inline-flex items-center justify-center gap-2 rounded-2xl text-body font-medium transition-colors"
              style={{
                minHeight: 44,
                paddingLeft: 16,
                paddingRight: 16,
                whiteSpace: "nowrap",
                flex: "1 1 0%",
                minWidth: 0,
                textAlign: "center",
                backgroundColor: showPayMode || methodOrAccount.trim() ? "var(--accent-subtle)" : "transparent",
                color: showPayMode || methodOrAccount.trim() ? "var(--accent)" : "var(--text)",
                border: showPayMode || methodOrAccount.trim() ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              {showPayMode ? (
                <>{type === "expense" ? "Method" : "Account"}{methodOrAccount.trim() && `: ${methodOrAccount.trim()}`}</>
              ) : methodOrAccount.trim() ? (
                <>{type === "expense" ? "Method" : "Account"}: {methodOrAccount.trim()}</>
              ) : (
                <>
                  <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>+</span>
                  Add {type === "expense" ? "Method" : "Account"}
                </>
              )}
            </button>

            {/* Note Chip */}
            <button
              type="button"
              onClick={() => {
                const willShow = !showNote;
                setShowNote(willShow);
                if (willShow) {
                  setTimeout(() => noteInputRef.current?.focus(), 50);
                }
              }}
              aria-expanded={showNote}
              aria-controls="note-section"
              className="inline-flex items-center justify-center gap-2 rounded-2xl text-body font-medium transition-colors"
              style={{
                minHeight: 44,
                paddingLeft: 16,
                paddingRight: 16,
                whiteSpace: "nowrap",
                flex: "1 1 0%",
                minWidth: 0,
                textAlign: "center",
                backgroundColor: showNote || note.trim() ? "var(--accent-subtle)" : "transparent",
                color: showNote || note.trim() ? "var(--accent)" : "var(--text)",
                border: showNote || note.trim() ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              {showNote ? (
                <>Note{note.trim() && " ✓"}</>
              ) : note.trim() ? (
                <>Note ✓</>
              ) : (
                <>
                  <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 500 }}>+</span>
                  Add Note
                </>
              )}
            </button>
          </div>

          {/* Context Tags Section (Expandable) */}
          {showTags && (
            <div id="context-tags-section" className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-micro">Context Tags</label>
                <div className="flex gap-2">
                  {tags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTags([]);
                        setShowTags(false);
                      }}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: "var(--danger)" }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTags(false)}
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Hide
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {CONTEXT_TAGS.map((tag) => {
                  const isSelected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setTags((prev) =>
                          isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                        );
                      }}
                      className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--accent)" : "transparent",
                        color: isSelected ? "var(--accent-foreground)" : "var(--text-secondary)",
                        border: isSelected ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pay Mode Section (Expandable) */}
          {showPayMode && (
            <div id="pay-mode-section" className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-micro">{type === "expense" ? "Method" : "Account"}</label>
                <div className="flex gap-2">
                  {methodOrAccount.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setMethodOrAccount("");
                        setShowPayMode(false);
                      }}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: "var(--danger)" }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPayMode(false)}
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Hide
                  </button>
                </div>
              </div>
              <input
                ref={payModeInputRef}
                value={methodOrAccount}
                onChange={(e) => setMethodOrAccount(e.target.value)}
                placeholder={type === "expense" ? "e.g., Debit, Discover" : "e.g., Checking, Cash"}
                className="w-full rounded-lg px-3 py-2.5 text-body outline-none"
                style={{
                  backgroundColor: "var(--surface-subtle)",
                  color: "var(--text)",
                  border: "none",
                }}
              />
            </div>
          )}

          {/* Note Section (Expandable) */}
          {showNote && (
            <div id="note-section" className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-micro">Note</label>
                <div className="flex gap-2">
                  {note.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setNote("");
                        setShowNote(false);
                      }}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ color: "var(--danger)" }}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNote(false)}
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Hide
                  </button>
                </div>
              </div>
              <textarea
                ref={noteInputRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Quick context..."
                className="w-full resize-none rounded-lg px-3 py-2.5 text-body outline-none"
                style={{
                  backgroundColor: "var(--surface-subtle)",
                  color: "var(--text)",
                  border: "none",
                }}
              />
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={onSave}
          className="w-full rounded-xl px-4 py-3.5 text-body font-semibold transition-colors hover:opacity-95 active:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
        >
          Save entry
        </button>

        {/* Status + Actions */}
        {(status.kind === "ok" || status.kind === "err") && (
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              backgroundColor: status.kind === "ok" ? "var(--success-subtle)" : "var(--danger-subtle)",
              border: `1px solid ${status.kind === "ok" ? "var(--success)" : "var(--danger)"}`,
            }}
          >
            <span
              className="text-body font-medium"
              style={{ color: status.kind === "ok" ? "var(--success)" : "var(--danger)" }}
            >
              {status.msg}
            </span>
            {status.kind === "ok" && status.undoId && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={onUndo}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ border: "1px solid var(--success)", color: "var(--success)" }}
                >
                  Undo
                </button>
                <button
                  onClick={() => {
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
                  className="rounded-lg px-3 py-1.5 text-sm font-medium"
                  style={{ backgroundColor: "var(--success)", color: "#fff" }}
                >
                  Save as pattern
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        <p className="text-meta text-center">
          Skip category? It goes to Review for later.
        </p>

        {selected && <RecurringModal entry={selected} onClose={() => setSelected(null)} />}
      </SignedIn>
    </div>
  );
}
