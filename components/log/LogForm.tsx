"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  todayYYYYMMDD,
  uniqCaseInsensitive,
  yyyymmddToLocalMidnightTs,
  INCOME_SPACES,
  EXPENSE_SPACES,
  centsToDollars,
} from "@/components/utils";
import { CONTEXT_TAGS, INTENT_TAGS } from "@/lib/constants";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Combobox from "@/components/ui/Combobox";
import { useQuickLog } from "./QuickLogProvider";
import * as Lucide from "lucide-react";

/**
 * LogForm - Redesigned with confidence and clear hierarchy
 * 
 * Visual Hierarchy:
 * 1. Type toggle (Spent/Received/Transfer) - Prominent
 * 2. Amount (dominant, star of the show)
 * 3. Account/Method (visible, required-feeling)
 * 4. Date
 * 5. Category (with suggestions)
 * 6. Context Tags (composable)
 * 7. Intent Tags (composable)
 * 8. Note (optional)
 * 9. Meaning Preview
 * 10. Save button
 */

export type TransactionType = "expense" | "income" | "transfer";

// Context tag icons for visual consistency
const CONTEXT_TAG_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "Personal": Lucide.User,
  "Shared": Lucide.Users,
  "Household": Lucide.Home,
  "Partner": Lucide.Heart,
  "Dependent": Lucide.Baby,
  "Business": Lucide.Briefcase,
  "Client": Lucide.Building,
  "Reimbursable": Lucide.Receipt,
  "Tax-Deductible": Lucide.FileText,
};

// Intent tag icons
const INTENT_TAG_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "Essential": Lucide.ShieldCheck,
  "Discretionary": Lucide.Sparkles,
  "Planned": Lucide.Calendar,
  "Unexpected": Lucide.Zap,
  "One-time": Lucide.CircleDot,
  "Recurring": Lucide.Repeat,
  "Unknown": Lucide.HelpCircle,
};

// Confidence levels for suggestions
type Confidence = "high" | "medium" | "low";

interface CategorySuggestion {
  category: string;
  reason: string;
  confidence: Confidence;
}

