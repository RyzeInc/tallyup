"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  EntryType,
  dollarsToCents,
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
import PageHeader from "@/components/ui/PageHeader";
import * as Lucide from "lucide-react";

/**
 * Log Tab - Welcoming for beginners, fast for power users
 * 
 * Structure:
 * 1. Amount input as the star (top, always visible)
 * 2. Type toggle as real segmented control
 * 3. Core fields only (amount, date, category)
 * 4. Progressive disclosure chips for optional fields
 * 5. Premium save interaction with undo snackbar
 */

export default function LogPage() {
  const { user } = useUser();

  // State declarations first
  const [type, setType] = useState<EntryType>(() => {
    // Initialize from sessionStorage if available
    if (typeof window !== "undefined") {
      const preselectedType = sessionStorage.getItem("tallyup.logType");
      if (preselectedType === "expense" || preselectedType === "income") {
        sessionStorage.removeItem("tallyup.logType");
        return preselectedType;
      }
    }
    return "expense";
  });
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [date, setDate] = useState(todayYYYYMMDD());

  const [category, setCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [note, setNote] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Progressive disclosure state
  const [showTags, setShowTags] = useState(false);
  const [showPayMode, setShowPayMode] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Refs for focus management
  const payModeInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [status, setStatus] = useState<
    { kind: "idle" } |
    { kind: "saving" } |
    { kind: "ok"; msg: string; undoId?: string } |
    { kind: "err"; msg: string }
  >({ kind: "idle" });

  const lastSavedRef = useRef<{
    type: EntryType;
    category: string;
    note?: string;
    methodOrAccount?: string;
    amountCents: number;
    tags?: string[];
  } | null>(null);

  const addEntry = useMutation(api.entries.addEntry);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  const serverBuckets = useQuery(api.entries.listBuckets, { type });
  
  const categoryOptions = useMemo(() => {
    const base = type === "income" ? INCOME_SPACES : EXPENSE_SPACES;
    const merged = uniqCaseInsensitive([...base, ...((serverBuckets as string[]) ?? [])]);
    if (!merged.includes("Other")) merged.push("Other");
    return merged;
  }, [type, serverBuckets]);

  const effectiveCategory = category === "Other" ? (customCategory.trim() || "Other") : category;

  // Form validation
  const isValidAmount = amountCents !== null && amountCents > 0;
  const canSave = isValidAmount;

  async function onSave() {
    if (!canSave) return;
    
    setStatus({ kind: "saving" });

    const ts = yyyymmddToLocalMidnightTs(date);

    try {
      const res = await addEntry({
        type,
        category: effectiveCategory || undefined,
        note: note.trim() || undefined,
        methodOrAccount: methodOrAccount.trim() || undefined,
        amountCents: amountCents!,
        date: ts,
        tags: tags.length > 0 ? tags : undefined,
      });

      lastSavedRef.current = {
        type,
        category: effectiveCategory,
        note: note.trim() || undefined,
        methodOrAccount: methodOrAccount.trim() || undefined,
        amountCents: amountCents!,
        tags: tags.length > 0 ? tags : undefined,
      };

      // Reset form - keep date and type (user preference), clear amount and optional fields
      setAmountCents(null);
      setNote("");
      setMethodOrAccount("");
      setTags([]);
      setShowTags(false);
      setShowPayMode(false);
      setShowNote(false);

      const undoId = (res as any)?.id as string | undefined;
      
      // Determine message based on whether category was provided
      const message = effectiveCategory 
        ? "Saved" 
        : "Saved to Review (no category)";
      
      setStatus({ kind: "ok", msg: message, undoId });
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setStatus((s) => s.kind === "ok" ? { kind: "idle" } : s);
      }, 5000);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to save" });
    }
  }

  async function onUndo() {
    if (status.kind !== "ok" || !status.undoId) return;
    try {
      await deleteEntry({ id: status.undoId as any });
      setStatus({ kind: "ok", msg: "Undone" });
      setTimeout(() => setStatus({ kind: "idle" }), 1500);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to undo" });
    }
  }

  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        title="Log"
        subtitle="Just the basics — review anytime"
        compact
      />

      <SignedOut>
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--card-radius)",
            border: "1px solid var(--border)",
            padding: "var(--space-6)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
            Sign in to start logging
          </p>
          <SignInButton mode="modal">
            <button className="btn-primary">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Type Toggle - Segmented Control */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--input-radius)",
            border: "1px solid var(--border)",
            padding: "4px",
          }}
        >
          <button
            onClick={() => setType("expense")}
            style={{
              borderRadius: "calc(var(--input-radius) - 4px)",
              padding: "var(--space-3)",
              fontWeight: 600,
              fontSize: "var(--text-body)",
              border: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
              backgroundColor: type === "expense" ? "var(--primary)" : "transparent",
              color: type === "expense" ? "var(--primary-foreground)" : "var(--text-secondary)",
            }}
          >
            Spent
          </button>
          <button
            onClick={() => setType("income")}
            style={{
              borderRadius: "calc(var(--input-radius) - 4px)",
              padding: "var(--space-3)",
              fontWeight: 600,
              fontSize: "var(--text-body)",
              border: "none",
              cursor: "pointer",
              transition: "all 150ms ease",
              backgroundColor: type === "income" ? "var(--success)" : "transparent",
              color: type === "income" ? "#fff" : "var(--text-secondary)",
            }}
          >
            Received
          </button>
        </div>

        {/* Amount Input - The Star */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--card-radius)",
            border: "1px solid var(--border)",
            padding: "var(--card-padding)",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "var(--text-micro)",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "var(--space-2)",
            }}
          >
            Amount
          </label>
          <CurrencyInput
            id="amount"
            ariaLabel="Amount"
            valueCents={amountCents ?? undefined}
            onChange={(c) => setAmountCents(c)}
            invalid={false}
            autoFocus
          />
        </div>

        {/* Core Fields - Date + Category */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          {/* Date */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border)",
              padding: "var(--space-4)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "var(--text-micro)",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "var(--space-2)",
              }}
            >
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "var(--surface-2)",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                fontSize: "var(--text-body)",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          {/* Category */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border)",
              padding: "var(--space-4)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "var(--text-micro)",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "var(--space-2)",
              }}
            >
              {type === "income" ? "Source" : "Category"}
            </label>
            <Combobox
              value={category}
              onChange={(v) => setCategory(v)}
              options={categoryOptions}
              placeholder="Optional..."
            />
          </div>
        </div>

        {/* Custom Category (when "Other" selected) */}
        {category === "Other" && (
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "var(--card-radius)",
              border: "1px solid var(--border)",
              padding: "var(--space-4)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "var(--text-micro)",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "var(--space-2)",
              }}
            >
              Custom {type === "income" ? "source" : "category"}
            </label>
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g., Baby, School, Rental"
              style={{
                width: "100%",
                backgroundColor: "var(--surface-2)",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                fontSize: "var(--text-body)",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Progressive Disclosure Chips */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--card-radius)",
            border: "1px solid var(--border)",
            padding: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
            {/* Add Tags Chip */}
            <button
              type="button"
              onClick={() => setShowTags(!showTags)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-meta)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 150ms ease",
                backgroundColor: showTags || tags.length > 0 ? "var(--accent-subtle)" : "transparent",
                color: showTags || tags.length > 0 ? "var(--primary)" : "var(--text-secondary)",
                border: showTags || tags.length > 0 ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {tags.length > 0 ? (
                <>Tags ({tags.length})</>
              ) : (
                <>
                  <Lucide.Plus className="h-3.5 w-3.5" />
                  Add tags
                </>
              )}
            </button>

            {/* Add Method/Account Chip */}
            <button
              type="button"
              onClick={() => {
                const willShow = !showPayMode;
                setShowPayMode(willShow);
                if (willShow) setTimeout(() => payModeInputRef.current?.focus(), 50);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-meta)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 150ms ease",
                backgroundColor: showPayMode || methodOrAccount.trim() ? "var(--accent-subtle)" : "transparent",
                color: showPayMode || methodOrAccount.trim() ? "var(--primary)" : "var(--text-secondary)",
                border: showPayMode || methodOrAccount.trim() ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {methodOrAccount.trim() ? (
                <>{type === "expense" ? "Method" : "Account"} ✓</>
              ) : (
                <>
                  <Lucide.Plus className="h-3.5 w-3.5" />
                  {type === "expense" ? "Method" : "Account"}
                </>
              )}
            </button>

            {/* Add Note Chip */}
            <button
              type="button"
              onClick={() => {
                const willShow = !showNote;
                setShowNote(willShow);
                if (willShow) setTimeout(() => noteInputRef.current?.focus(), 50);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "8px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-meta)",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 150ms ease",
                backgroundColor: showNote || note.trim() ? "var(--accent-subtle)" : "transparent",
                color: showNote || note.trim() ? "var(--primary)" : "var(--text-secondary)",
                border: showNote || note.trim() ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {note.trim() ? (
                <>Note ✓</>
              ) : (
                <>
                  <Lucide.Plus className="h-3.5 w-3.5" />
                  Add note
                </>
              )}
            </button>
          </div>

          {/* Expanded Tags Section */}
          {showTags && (
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--text-micro)", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Context Tags
                </span>
                <button
                  type="button"
                  onClick={() => setShowTags(false)}
                  style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {CONTEXT_TAGS.map((tag) => {
                  const isSelected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((prev) => isSelected ? prev.filter((t) => t !== tag) : [...prev, tag])}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--text-meta)",
                        fontWeight: 500,
                        cursor: "pointer",
                        backgroundColor: isSelected ? "var(--primary)" : "transparent",
                        color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
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

          {/* Expanded Pay Mode Section */}
          {showPayMode && (
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--text-micro)", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {type === "expense" ? "Payment Method" : "Account"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPayMode(false)}
                  style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
              <input
                ref={payModeInputRef}
                value={methodOrAccount}
                onChange={(e) => setMethodOrAccount(e.target.value)}
                placeholder={type === "expense" ? "e.g., Debit, Discover" : "e.g., Checking, Cash"}
                style={{
                  width: "100%",
                  backgroundColor: "var(--surface-2)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Expanded Note Section */}
          {showNote && (
            <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--text-micro)", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Note
                </span>
                <button
                  type="button"
                  onClick={() => setShowNote(false)}
                  style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
              <textarea
                ref={noteInputRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Quick context..."
                style={{
                  width: "100%",
                  resize: "none",
                  backgroundColor: "var(--surface-2)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={!canSave || status.kind === "saving"}
          style={{
            width: "100%",
            backgroundColor: canSave ? "var(--primary)" : "var(--surface-2)",
            color: canSave ? "var(--primary-foreground)" : "var(--text-tertiary)",
            border: canSave ? "none" : "1px solid var(--border)",
            borderRadius: "var(--input-radius)",
            padding: "var(--space-4)",
            minHeight: "var(--button-height)",
            fontWeight: 600,
            fontSize: "var(--text-body)",
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: status.kind === "saving" ? 0.7 : 1,
            transition: "all 150ms ease",
          }}
        >
          {status.kind === "saving" ? "Saving..." : "Save entry"}
        </button>

        {/* Undo Snackbar */}
        {status.kind === "ok" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              backgroundColor: "var(--success-subtle)",
              border: "1px solid var(--success)",
              borderRadius: "var(--input-radius)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            <Lucide.CheckCircle className="h-5 w-5 shrink-0" style={{ color: "var(--success)" }} />
            <span style={{ flex: 1, fontWeight: 500, color: "var(--success)" }}>
              {status.msg}
            </span>
            {status.undoId && (
              <button
                onClick={onUndo}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-meta)",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "var(--success)",
                  border: "1px solid var(--success)",
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {status.kind === "err" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              backgroundColor: "var(--danger-subtle)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--input-radius)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            <Lucide.AlertCircle className="h-5 w-5 shrink-0" style={{ color: "var(--danger)" }} />
            <span style={{ flex: 1, fontWeight: 500, color: "var(--danger)" }}>
              {status.msg}
            </span>
          </div>
        )}

        {/* Hint */}
        <p style={{ fontSize: "var(--text-meta)", color: "var(--text-tertiary)", textAlign: "center" }}>
          Skip category? It goes to Review for later.
        </p>

        {selected && <RecurringModal entry={selected} onClose={() => setSelected(null)} />}
      </SignedIn>
    </div>
  );
}
