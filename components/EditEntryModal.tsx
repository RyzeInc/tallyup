"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import * as Lucide from "lucide-react";
import {
  centsToDollars,
  dollarsToCents,
  INCOME_SPACES,
  EXPENSE_SPACES,
  CONTEXT_TAGS,
} from "@/components/utils";

type ContextTag = (typeof CONTEXT_TAGS)[number];

interface Entry {
  _id: string;
  type: "expense" | "income";
  amountCents: number;
  date: number;
  category?: string;
  bucket?: string;
  note?: string;
  merchant?: string;
  tags?: string[];
  methodOrAccount?: string;
  needsReview?: boolean;
}

interface EditEntryModalProps {
  entry: Entry;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export default function EditEntryModal({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: EditEntryModalProps) {
  const updateEntry = useMutation(api.entries.updateEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Form state
  const [type, setType] = useState<"expense" | "income">(entry.type);
  const [amountStr, setAmountStr] = useState(() =>
    (Math.abs(entry.amountCents) / 100).toFixed(2)
  );
  const [date, setDate] = useState(() => {
    const d = new Date(entry.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [category, setCategory] = useState(entry.category ?? entry.bucket ?? "");
  const [note, setNote] = useState(entry.note ?? "");
  const [methodOrAccount, setMethodOrAccount] = useState(entry.methodOrAccount ?? "");
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [needsReview, setNeedsReview] = useState(entry.needsReview ?? false);

  // Expandable sections for Note and Method
  const [showNote, setShowNote] = useState(!!entry.note);
  const [showMethod, setShowMethod] = useState(!!entry.methodOrAccount);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category options based on type
  const categoryOptions = useMemo(() => {
    return type === "income" ? [...INCOME_SPACES] : [...EXPENSE_SPACES];
  }, [type]);

  // Handle escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setError(null);
    setSaving(true);

    try {
      const amountCents = dollarsToCents(amountStr);
      if (!amountCents || amountCents <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      const [y, m, d] = date.split("-").map(Number);
      const dateTs = new Date(y, m - 1, d).getTime();

      await updateEntry({
        id: entry._id as Id<"entries">,
        category: category || undefined,
        amountCents,
        date: dateTs,
        note: note.trim() || undefined,
        methodOrAccount: methodOrAccount.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        needsReview,
      });

      onSaved?.();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await deleteEntry({ id: entry._id as Id<"entries"> });
      onDeleted?.();
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - bottom sheet on mobile, centered dialog on desktop */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit transaction"
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150"
      >
        <div
          className="rounded-t-2xl sm:rounded-2xl border-t sm:border shadow-lg flex flex-col"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            maxHeight: "calc(100dvh - 80px)", // Leave room for nav bar
          }}
        >
          {/* Handle (mobile only) */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div
              className="h-1 w-10 rounded-full"
              style={{ backgroundColor: "var(--border)" }}
            />
          </div>

          {/* Header - sticky */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              Edit Transaction
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
            {/* Error message */}
            {error && (
              <div
                className="mb-4 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
              >
                {error}
              </div>
            )}

            {/* Type toggle */}
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

            {/* Amount & Date row */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Amount
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 pl-7 text-base font-semibold tabular-nums"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--input)",
                      color: "var(--text)",
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--input)",
                    color: "var(--text)",
                  }}
                />
              </div>
            </div>

            {/* Category */}
            <div className="mb-4">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--input)",
                  color: "var(--text)",
                }}
              >
                <option value="">Select category...</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label
                className="block text-xs font-medium mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_TAGS.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "hover:bg-[var(--surface-subtle)]"
                      }`}
                      style={{
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        color: selected ? undefined : "var(--text)",
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional fields as expandable chips */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {/* Note chip/field */}
                {!showNote ? (
                  <button
                    type="button"
                    onClick={() => setShowNote(true)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-subtle)]"
                    style={{
                      border: "1px dashed var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Lucide.Plus className="h-3 w-3" />
                    Add Note
                  </button>
                ) : null}

                {/* Method chip/field */}
                {!showMethod ? (
                  <button
                    type="button"
                    onClick={() => setShowMethod(true)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-subtle)]"
                    style={{
                      border: "1px dashed var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Lucide.Plus className="h-3 w-3" />
                    Add Method
                  </button>
                ) : null}
              </div>

              {/* Expanded Note field */}
              {showNote && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className="text-xs font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Note
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setNote("");
                        setShowNote(false);
                      }}
                      className="text-xs hover:underline"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional description..."
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--input)",
                      color: "var(--text)",
                    }}
                    autoFocus
                  />
                </div>
              )}

              {/* Expanded Method field */}
              {showMethod && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className="text-xs font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Payment Method
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMethodOrAccount("");
                        setShowMethod(false);
                      }}
                      className="text-xs hover:underline"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={methodOrAccount}
                    onChange={(e) => setMethodOrAccount(e.target.value)}
                    placeholder="e.g., Chase Visa, Cash..."
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "var(--input)",
                      color: "var(--text)",
                    }}
                    autoFocus={!showNote}
                  />
                </div>
              )}
            </div>

            {/* Needs Review toggle */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsReview}
                  onChange={(e) => setNeedsReview(e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Flag for review
                </span>
              </label>
            </div>
          </div>

          {/* Actions - sticky footer */}
          <div
            className="flex items-center gap-3 px-5 py-4 border-t"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
          >
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                border: "1px solid var(--danger)",
                color: "var(--danger)",
                backgroundColor: "transparent",
              }}
            >
              {deleting ? "..." : "Delete"}
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-subtle)]"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