export default function LogForm({ onDone }: { onDone?: (res: { id?: string }) => void }) {
  const router = useRouter();
  const quickLog = useQuickLog();

  // Core state
  const [type, setType] = useState<TransactionType>(() => {
    if (typeof window !== "undefined") {
      const preselectedType = sessionStorage.getItem("tallyup.logType");
      if (preselectedType === "expense" || preselectedType === "income" || preselectedType === "transfer") {
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
  const [merchant, setMerchant] = useState("");
  const [methodOrAccount, setMethodOrAccount] = useState("");
  const [accountId, setAccountId] = useState<Id<"accounts"> | "">("");

  // Gig worker fields
  const [hoursWorked, setHoursWorked] = useState("");
  const [platformType, setPlatformType] = useState("");

  // Goal and Budget linking
  const [linkedGoalId, setLinkedGoalId] = useState("");
  const [linkedBudgetId, setLinkedBudgetId] = useState("");

  // Transfer-specific state
  const [fromAccount, setFromAccount] = useState<Id<"accounts"> | "">("");
  const [toAccount, setToAccount] = useState<Id<"accounts"> | "">("");

  // Tags - split into context and intent
  const [contextTags, setContextTags] = useState<string[]>([]);
  const [intentTags, setIntentTags] = useState<string[]>([]);

  // Progressive disclosure state
  const [showNote, setShowNote] = useState(false);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [showIntentPicker, setShowIntentPicker] = useState(false);

  // Refs for focus management
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [status, setStatus] = useState<
    { kind: "idle" } |
    { kind: "saving" } |
    { kind: "ok"; msg: string; undoId?: string } |
    { kind: "err"; msg: string }
  >({ kind: "idle" });

  const addEntry = useMutation(api.entries.addEntry);
  const createTransfer = useMutation(api.transfers.createTransfer);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  // Fetch accounts for dropdowns
  const accounts = useQuery(api.accounts.listAccounts, { includeArchived: false }) as any[] | undefined;

  // Fetch goals and budget categories for linking
  const goals = useQuery(api.goals.listGoals, {}) as any[] | undefined;
  const budgets = useQuery(api.budgets.listBudgetCategories, {}) as any[] | undefined;

  // Fetch recent entries for suggestions
  const recentEntries = useQuery(api.entries.listEntries, { limit: 50 }) as any[] | undefined;

  const serverBuckets = useQuery(api.entries.listBuckets, { type: type === "transfer" ? "expense" : type });

  // Category options
  const categoryOptions = useMemo(() => {
    const base = type === "income" ? INCOME_SPACES : EXPENSE_SPACES;
    const merged = uniqCaseInsensitive([...base, ...((serverBuckets as string[]) ?? [])]);
    if (!merged.includes("Other")) merged.push("Other");
    return merged as string[];
  }, [type, serverBuckets]);

  // Generate category suggestions based on patterns
  const categorySuggestions = useMemo((): CategorySuggestion[] => {
    if (!recentEntries || recentEntries.length === 0 || type === "transfer") return [];
    
    const suggestions: CategorySuggestion[] = [];
    const seenCategories = new Set<string>();

    // Last used category
    const lastEntry = recentEntries.find(e => e.type === type && e.category);
    if (lastEntry?.category && !seenCategories.has(lastEntry.category)) {
      suggestions.push({
        category: lastEntry.category,
        reason: "Last used",
        confidence: "high",
      });
      seenCategories.add(lastEntry.category);
    }

    // Frequent categories (count occurrences)
    const categoryCount = new Map<string, number>();
    for (const entry of recentEntries) {
      if (entry.type === type && entry.category) {
        categoryCount.set(entry.category, (categoryCount.get(entry.category) || 0) + 1);
      }
    }
    const sortedByFrequency = [...categoryCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sortedByFrequency.slice(0, 3)) {
      if (!seenCategories.has(cat) && count > 1) {
        suggestions.push({
          category: cat,
          reason: `Frequent (${count}x)`,
          confidence: count > 3 ? "high" : "medium",
        });
        seenCategories.add(cat);
      }
    }

    // Same amount pattern (if amount is entered)
    if (amountCents) {
      const tolerance = amountCents * 0.1; // 10% tolerance
      const sameAmount = recentEntries.find(e => 
        e.type === type && 
        e.category && 
        !seenCategories.has(e.category) &&
        Math.abs(e.amountCents - amountCents) <= tolerance
      );
      if (sameAmount) {
        suggestions.push({
          category: sameAmount.category,
          reason: "Same amount",
          confidence: "medium",
        });
        seenCategories.add(sameAmount.category);
      }
    }

    return suggestions.slice(0, 5);
  }, [recentEntries, type, amountCents]);

  const effectiveCategory = category === "Other" ? (customCategory.trim() || "Other") : category;

  // Form validation
  const isValidAmount = amountCents !== null && amountCents > 0;
  const canSave = isValidAmount && (type !== "transfer" || (fromAccount && toAccount && fromAccount !== toAccount));

  // Meaning preview text
  const meaningPreview = useMemo(() => {
    if (!amountCents || amountCents <= 0) return null;
    const formatted = centsToDollars(amountCents);
    
    if (type === "expense") {
      return `This will reduce your net by ${formatted}`;
    } else if (type === "income") {
      return `This will increase your net by ${formatted}`;
    } else if (type === "transfer") {
      return "This moves cash between accounts (no net impact)";
    }
    return null;
  }, [type, amountCents]);

  // Load smart defaults on mount
  useEffect(() => {
    setDate(todayYYYYMMDD());
    try {
      const raw = localStorage.getItem("tallyup.lastEntry");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.type && parsed.type !== "transfer") setType(parsed.type);
        if (parsed?.bucket) setCategory(parsed.bucket);
        if (parsed?.methodOrAccount) setMethodOrAccount(parsed.methodOrAccount);
      }
    } catch {}
  }, []);

  const selectorAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((acc) => acc.showInTransactionSelector !== false);
  }, [accounts]);

  const fallbackMethods = ["Cash", "Checking", "Savings", "Credit Card"];

  const getAccountName = (id?: Id<"accounts"> | "") => {
    if (!id) return "Account";
    const match = accounts?.find((acc) => acc._id === id);
    return match?.name ?? "Account";
  };

  async function onSave() {
    if (!canSave) return;

    setStatus({ kind: "saving" });

    const ts = yyyymmddToLocalMidnightTs(date);

    try {
      let undoId: string | undefined;

      if (type === "transfer") {
        // Create transfer
        const res = await createTransfer({
          amountCents: amountCents!,
          date: ts,
          transferType: "internal",
          note: note.trim() || undefined,
          fromAccountId: fromAccount ? (fromAccount as Id<"accounts">) : undefined,
          toAccountId: toAccount ? (toAccount as Id<"accounts">) : undefined,
        });
        undoId = res as unknown as string;
      } else {
        const res = await addEntry({
          type,
          category: effectiveCategory || undefined,
          note: note.trim() || undefined,
          merchant: merchant.trim() || undefined,
          methodOrAccount: methodOrAccount.trim() || undefined,
          accountId: accountId ? (accountId as Id<"accounts">) : undefined,
          amountCents: amountCents!,
          date: ts,
          contextTags,
          intentTags,
          // Gig worker fields
          hoursWorked: hoursWorked ? parseFloat(hoursWorked) : undefined,
          platformType: platformType || undefined,
          // Goal and Budget linking
          goalId: linkedGoalId ? (linkedGoalId as Id<"goals">) : undefined,
          budgetCategoryId: linkedBudgetId ? (linkedBudgetId as Id<"budgetCategories">) : undefined,
        });

        undoId = (res as any)?.id as string | undefined;
      }

      // Persist smart defaults
      try {
        localStorage.setItem(
          "tallyup.lastEntry",
          JSON.stringify({
            type: type === "transfer" ? "expense" : type,
            bucket: effectiveCategory || undefined,
            methodOrAccount: methodOrAccount.trim() || undefined,
          })
        );
      } catch {}

      // Reset form
      setAmountCents(null);
      setNote("");
      setContextTags([]);
      setIntentTags([]);
      setShowNote(false);
      setHoursWorked("");
      setPlatformType("");
      setLinkedGoalId("");
      setLinkedBudgetId("");
      setAccountId("");
      if (type === "transfer") {
        setFromAccount("");
        setToAccount("");
      }

      // Build recap message
      const amountStr = centsToDollars(amountCents!);
      let recap = "";
      
      if (type === "transfer") {
        recap = `Saved: Transfer ${amountStr}`;
        if (fromAccount && toAccount) {
          recap += ` • ${getAccountName(fromAccount)} → ${getAccountName(toAccount)}`;
        }
      } else {
        const typeLabel = type === "expense" ? "Spent" : "Received";
        recap = `Saved: ${typeLabel} ${amountStr}`;
        
        if (effectiveCategory) {
          recap += ` • ${effectiveCategory}`;
        }
        
        if (contextTags.length > 0) {
          recap += ` • ${contextTags[0]}`;
          if (contextTags.length > 1) recap += ` +${contextTags.length - 1}`;
        }
        
        if (!effectiveCategory) {
          recap = `Saved to Review: ${typeLabel} ${amountStr} • Needs category`;
        }
      }

      setStatus({ kind: "ok", msg: recap, undoId });

      // Show recap toast with actions
      if (undoId) {
        quickLog.showRichToast(recap, [
          {
            label: "Edit",
            onClick: () => {
              router.push(`/activity?entry=${undoId}`);
              quickLog.close();
            },
          },
          {
            label: "Add another",
            onClick: () => {
              // Already reset, just stay open
              setStatus({ kind: "idle" });
            },
          },
        ]);
      } else {
        quickLog.showToast(recap);
      }

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setStatus((s) => s.kind === "ok" ? { kind: "idle" } : s);
      }, 5000);

      onDone?.({ id: undoId });
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to save" });
    }
  }

  async function onUndo() {
    if (status.kind !== "ok" || !status.undoId) return;
    try {
      await deleteEntry({ id: status.undoId as any });
      setStatus({ kind: "ok", msg: "Undone", undoId: undefined });
      setTimeout(() => setStatus({ kind: "idle" }), 1500);
    } catch (e: any) {
      setStatus({ kind: "err", msg: e?.message ?? "Failed to undo" });
    }
  }

  // Confidence dot colors
  const confidenceColor = (c: Confidence) => {
    switch (c) {
      case "high": return "var(--success)";
      case "medium": return "var(--warning)";
      case "low": return "var(--text-tertiary)";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Type Toggle - 3-way: Spent | Received | Transfer */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "4px",
          backgroundColor: "var(--surface-2)",
          borderRadius: "var(--input-radius)",
          padding: "4px",
        }}
      >
        <button
          type="button"
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
          type="button"
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
        <button
          type="button"
          onClick={() => setType("transfer")}
          style={{
            borderRadius: "calc(var(--input-radius) - 4px)",
            padding: "var(--space-3)",
            fontWeight: 600,
            fontSize: "var(--text-body)",
            border: "none",
            cursor: "pointer",
            transition: "all 150ms ease",
            backgroundColor: type === "transfer" ? "var(--accent)" : "transparent",
            color: type === "transfer" ? "var(--accent-foreground)" : "var(--text-secondary)",
          }}
        >
          Transfer
        </button>
      </div>

      {/* Amount Input - The Star */}
      <div>
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
        
        {/* Meaning Preview */}
        {meaningPreview && (
          <div
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-meta)",
              color: type === "expense" ? "var(--text-secondary)" : type === "income" ? "var(--success)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            {type === "expense" && <Lucide.TrendingDown className="h-3.5 w-3.5" />}
            {type === "income" && <Lucide.TrendingUp className="h-3.5 w-3.5" />}
            {type === "transfer" && <Lucide.ArrowRightLeft className="h-3.5 w-3.5" />}
            {meaningPreview}
          </div>
        )}
      </div>

      {/* Merchant/Payee - For expense/income */}
      {type !== "transfer" && (
        <div>
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
            Merchant / Payee (optional)
          </label>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g., Amazon, Starbucks, Employer..."
            style={{
              width: "100%",
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--input-radius)",
              padding: "10px 14px",
              fontSize: "var(--text-body)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Account/Method - Always visible */}
      {type !== "transfer" ? (
        <div>
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
            Account / Method
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {selectorAccounts.length > 0
              ? selectorAccounts.slice(0, 4).map((account) => (
                  <button
                    key={account._id}
                    type="button"
                    onClick={() => {
                      if (accountId === account._id) {
                        setAccountId("");
                        setMethodOrAccount("");
                      } else {
                        setAccountId(account._id);
                        setMethodOrAccount(account.name);
                      }
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-meta)",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 150ms ease",
                      backgroundColor: accountId === account._id ? "var(--primary)" : "var(--surface-2)",
                      color: accountId === account._id ? "var(--primary-foreground)" : "var(--text)",
                      border: accountId === account._id ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {account.name}
                  </button>
                ))
              : fallbackMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setAccountId("");
                      setMethodOrAccount(methodOrAccount === method ? "" : method);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "var(--text-meta)",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 150ms ease",
                      backgroundColor: methodOrAccount === method ? "var(--primary)" : "var(--surface-2)",
                      color: methodOrAccount === method ? "var(--primary-foreground)" : "var(--text)",
                      border: methodOrAccount === method ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {method}
                  </button>
                ))}
            {/* Custom input trigger */}
            <input
              value={
                selectorAccounts.length > 0
                  ? accountId ? "" : methodOrAccount
                  : !fallbackMethods.includes(methodOrAccount) ? methodOrAccount : ""
              }
              onChange={(e) => {
                setAccountId("");
                setMethodOrAccount(e.target.value);
              }}
              placeholder="Other..."
              style={{
                flex: 1,
                minWidth: "80px",
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-full)",
                padding: "8px 14px",
                fontSize: "var(--text-meta)",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>
        </div>
      ) : (
        /* Transfer: From Account → To Account */
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "var(--space-2)", alignItems: "end" }}>
          <div>
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
              From Account
            </label>
            <select
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value as Id<"accounts"> | "")}
              style={{
                width: "100%",
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                fontSize: "var(--text-body)",
                color: "var(--text)",
                outline: "none",
              }}
            >
              <option value="">Select...</option>
              {(accounts ?? []).map((account) => (
                <option key={account._id} value={account._id}>{account.name}</option>
              ))}
            </select>
          </div>
          <Lucide.ArrowRight className="h-5 w-5 mb-3" style={{ color: "var(--text-tertiary)" }} />
          <div>
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
              To Account
            </label>
            <select
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value as Id<"accounts"> | "")}
              style={{
                width: "100%",
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                fontSize: "var(--text-body)",
                color: "var(--text)",
                outline: "none",
              }}
            >
              <option value="">Select...</option>
              {(accounts ?? []).filter((acc) => acc._id !== fromAccount).map((account) => (
                <option key={account._id} value={account._id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Gig Worker Fields - Only for income */}
      {type === "income" && (
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--surface-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <Lucide.Clock className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            <span style={{ fontSize: "var(--text-meta)", fontWeight: 500, color: "var(--text-secondary)" }}>
              Gig / Hourly Work (Optional)
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", marginBottom: "var(--space-1)" }}>
                Hours Worked
              </label>
              <input
                type="number"
                step="0.25"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                placeholder="0.0"
                style={{
                  width: "100%",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", marginBottom: "var(--space-1)" }}>
                Platform Type
              </label>
              <select
                value={platformType}
                onChange={(e) => setPlatformType(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="">Select...</option>
                <option value="rideshare">Rideshare</option>
                <option value="delivery">Delivery</option>
                <option value="freelance">Freelance</option>
                <option value="consulting">Consulting</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          {hoursWorked && parseFloat(hoursWorked) > 0 && amountCents && (
            <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}>
              Hourly rate: ${(parseFloat(centsToDollars(amountCents)) / parseFloat(hoursWorked)).toFixed(2)}/hr
            </div>
          )}
        </div>
      )}

      {/* Date + Category Row */}
      {type !== "transfer" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          {/* Date */}
          <div>
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
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                fontSize: "var(--text-body)",
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          {/* Category */}
          <div>
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
              placeholder="Search or pick a suggestion"
            />
          </div>
        </div>
      )}

      {/* Transfer Date */}
      {type === "transfer" && (
        <div>
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
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              fontSize: "var(--text-body)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Custom Category (when "Other" selected) */}
      {type !== "transfer" && category === "Other" && (
        <div>
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
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              fontSize: "var(--text-body)",
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Category Suggestions */}
      {type !== "transfer" && categorySuggestions.length > 0 && !category && (
        <div>
          <div
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "var(--space-2)",
            }}
          >
            Suggested Categories
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {categorySuggestions.map((suggestion, idx) => {
              const IconComponent = type === "income" 
                ? Lucide.ArrowDownLeft 
                : Lucide.Tag;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCategory(suggestion.category)}
                  title={`Why: ${suggestion.reason}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "8px 14px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "var(--text-meta)",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <IconComponent className="h-3.5 w-3.5" style={{ color: "var(--text-secondary)" }} />
                  <span>{suggestion.category}</span>
                  {/* Confidence dot */}
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: confidenceColor(suggestion.confidence),
                    }}
                    title={`Confidence: ${suggestion.confidence}`}
                  />
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-micro)",
              color: "var(--text-tertiary)",
            }}
          >
            If you're unsure, save it for Review.
          </div>
        </div>
      )}

      {/* Context Tags Row */}
      {type !== "transfer" && (
        <div>
          <div
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "var(--space-2)",
            }}
          >
            Context (who/what)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {/* Show selected context tags */}
            {contextTags.map((tag) => {
              const IconComponent = CONTEXT_TAG_ICONS[tag] || Lucide.Tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setContextTags((prev) => prev.filter((t) => t !== tag))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "var(--text-meta)",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                    border: "none",
                  }}
                >
                  <IconComponent className="h-3.5 w-3.5" />
                  {tag}
                  <Lucide.X className="h-3 w-3 ml-1" />
                </button>
              );
            })}
            
            {/* Add context button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowContextPicker(!showContextPicker)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-meta)",
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  border: "1px dashed var(--border)",
                  backgroundColor: "transparent",
                }}
              >
                <Lucide.Plus className="h-3.5 w-3.5" />
                {contextTags.length === 0 ? "Context" : "Add"}
              </button>
              
              {showContextPicker && (
                <>
                  <div 
                    style={{ position: "fixed", inset: 0, zIndex: 5 }}
                    onClick={() => setShowContextPicker(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: "var(--space-2)",
                      zIndex: 10,
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-2)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--space-2)",
                      maxWidth: "280px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {CONTEXT_TAGS.filter(t => !contextTags.includes(t)).map((tag) => {
                      const IconComponent = CONTEXT_TAG_ICONS[tag] || Lucide.Tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setContextTags((prev) => [...prev, tag]);
                            setShowContextPicker(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-1)",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-meta)",
                            cursor: "pointer",
                            backgroundColor: "var(--surface-2)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <IconComponent className="h-3 w-3" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Intent Tags Row */}
      {type !== "transfer" && (
        <div>
          <div
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "var(--space-2)",
            }}
          >
            Intent (why/how)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {/* Show selected intent tags */}
            {intentTags.map((tag) => {
              const IconComponent = INTENT_TAG_ICONS[tag] || Lucide.Tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setIntentTags((prev) => prev.filter((t) => t !== tag))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "var(--text-meta)",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-foreground)",
                    border: "none",
                  }}
                >
                  <IconComponent className="h-3.5 w-3.5" />
                  {tag}
                  <Lucide.X className="h-3 w-3 ml-1" />
                </button>
              );
            })}
            
            {/* Add intent button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowIntentPicker(!showIntentPicker)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-meta)",
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  border: "1px dashed var(--border)",
                  backgroundColor: "transparent",
                }}
              >
                <Lucide.Plus className="h-3.5 w-3.5" />
                {intentTags.length === 0 ? "Intent" : "Add"}
              </button>
              
              {showIntentPicker && (
                <>
                  <div 
                    style={{ position: "fixed", inset: 0, zIndex: 5 }}
                    onClick={() => setShowIntentPicker(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: "var(--space-2)",
                      zIndex: 10,
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-2)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--space-2)",
                      maxWidth: "280px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {INTENT_TAGS.filter(t => t !== "Unknown" && !intentTags.includes(t)).map((tag) => {
                      const IconComponent = INTENT_TAG_ICONS[tag] || Lucide.Tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setIntentTags((prev) => [...prev, tag]);
                            setShowIntentPicker(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-1)",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-meta)",
                            cursor: "pointer",
                            backgroundColor: "var(--surface-2)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <IconComponent className="h-3 w-3" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link to Goal or Budget */}
      {type !== "transfer" && (
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--surface-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <Lucide.Link className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            <span style={{ fontSize: "var(--text-meta)", fontWeight: 500, color: "var(--text-secondary)" }}>
              Link to Goal or Budget (Optional)
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", marginBottom: "var(--space-1)" }}>
                Goal
              </label>
              <select
                value={linkedGoalId}
                onChange={(e) => setLinkedGoalId(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="">None</option>
                {goals?.map((g: any) => (
                  <option key={g._id} value={g._id}>
                    {g.name} ({g.status || "active"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", marginBottom: "var(--space-1)" }}>
                Budget Category
              </label>
              <select
                value={linkedBudgetId}
                onChange={(e) => setLinkedBudgetId(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  fontSize: "var(--text-body)",
                  color: "var(--text)",
                  outline: "none",
                }}
              >
                <option value="">None</option>
                {budgets?.map((b: any) => (
                  <option key={b._id} value={b._id}>
                    {b.name || b.category} (${(b.amountCents / 100).toFixed(0)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Note (Progressive Disclosure) */}
      <div>
        {!showNote && !note.trim() ? (
          <button
            type="button"
            onClick={() => {
              setShowNote(true);
              setTimeout(() => noteInputRef.current?.focus(), 50);
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
              color: "var(--text-secondary)",
              border: "1px dashed var(--border)",
              backgroundColor: "transparent",
            }}
          >
            <Lucide.StickyNote className="h-3.5 w-3.5" />
            Add note if helpful
          </button>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
              <label
                style={{
                  fontSize: "var(--text-micro)",
                  fontWeight: 500,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Note
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowNote(false);
                  setNote("");
                }}
                style={{
                  fontSize: "var(--text-meta)",
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Remove
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
                border: "1px solid var(--border)",
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
        type="button"
        onClick={onSave}
        disabled={!canSave || status.kind === "saving"}
        style={{
          width: "100%",
          backgroundColor: canSave ? "var(--primary)" : "var(--surface-2)",
          color: canSave ? "var(--primary-foreground)" : "var(--text-tertiary)",
          border: canSave ? "none" : "1px solid var(--border)",
          borderRadius: "var(--input-radius)",
          padding: "var(--space-3)",
          minHeight: "48px",
          fontWeight: 600,
          fontSize: "var(--text-body)",
          cursor: canSave ? "pointer" : "not-allowed",
          opacity: status.kind === "saving" ? 0.7 : 1,
          transition: "all 150ms ease",
        }}
      >
        {status.kind === "saving" ? "Saving..." : type === "transfer" ? "Save transfer" : "Save entry"}
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
            padding: "var(--space-3)",
          }}
        >
          <Lucide.CheckCircle className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
          <span style={{ flex: 1, fontWeight: 500, fontSize: "var(--text-meta)", color: "var(--success)" }}>
            {status.msg}
          </span>
          {status.undoId && (
            <button
              type="button"
              onClick={onUndo}
              style={{
                padding: "4px 10px",
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
            padding: "var(--space-3)",
          }}
        >
          <Lucide.AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} />
          <span style={{ flex: 1, fontWeight: 500, fontSize: "var(--text-meta)", color: "var(--danger)" }}>
            {status.msg}
          </span>
        </div>
      )}

      {/* Hint - Updated copy */}
      {type !== "transfer" && (
        <p style={{ fontSize: "var(--text-meta)", color: "var(--text-tertiary)", textAlign: "center", margin: 0 }}>
          Not sure yet? Save to Review — you'll see it on your dashboard.
        </p>
      )}
    </div>
  );
}
