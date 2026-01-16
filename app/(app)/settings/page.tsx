"use client";

import { SignedIn, SignedOut, useUser, SignOutButton, SignInButton } from "@clerk/nextjs";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.js";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.js";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical.js";
import Star from "lucide-react/dist/esm/icons/star.js";
import ArrowDownLeft from "lucide-react/dist/esm/icons/arrow-down-left.js";
import Tags from "lucide-react/dist/esm/icons/tags.js";
import EyeOff from "lucide-react/dist/esm/icons/eye-off.js";
import Eye from "lucide-react/dist/esm/icons/eye.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.js";
import Download from "lucide-react/dist/esm/icons/download.js";
import Lock from "lucide-react/dist/esm/icons/lock.js";
import BookOpen from "lucide-react/dist/esm/icons/book-open.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import FilterX from "lucide-react/dist/esm/icons/filter-x.js";
import Sun from "lucide-react/dist/esm/icons/sun.js";
import Bell from "lucide-react/dist/esm/icons/bell.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.js";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle.js";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb.js";
import Moon from "lucide-react/dist/esm/icons/moon.js";
import Palette from "lucide-react/dist/esm/icons/palette.js";
import Repeat from "lucide-react/dist/esm/icons/repeat.js";
import Shield from "lucide-react/dist/esm/icons/shield.js";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.js";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up.js";
import Plus from "lucide-react/dist/esm/icons/plus.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme, APPEARANCE_OPTIONS, NAV_ITEM_CONFIG } from "@/components/ThemeProvider";
import { centsToDollars, EXPENSE_SPACES, INCOME_SPACES, CONTEXT_TAGS } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";

type ExpenseSpace = typeof EXPENSE_SPACES[number];
type IncomeSpace = typeof INCOME_SPACES[number];
type ContextTag = typeof CONTEXT_TAGS[number];

function isExpenseSpace(x: string): x is ExpenseSpace {
  return (EXPENSE_SPACES as readonly string[]).includes(x);
}

function isIncomeSpace(x: string): x is IncomeSpace {
  return (INCOME_SPACES as readonly string[]).includes(x);
}

function isContextTag(x: string): x is ContextTag {
  return (CONTEXT_TAGS as readonly string[]).includes(x);
}

type SettingsSection = "main" | "categories" | "export" | "privacy" | "help" | "theme" | "notifications";

// Keys for localStorage (fallback)
const PINNED_EXPENSE_KEY = "tallyup.pinnedExpenseCategories";
const PINNED_INCOME_KEY = "tallyup.pinnedIncomeCategories";
const HIDDEN_TAGS_KEY = "tallyup.hiddenTags";
const PINNED_TAGS_KEY = "tallyup.pinnedTags";
const HIDDEN_EXPENSE_KEY = "tallyup.hiddenExpenseCategories";
const HIDDEN_INCOME_KEY = "tallyup.hiddenIncomeCategories";
const REVIEW_REMINDER_KEY = "tallyup.reviewReminder";

export default function SettingsPage() {
  const { user } = useUser();
  const { theme, setTheme: changeTheme, visibleNavItems, toggleNavItem } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SettingsSection>("main");

  // Convex queries & mutations
  const userPrefs = useQuery(api.preferences.getUserPreferences);
  const upsertPrefs = useMutation(api.preferences.upsertUserPreferences);
  const customExpenseCategoriesData = useQuery(api.categories.listCategories, { categoryType: "expense" });
  const customIncomeCategoriesData = useQuery(api.categories.listCategories, { categoryType: "income" });
  const createCategory = useMutation(api.categories.createCategory);
  const deleteCategory = useMutation(api.categories.deleteCategory);
  const ensureSystemCategories = useMutation(api.categories.ensureSystemCategories);

  // Category/tag management state - synced with Convex or localStorage fallback
  const [pinnedExpense, setPinnedExpense] = useState<ExpenseSpace[]>([]);
  const [pinnedIncome, setPinnedIncome] = useState<IncomeSpace[]>([]);
  const [pinnedTags, setPinnedTags] = useState<ContextTag[]>([]);
  const [hiddenTags, setHiddenTags] = useState<ContextTag[]>([]);
  const [hiddenExpense, setHiddenExpense] = useState<string[]>([]);
  const [hiddenIncome, setHiddenIncome] = useState<string[]>([]);

  // New category input state
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newIncomeCategory, setNewIncomeCategory] = useState("");
  const [addingExpense, setAddingExpense] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);

  // Drag state for reordering
  const [draggedItem, setDraggedItem] = useState<{ type: "expense" | "income" | "tag"; name: string } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: "expense" | "income" | "tag"; name: string } | null>(null);

  function errorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return undefined;
  }

  // Load from Convex prefs when available, fallback to localStorage
  useEffect(() => {
    ensureSystemCategories().catch(() => {});
    if (userPrefs) {
      // Use Convex data
      setPinnedExpense((userPrefs.pinnedExpenseCategories ?? []).filter(isExpenseSpace));
      setPinnedIncome((userPrefs.pinnedIncomeCategories ?? []).filter(isIncomeSpace));
      setPinnedTags((userPrefs.pinnedContextTags ?? []).filter(isContextTag));
      setHiddenTags((userPrefs.hiddenContextTags ?? []).filter(isContextTag));
      setHiddenExpense(userPrefs.hiddenExpenseCategories ?? []);
      setHiddenIncome(userPrefs.hiddenIncomeCategories ?? []);
    } else {
      // Fallback to localStorage
      try {
        const pe = localStorage.getItem(PINNED_EXPENSE_KEY);
        if (pe) setPinnedExpense(((JSON.parse(pe) as string[]) ?? []).filter(isExpenseSpace));
        const pi = localStorage.getItem(PINNED_INCOME_KEY);
        if (pi) setPinnedIncome(((JSON.parse(pi) as string[]) ?? []).filter(isIncomeSpace));
        const pt = localStorage.getItem(PINNED_TAGS_KEY);
        if (pt) setPinnedTags(((JSON.parse(pt) as string[]) ?? []).filter(isContextTag));
        const ht = localStorage.getItem(HIDDEN_TAGS_KEY);
        if (ht) setHiddenTags(((JSON.parse(ht) as string[]) ?? []).filter(isContextTag));
        const he = localStorage.getItem(HIDDEN_EXPENSE_KEY);
        if (he) setHiddenExpense(JSON.parse(he) as string[] ?? []);
        const hi = localStorage.getItem(HIDDEN_INCOME_KEY);
        if (hi) setHiddenIncome(JSON.parse(hi) as string[] ?? []);
      } catch {}
    }
  }, [userPrefs]);

  // Save to both localStorage and Convex
  const savePrefs = useCallback(async (updates: {
    pinnedExpenseCategories?: string[];
    pinnedIncomeCategories?: string[];
    pinnedContextTags?: string[];
    hiddenContextTags?: string[];
    hiddenExpenseCategories?: string[];
    hiddenIncomeCategories?: string[];
    expenseCategoryOrder?: string[];
    incomeCategoryOrder?: string[];
    contextTagOrder?: string[];
  }) => {
    // Save to localStorage first for immediate effect
    if (updates.pinnedExpenseCategories) {
      localStorage.setItem(PINNED_EXPENSE_KEY, JSON.stringify(updates.pinnedExpenseCategories));
    }
    if (updates.pinnedIncomeCategories) {
      localStorage.setItem(PINNED_INCOME_KEY, JSON.stringify(updates.pinnedIncomeCategories));
    }
    if (updates.pinnedContextTags) {
      localStorage.setItem(PINNED_TAGS_KEY, JSON.stringify(updates.pinnedContextTags));
    }
    if (updates.hiddenContextTags) {
      localStorage.setItem(HIDDEN_TAGS_KEY, JSON.stringify(updates.hiddenContextTags));
    }
    if (updates.hiddenExpenseCategories) {
      localStorage.setItem(HIDDEN_EXPENSE_KEY, JSON.stringify(updates.hiddenExpenseCategories));
    }
    if (updates.hiddenIncomeCategories) {
      localStorage.setItem(HIDDEN_INCOME_KEY, JSON.stringify(updates.hiddenIncomeCategories));
    }
    if (updates.expenseCategoryOrder) {
      localStorage.setItem("tallyup.expenseCategoryOrder", JSON.stringify(updates.expenseCategoryOrder));
    }
    if (updates.incomeCategoryOrder) {
      localStorage.setItem("tallyup.incomeCategoryOrder", JSON.stringify(updates.incomeCategoryOrder));
    }
    if (updates.contextTagOrder) {
      localStorage.setItem("tallyup.contextTagOrder", JSON.stringify(updates.contextTagOrder));
    }
    // Then save to Convex
    try {
      await upsertPrefs(updates);
    } catch (e) {
      console.error("Failed to save preferences:", e);
    }
  }, [upsertPrefs]);

  const togglePinExpense = useCallback((cat: ExpenseSpace) => {
    setPinnedExpense((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      savePrefs({ pinnedExpenseCategories: next });
      return next;
    });
  }, [savePrefs]);

  const togglePinIncome = useCallback((cat: IncomeSpace) => {
    setPinnedIncome((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      savePrefs({ pinnedIncomeCategories: next });
      return next;
    });
  }, [savePrefs]);

  const togglePinTag = useCallback((tag: ContextTag) => {
    setPinnedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      savePrefs({ pinnedContextTags: next });
      return next;
    });
  }, [savePrefs]);

  const toggleHideTag = useCallback((tag: ContextTag) => {
    setHiddenTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      savePrefs({ hiddenContextTags: next });
      return next;
    });
  }, [savePrefs]);

  const toggleHideExpense = useCallback((cat: string) => {
    setHiddenExpense((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      savePrefs({ hiddenExpenseCategories: next });
      return next;
    });
  }, [savePrefs]);

  const toggleHideIncome = useCallback((cat: string) => {
    setHiddenIncome((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      savePrefs({ hiddenIncomeCategories: next });
      return next;
    });
  }, [savePrefs]);

  // Add custom category handlers
  const handleAddExpenseCategory = useCallback(async () => {
    const name = newExpenseCategory.trim();
    if (!name) return;
    try {
      await createCategory({ name, categoryType: "expense" });
      setNewExpenseCategory("");
      setAddingExpense(false);
      toast.success("Category added", { description: `"${name}" added to expenses` });
    } catch (e) {
      toast.error("Failed to add category", { description: errorMessage(e) });
    }
  }, [newExpenseCategory, createCategory, toast]);

  const handleAddIncomeCategory = useCallback(async () => {
    const name = newIncomeCategory.trim();
    if (!name) return;
    try {
      await createCategory({ name, categoryType: "income" });
      setNewIncomeCategory("");
      setAddingIncome(false);
      toast.success("Category added", { description: `"${name}" added to income sources` });
    } catch (e) {
      toast.error("Failed to add category", { description: errorMessage(e) });
    }
  }, [newIncomeCategory, createCategory, toast]);

  // Get custom categories by type (as name arrays)
  const customExpenseCategories = useMemo(() => 
    (customExpenseCategoriesData ?? []).map(c => c.name),
    [customExpenseCategoriesData]
  );
  const customIncomeCategories = useMemo(() => 
    (customIncomeCategoriesData ?? []).map(c => c.name),
    [customIncomeCategoriesData]
  );

  // Combined lists: defaults + custom
  const allExpenseCategories = useMemo(() => [
    ...EXPENSE_SPACES,
    ...customExpenseCategories.filter(c => !EXPENSE_SPACES.includes(c as ExpenseSpace))
  ], [customExpenseCategories]);

  const allIncomeCategories = useMemo(() => [
    ...INCOME_SPACES,
    ...customIncomeCategories.filter(c => !INCOME_SPACES.includes(c as IncomeSpace))
  ], [customIncomeCategories]);

  // Order state - derived from prefs or defaults
  const [expenseOrder, setExpenseOrder] = useState<string[]>([]);
  const [incomeOrder, setIncomeOrder] = useState<string[]>([]);
  const [tagOrder, setTagOrder] = useState<string[]>([]);

  // Initialize order from prefs or use default order
  useEffect(() => {
    if (userPrefs?.expenseCategoryOrder?.length) {
      // Merge saved order with any new categories
      const saved = userPrefs.expenseCategoryOrder;
      const all = allExpenseCategories;
      const ordered = [...saved.filter(c => all.includes(c)), ...all.filter(c => !saved.includes(c))];
      setExpenseOrder(ordered);
    } else {
      setExpenseOrder([...allExpenseCategories]);
    }
  }, [userPrefs?.expenseCategoryOrder, allExpenseCategories]);

  useEffect(() => {
    if (userPrefs?.incomeCategoryOrder?.length) {
      const saved = userPrefs.incomeCategoryOrder;
      const all = allIncomeCategories;
      const ordered = [...saved.filter(c => all.includes(c)), ...all.filter(c => !saved.includes(c))];
      setIncomeOrder(ordered);
    } else {
      setIncomeOrder([...allIncomeCategories]);
    }
  }, [userPrefs?.incomeCategoryOrder, allIncomeCategories]);

  useEffect(() => {
    if (userPrefs?.contextTagOrder?.length) {
      const saved = userPrefs.contextTagOrder;
      const all = [...CONTEXT_TAGS];
      const ordered = [...saved.filter(t => all.includes(t as ContextTag)), ...all.filter(t => !saved.includes(t))];
      setTagOrder(ordered);
    } else {
      setTagOrder([...CONTEXT_TAGS]);
    }
  }, [userPrefs?.contextTagOrder]);

  // Drag handlers
  const handleDragStart = useCallback((type: "expense" | "income" | "tag", name: string) => {
    setDraggedItem({ type, name });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, type: "expense" | "income" | "tag", name: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === type && draggedItem.name !== name) {
      setDragOverItem({ type, name });
    }
  }, [draggedItem]);

  const handleDragEnd = useCallback(async () => {
    if (draggedItem && dragOverItem && draggedItem.type === dragOverItem.type) {
      const type = draggedItem.type;
      
      if (type === "expense") {
        const items = [...expenseOrder];
        const fromIdx = items.indexOf(draggedItem.name);
        const toIdx = items.indexOf(dragOverItem.name);
        if (fromIdx !== -1 && toIdx !== -1) {
          items.splice(fromIdx, 1);
          items.splice(toIdx, 0, draggedItem.name);
          setExpenseOrder(items);
          await savePrefs({ expenseCategoryOrder: items } as Parameters<typeof savePrefs>[0]);
          toast.success("Order saved");
        }
      } else if (type === "income") {
        const items = [...incomeOrder];
        const fromIdx = items.indexOf(draggedItem.name);
        const toIdx = items.indexOf(dragOverItem.name);
        if (fromIdx !== -1 && toIdx !== -1) {
          items.splice(fromIdx, 1);
          items.splice(toIdx, 0, draggedItem.name);
          setIncomeOrder(items);
          await savePrefs({ incomeCategoryOrder: items } as Parameters<typeof savePrefs>[0]);
          toast.success("Order saved");
        }
      } else if (type === "tag") {
        const items = [...tagOrder];
        const fromIdx = items.indexOf(draggedItem.name);
        const toIdx = items.indexOf(dragOverItem.name);
        if (fromIdx !== -1 && toIdx !== -1) {
          items.splice(fromIdx, 1);
          items.splice(toIdx, 0, draggedItem.name);
          setTagOrder(items);
          await savePrefs({ contextTagOrder: items } as Parameters<typeof savePrefs>[0]);
          toast.success("Order saved");
        }
      }
    }
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, dragOverItem, expenseOrder, incomeOrder, tagOrder, savePrefs, toast]);

  // Privacy settings
  const [hideAmounts, setHideAmounts] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  useEffect(() => {
    try {
      setHideAmounts(localStorage.getItem("tallyup.hideAmounts") === "1");
      setRequireAuth(localStorage.getItem("tallyup.requireAuth") === "1");
    } catch {}
  }, []);
  function toggleHideAmounts() {
    const next = !hideAmounts;
    setHideAmounts(next);
    try { localStorage.setItem("tallyup.hideAmounts", next ? "1" : "0"); } catch {}
  }
  function toggleRequireAuth() {
    const next = !requireAuth;
    setRequireAuth(next);
    try { localStorage.setItem("tallyup.requireAuth", next ? "1" : "0"); } catch {}
  }

  // Export data - use local date range state for flexibility
  const [exportStartDate, setExportStartDate] = useState(() => {
    // Default to last 90 days
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.getTime();
  });
  const [exportEndDate, setExportEndDate] = useState(() => Date.now());
  const exportLabel = useMemo(() => {
    const start = new Date(exportStartDate);
    const end = new Date(exportEndDate);
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }, [exportStartDate, exportEndDate]);
  
  const entries = useQuery(api.entries.listEntries, { startDate: exportStartDate, endDate: exportEndDate, limit: 5000 }) as Doc<"entries">[] | undefined;
  const [exporting, setExporting] = useState(false);
  async function exportCSV() {
    if (!entries) return;
    setExporting(true);
    try {
      const rows = [["Date", "Type", "Category", "Amount", "Tags", "Note", "Method/Account"]];
      for (const e of entries) {
        rows.push([
          new Date(e.date).toLocaleDateString(),
          e.type,
          e.category ?? "",
          centsToDollars(e.amountCents),
          (e.tags ?? []).join("; "),
          e.note ?? "",
          e.methodOrAccount ?? "",
        ]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tallyup-export-${exportLabel.replace(/\s/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export complete", { description: `${entries.length} transactions exported` });
    } catch (e: unknown) {
      toast.error("Export failed", { description: errorMessage(e) ?? "Unknown error" });
    } finally {
      setExporting(false);
    }
  }

  // Help actions
  function resetFilters() {
    try {
      localStorage.removeItem("tallyup.timeRange");
    } catch {}
    router.replace("/activity");
  }

  function resetOnboarding() {
    try {
      localStorage.removeItem("tallyup.onboarding");
      localStorage.removeItem("tallyup.tips");
    } catch {}
    alert("Onboarding tips have been reset.");
  }

  // Render section
  if (activeSection !== "main") {
    return (
      <div className="space-y-4 pb-4">
        {/* Back header */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setActiveSection("main")}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Settings
          </button>
        </div>

        {/* Categories & Tags */}
        {activeSection === "categories" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Categories & Tags</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Customize categories, add your own, or hide ones you don&apos;t use
              </p>
            </div>

            {/* Expense Categories */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" style={{ color: "var(--danger)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Expense Categories</h3>
                </div>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  ⭐ Pin · 👁 Hide
                </span>
              </div>
              <div className="space-y-2">
                {/* Render in saved order, with hidden items at the end */}
                {[
                  ...expenseOrder.filter(c => !hiddenExpense.includes(c)),
                  ...expenseOrder.filter(c => hiddenExpense.includes(c)),
                ].map((cat) => {
                  const isPinned = pinnedExpense.includes(cat as ExpenseSpace);
                  const isHidden = hiddenExpense.includes(cat);
                  const isCustom = customExpenseCategories.includes(cat);
                  const customCat = (customExpenseCategoriesData ?? []).find(c => c.name === cat);
                  return (
                    <div
                      key={cat}
                      draggable
                      onDragStart={() => handleDragStart("expense", cat)}
                      onDragOver={(e) => handleDragOver(e, "expense", cat)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center justify-between py-2 px-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: dragOverItem?.type === "expense" && dragOverItem.name === cat
                          ? "var(--accent)"
                          : isHidden 
                            ? "var(--surface)" 
                            : isPinned 
                              ? "var(--accent-subtle)" 
                              : "var(--surface-subtle)",
                        opacity: isHidden ? 0.5 : 1,
                        cursor: "grab",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm" style={{ color: "var(--text)", textDecoration: isHidden ? "line-through" : "none" }}>{cat}</span>
                        {isPinned && !isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                            Pinned
                          </span>
                        )}
                        {isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-tertiary)" }}>
                            Hidden
                          </span>
                        )}
                        {isCustom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--success-subtle)", color: "var(--success)" }}>
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => isExpenseSpace(cat) && togglePinExpense(cat)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isPinned ? "Unpin" : "Pin to top"}
                          disabled={isHidden}
                        >
                          <Star className="h-4 w-4" style={{ color: isPinned ? "var(--warning)" : "var(--text-tertiary)" }} fill={isPinned ? "var(--warning)" : "none"} />
                        </button>
                        <button
                          onClick={() => toggleHideExpense(cat)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isHidden ? "Show" : "Hide"}
                        >
                          {isHidden ? (
                            <EyeOff className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          ) : (
                            <Eye className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          )}
                        </button>
                        {isCustom && customCat && (
                          <button
                            onClick={async () => {
                              if (confirm(`Delete "${cat}"?`)) {
                                try {
                                  await deleteCategory({ id: customCat._id });
                                  toast.success("Category deleted");
                                } catch (e) {
                                  toast.error("Failed to delete", { description: errorMessage(e) });
                                }
                              }
                            }}
                            className="p-1.5 rounded hover:bg-[var(--danger-subtle)] transition-colors"
                            title="Delete custom category"
                          >
                            <Trash2 className="h-4 w-4" style={{ color: "var(--danger)" }} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Add custom expense category */}
              {addingExpense ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddExpenseCategory()}
                    placeholder="New category name..."
                    autoFocus
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: "var(--input)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <button
                    onClick={handleAddExpenseCategory}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingExpense(false); setNewExpenseCategory(""); }}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingExpense(true)}
                  className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium w-full justify-center"
                  style={{ backgroundColor: "var(--surface-subtle)", color: "var(--accent)" }}
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Category
                </button>
              )}
              
              <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
                Hidden categories won&apos;t appear in quick-add flows but remain on existing entries.
              </p>
            </div>

            {/* Income Categories */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Income Categories</h3>
                </div>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  ⭐ Pin · 👁 Hide
                </span>
              </div>
              <div className="space-y-2">
                {/* Render in saved order, with hidden items at the end */}
                {[
                  ...incomeOrder.filter(c => !hiddenIncome.includes(c)),
                  ...incomeOrder.filter(c => hiddenIncome.includes(c)),
                ].map((cat) => {
                  const isPinned = pinnedIncome.includes(cat as IncomeSpace);
                  const isHidden = hiddenIncome.includes(cat);
                  const isCustom = customIncomeCategories.includes(cat);
                  const customCat = (customIncomeCategoriesData ?? []).find(c => c.name === cat);
                  return (
                    <div
                      key={cat}
                      draggable
                      onDragStart={() => handleDragStart("income", cat)}
                      onDragOver={(e) => handleDragOver(e, "income", cat)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center justify-between py-2 px-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: dragOverItem?.type === "income" && dragOverItem.name === cat
                          ? "var(--accent)"
                          : isHidden 
                            ? "var(--surface)" 
                            : isPinned 
                              ? "var(--accent-subtle)" 
                              : "var(--surface-subtle)",
                        opacity: isHidden ? 0.5 : 1,
                        cursor: "grab",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm" style={{ color: "var(--text)", textDecoration: isHidden ? "line-through" : "none" }}>{cat}</span>
                        {isPinned && !isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                            Pinned
                          </span>
                        )}
                        {isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-tertiary)" }}>
                            Hidden
                          </span>
                        )}
                        {isCustom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--success-subtle)", color: "var(--success)" }}>
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => isIncomeSpace(cat) && togglePinIncome(cat)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isPinned ? "Unpin" : "Pin to top"}
                          disabled={isHidden}
                        >
                          <Star className="h-4 w-4" style={{ color: isPinned ? "var(--warning)" : "var(--text-tertiary)" }} fill={isPinned ? "var(--warning)" : "none"} />
                        </button>
                        <button
                          onClick={() => toggleHideIncome(cat)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isHidden ? "Show" : "Hide"}
                        >
                          {isHidden ? (
                            <EyeOff className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          ) : (
                            <Eye className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          )}
                        </button>
                        {isCustom && customCat && (
                          <button
                            onClick={async () => {
                              if (confirm(`Delete "${cat}"?`)) {
                                try {
                                  await deleteCategory({ id: customCat._id });
                                  toast.success("Category deleted");
                                } catch (e) {
                                  toast.error("Failed to delete", { description: errorMessage(e) });
                                }
                              }
                            }}
                            className="p-1.5 rounded hover:bg-[var(--danger-subtle)] transition-colors"
                            title="Delete custom category"
                          >
                            <Trash2 className="h-4 w-4" style={{ color: "var(--danger)" }} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Add custom income category */}
              {addingIncome ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={newIncomeCategory}
                    onChange={(e) => setNewIncomeCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddIncomeCategory()}
                    placeholder="New income source..."
                    autoFocus
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: "var(--input)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <button
                    onClick={handleAddIncomeCategory}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingIncome(false); setNewIncomeCategory(""); }}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingIncome(true)}
                  className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium w-full justify-center"
                  style={{ backgroundColor: "var(--surface-subtle)", color: "var(--accent)" }}
                >
                  <Plus className="h-4 w-4" />
                  Add Custom Income Source
                </button>
              )}
              
              <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
                Hidden categories won&apos;t appear in quick-add flows but remain on existing entries.
              </p>
            </div>

            {/* Context Tags */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Tags className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Context Tags</h3>
                </div>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  ⭐ Pin · 👁 Hide
                </span>
              </div>
              <div className="space-y-2">
                {/* Render in saved order, with hidden items at the end */}
                {[
                  ...tagOrder.filter(t => !hiddenTags.includes(t as ContextTag)),
                  ...tagOrder.filter(t => hiddenTags.includes(t as ContextTag)),
                ].map((tag) => {
                  const isPinned = pinnedTags.includes(tag as ContextTag);
                  const isHidden = hiddenTags.includes(tag as ContextTag);
                  return (
                    <div
                      key={tag}
                      draggable
                      onDragStart={() => handleDragStart("tag", tag)}
                      onDragOver={(e) => handleDragOver(e, "tag", tag)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center justify-between py-2 px-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: dragOverItem?.type === "tag" && dragOverItem.name === tag
                          ? "var(--accent)"
                          : isHidden 
                            ? "var(--surface)" 
                            : isPinned 
                              ? "var(--accent-subtle)" 
                              : "var(--surface-subtle)",
                        opacity: isHidden ? 0.5 : 1,
                        cursor: "grab",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                        <span className="text-sm" style={{ color: "var(--text)", textDecoration: isHidden ? "line-through" : "none" }}>{tag}</span>
                        {isPinned && !isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                            Pinned
                          </span>
                        )}
                        {isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-tertiary)" }}>
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePinTag(tag as ContextTag)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isPinned ? "Unpin" : "Pin to top"}
                          disabled={isHidden}
                        >
                          <Star className="h-4 w-4" style={{ color: isPinned ? "var(--warning)" : "var(--text-tertiary)" }} fill={isPinned ? "var(--warning)" : "none"} />
                        </button>
                        <button
                          onClick={() => toggleHideTag(tag as ContextTag)}
                          className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                          title={isHidden ? "Show" : "Hide"}
                        >
                          {isHidden ? (
                            <EyeOff className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          ) : (
                            <Eye className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
                Hidden tags won&apos;t appear in quick-add flows but remain on existing entries.
              </p>
            </div>
          </div>
        )}

        {/* Export */}
        {activeSection === "export" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Export Data</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Download your financial data as a CSV file
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Time Range Selection */}
              <div className="mb-4">
                <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-tertiary)" }}>
                  Time Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>From</label>
                    <input
                      type="date"
                      value={new Date(exportStartDate).toISOString().split('T')[0]}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        if (!isNaN(d.getTime())) setExportStartDate(d.getTime());
                      }}
                      className="w-full rounded-lg px-3 py-2.5 text-sm"
                      style={{
                        backgroundColor: "var(--input)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>To</label>
                    <input
                      type="date"
                      value={new Date(exportEndDate).toISOString().split('T')[0]}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        if (!isNaN(d.getTime())) setExportEndDate(d.getTime());
                      }}
                      className="w-full rounded-lg px-3 py-2.5 text-sm"
                      style={{
                        backgroundColor: "var(--input)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: "Last 30 days", days: 30 },
                  { label: "Last 90 days", days: 90 },
                  { label: "This year", days: -1 },
                  { label: "All time", days: -2 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      const now = new Date();
                      let start: Date;
                      if (preset.days === -1) {
                        // This year
                        start = new Date(now.getFullYear(), 0, 1);
                      } else if (preset.days === -2) {
                        // All time - go back 10 years
                        start = new Date(now.getFullYear() - 10, 0, 1);
                      } else {
                        start = new Date();
                        start.setDate(start.getDate() - preset.days);
                      }
                      setExportStartDate(start.getTime());
                      setExportEndDate(now.getTime());
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                <FileText className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {entries ? `${entries.length} transactions will be exported` : "Loading..."}
                </div>
              </div>

              <button
                onClick={exportCSV}
                disabled={!entries || exporting}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export as CSV
              </button>
            </div>
          </div>
        )}

        {/* Privacy & Lock */}
        {activeSection === "privacy" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Privacy & Lock</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Protect your financial data
              </p>
            </div>

            <div
              className="rounded-xl p-4 space-y-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Hide amounts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                    <EyeOff className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Hide amounts</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Replace amounts with •••</div>
                  </div>
                </div>
                <button
                  onClick={toggleHideAmounts}
                  className={`relative w-11 h-6 rounded-full transition-colors ${hideAmounts ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${hideAmounts ? "left-6" : "left-1"}`}
                  />
                </button>
              </div>

              {/* Require auth */}
              <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                    <Lock className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Require device auth</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>PIN/biometric when opening app</div>
                  </div>
                </div>
                <button
                  onClick={toggleRequireAuth}
                  className={`relative w-11 h-6 rounded-full transition-colors ${requireAuth ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${requireAuth ? "left-6" : "left-1"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help */}
        {activeSection === "help" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Help</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Learn how to use TallyUp effectively
              </p>
            </div>

            {/* How to use */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--accent-subtle)" }}>
                  <BookOpen className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>How to use TallyUp</div>
              </div>
              <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>1.</span>
                  <span><strong>Log entries</strong> — Tap + to record spending or income. Choose a category and add context tags.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>2.</span>
                  <span><strong>Review inbox</strong> — Items without a category go to review. Swipe to categorize quickly.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>3.</span>
                  <span><strong>Check insights</strong> — See where your money goes by category or context tag.</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>4.</span>
                  <span><strong>Use context tags</strong> — Mark entries as Personal, Shared, Business, Tax-Deductible, etc.</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={resetOnboarding}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <RefreshCw className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Reset tips & onboarding</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Show all tips again</div>
                </div>
              </button>
              <button
                onClick={resetFilters}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
              >
                <FilterX className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Reset all filters</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Clear Activity filters and time range</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Theme */}
        {activeSection === "theme" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Theme</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Choose your preferred appearance
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-2 gap-3">
                {APPEARANCE_OPTIONS.map(({ value, label, description }) => {
                  // Pick icon based on theme type
                  let Icon = Sun;
                  if (value === "dim") Icon = Moon;
                  else if (value === "estate") Icon = TrendingUp;
                  else if (value === "clarity") Icon = Sparkles;
                  return (
                    <button
                      key={value}
                      onClick={() => changeTheme(value)}
                      className={`flex flex-col items-start gap-2 rounded-xl p-4 transition-colors ${
                        theme === value ? "ring-2 ring-[var(--accent)]" : ""
                      }`}
                      style={{
                        backgroundColor: theme === value ? "var(--accent-subtle)" : "var(--surface-subtle)",
                      }}
                    >
                      <Icon className="h-6 w-6" style={{ color: theme === value ? "var(--accent)" : "var(--text-secondary)" }} />
                      <div style={{ textAlign: "left" }}>
                        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: 2 }}>{description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Customization */}
            <div
              className="rounded-2xl p-5 mt-6"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Navigation Bar</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Choose which pages appear in the navigation bar. Hidden pages are still accessible from the Menu.
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="space-y-2">
                {NAV_ITEM_CONFIG.map(({ id, label, description }) => {
                  const isVisible = visibleNavItems.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleNavItem(id)}
                      className="w-full flex items-center justify-between py-3 px-3 rounded-lg transition-colors"
                      style={{
                        backgroundColor: isVisible ? "var(--accent-subtle)" : "var(--surface-subtle)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center"
                          style={{
                            backgroundColor: isVisible ? "var(--accent)" : "var(--border)",
                          }}
                        >
                          {isVisible && (
                            <Check className="h-3 w-3" style={{ color: "var(--accent-foreground)" }} />
                          )}
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
                          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{description}</div>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        backgroundColor: isVisible ? "var(--success-subtle)" : "var(--surface-subtle)",
                        color: isVisible ? "var(--success)" : "var(--text-tertiary)",
                      }}>
                        {isVisible ? "In Nav" : "In Menu"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
                Dashboard and Menu are always visible in the navigation bar.
              </p>
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeSection === "notifications" && (
          <NotificationsSection toast={toast} />
        )}
      </div>
    );
  }

  // Main settings view
  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-h1" style={{ color: "var(--text)" }}>More</h1>
        <p className="text-meta mt-1">Settings & preferences</p>
      </div>

      <SignedOut>
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to access settings
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
        {/* User card */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold"
              style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {user?.fullName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "—"}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                {user?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
            <SignOutButton>
              <button className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-secondary)" }}>
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>

        {/* Settings menu */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Categories & Tags */}
          <button
            onClick={() => setActiveSection("categories")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--accent-subtle)" }}>
              <Tags className="h-5 w-5" style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Categories & Tags</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Manage category sets and context tags</div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Export */}
          <button
            onClick={() => setActiveSection("export")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.1)" }}>
              <Download className="h-5 w-5" style={{ color: "var(--success)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Export Data</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Download as CSV</div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Privacy & Lock */}
          <button
            onClick={() => setActiveSection("privacy")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
              <Shield className="h-5 w-5" style={{ color: "var(--warning)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Privacy & Lock</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Hide amounts, require auth</div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Help */}
          <button
            onClick={() => setActiveSection("help")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <HelpCircle className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Help</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>How to use TallyUp, reset tips</div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Theme */}
          <button
            onClick={() => setActiveSection("theme")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Palette className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Theme</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {APPEARANCE_OPTIONS.find((o) => o.value === theme)?.label ?? "Light"}
              </div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setActiveSection("notifications")}
            className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Bell className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Review Reminders</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Weekly review notifications</div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        {/* Recurring link */}
        <Link
          href="/recurring"
          className="block rounded-xl p-4 transition-colors hover:bg-[var(--surface-subtle)]"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
              <Repeat className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Recurring Patterns</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Manage detected recurring entries</div>
            </div>
            <ChevronRight className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </div>
        </Link>
      </SignedIn>
    </div>
  );
}

/**
 * Notifications Settings Section
 */
function NotificationsSection({ toast }: { toast: ReturnType<typeof useToast> }) {
  // Convex integration for preferences
  const preferences = useQuery(api.preferences.getUserPreferences, {});
  const upsertPreferences = useMutation(api.preferences.upsertUserPreferences);
  
  // Local state (initialized from Convex or defaults)
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState("Sunday");
  const [time, setTime] = useState("18:00");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [saving, setSaving] = useState(false);

  // Sync state from Convex preferences
  useEffect(() => {
    if (preferences) {
      setEnabled(preferences.reviewReminderEnabled ?? false);
      setDay(preferences.reviewReminderDay ?? "Sunday");
      setTime(preferences.reviewReminderTime ?? "18:00");
    }
    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, [preferences]);

  async function requestPermission() {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported", { description: "Your browser doesn't support notifications" });
      return;
    }
    
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === "granted") {
      toast.success("Notifications enabled!");
      // Show a test notification
      new Notification("TallyUp", {
        body: "You'll now receive weekly review reminders",
        icon: "/icons/icon-192.png",
      });
    } else {
      toast.error("Permission denied", { description: "You can enable notifications in your browser settings" });
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      // Save to Convex
      await upsertPreferences({
        reviewReminderEnabled: enabled,
        reviewReminderDay: day,
        reviewReminderTime: time,
        reviewReminderFrequency: "weekly",
      });
      
      // Also save to localStorage as backup for service worker
      localStorage.setItem(REVIEW_REMINDER_KEY, JSON.stringify({ enabled, day, time }));
      
      toast.success("Reminder settings saved");
      
      // Schedule notification via service worker
      if (enabled && notificationPermission === "granted" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.active?.postMessage({
            type: "SCHEDULE_REVIEW_REMINDER",
            payload: { day, time },
          });
        });
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    // Immediately save toggle state
    try {
      await upsertPreferences({ reviewReminderEnabled: next });
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Review Reminders</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Get a gentle nudge to review and clean up your money log
        </p>
      </div>

      {/* Permission status */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Notification Permission
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {notificationPermission === "granted" && "Enabled ✓"}
              {notificationPermission === "denied" && "Blocked (check browser settings)"}
              {notificationPermission === "default" && "Not yet requested"}
              {notificationPermission === "unsupported" && "Not supported by your browser"}
            </div>
          </div>
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <button
              onClick={requestPermission}
              className="text-sm font-medium px-4 py-2 rounded-lg"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              Enable
            </button>
          )}
        </div>
      </div>

      {/* Reminder settings */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Weekly Review Reminder
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              2 minutes to review flagged items and uncategorized entries
            </div>
          </div>
          <button
            onClick={toggleEnabled}
            className="relative w-12 h-7 rounded-full transition-colors"
            style={{
              backgroundColor: enabled ? "var(--accent)" : "var(--border)",
            }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full transition-transform"
              style={{
                backgroundColor: "white",
                left: enabled ? "24px" : "4px",
              }}
            />
          </button>
        </div>

        {enabled && (
          <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Day
                </label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                >
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {saving ? "Saving..." : "Save Reminder"}
            </button>
          </div>
        )}
      </div>

      {/* Reflective copy */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)" }}
      >
        <div className="flex gap-3">
          <Lightbulb className="h-5 w-5 flex-shrink-0" style={{ color: "var(--warning)" }} />
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text)" }}>Why weekly?</strong> Financial awareness is a habit. 
            A brief weekly review helps you stay in control without becoming obsessive. 
            Just 2 minutes: check flagged items, categorize recent entries, notice any surprises.
          </div>
        </div>
      </div>
    </div>
  );
}
