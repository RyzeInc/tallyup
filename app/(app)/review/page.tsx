"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import { centsToDollars, CONTEXT_TAGS, EXPENSE_SPACES, INCOME_SPACES } from "@/components/utils";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import EmptyState from "@/components/ui/EmptyState";

type Step = "confirm" | "category" | "tags" | "done";

export default function ReviewWizardPage() {
  const toast = useToast();
  const inbox = useQuery(api.entries.listInbox, { limit: 80 }) as any[] | undefined;
  const updateEntry = useMutation(api.entries.updateEntry);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<Step>("confirm");
  const [pendingCategory, setPendingCategory] = useState("");
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);

  const currentEntry = inbox?.[currentIndex] ?? null;
  const totalCount = inbox?.length ?? 0;
  const remainingCount = totalCount - currentIndex;

  // Reset state when moving to next entry
  const resetForNextEntry = useCallback(() => {
    setPendingCategory("");
    setPendingTags([]);
    setStep("confirm");
  }, []);

  // Move to next entry
  const goToNext = useCallback(() => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((i) => i + 1);
      resetForNextEntry();
    } else {
      setStep("done");
    }
  }, [currentIndex, totalCount, resetForNextEntry]);

  // Skip current entry
  const skipEntry = useCallback(() => {
    goToNext();
  }, [goToNext]);

  // Confirm step: validate type, amount, date
  const confirmAndContinue = useCallback(() => {
    // Pre-fill category from entry if exists
    if (currentEntry?.category) {
      setPendingCategory(currentEntry.category);
    }
    // Pre-fill tags from entry if exists
    if (currentEntry?.tags?.length) {
      setPendingTags(currentEntry.tags);
    }
    setStep("category");
  }, [currentEntry]);

  // Category selection
  const selectCategory = useCallback((cat: string) => {
    setPendingCategory(cat);
    setStep("tags");
  }, []);

  // Complete review
  const finishReview = useCallback(async () => {
    if (!currentEntry) return;

    setSaving(true);
    try {
      await updateEntry({
        id: currentEntry._id,
        category: pendingCategory || undefined,
        tags: pendingTags.length > 0 ? pendingTags : undefined,
        needsReview: false,
      });
      setCompleted((c) => c + 1);
      toast.success("Entry reviewed", { description: pendingCategory ? `Categorized as ${pendingCategory}` : undefined });
      goToNext();
    } catch (e) {
      console.error("Failed to update entry:", e);
      toast.error("Failed to save", { description: "Please try again" });
    } finally {
      setSaving(false);
    }
  }, [currentEntry, pendingCategory, pendingTags, updateEntry, goToNext, toast]);

  // Toggle a tag
  const toggleTag = useCallback((tag: string) => {
    setPendingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Get category options based on entry type
  const categoryOptions = useMemo(() => {
    if (!currentEntry) return [];
    return currentEntry.type === "income" ? [...INCOME_SPACES] : [...EXPENSE_SPACES];
  }, [currentEntry]);

  if (!inbox) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-meta">
          <Lucide.Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-tertiary)" }} />
          <span>Loading entries…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1" style={{ color: "var(--text)" }}>Review</h1>
            <p className="text-meta mt-1" style={{ color: "var(--text-secondary)" }}>
              {step === "done"
                ? `All done! Reviewed ${completed} entries.`
                : `${remainingCount} entries to review`}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
          </Link>
        </div>

        {/* Progress bar */}
        {step !== "done" && totalCount > 0 && (
          <div className="mt-4">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--surface-subtle)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${((completed + 1) / totalCount) * 100}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-micro">
              <span>{completed + 1} of {totalCount}</span>
              <span>{Math.round(((completed + 1) / totalCount) * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      <SignedOut>
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
            Sign in to review entries
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
        {step === "done" ? (
          /* Completion screen */
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
              style={{ backgroundColor: "var(--success-subtle)" }}
            >
              <Lucide.CheckCircle2 className="h-8 w-8" style={{ color: "var(--success)" }} />
            </div>
            <h2 className="text-h1 mb-2" style={{ color: "var(--text)" }}>All caught up!</h2>
            <p className="text-meta mb-6" style={{ color: "var(--text-secondary)" }}>
              You reviewed {completed} {completed === 1 ? "entry" : "entries"}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/dashboard"
                className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Back to Home
              </Link>
              <Link
                href="/insights"
                className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors border"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                View Insights
              </Link>
            </div>
          </div>
        ) : !currentEntry ? (
          /* No entries to review */
          <EmptyState
            icon={<Lucide.CheckCircle2 className="h-8 w-8" style={{ color: "var(--success)" }} />}
            title="Nothing to review"
            subtitle="All your entries are categorized"
            action={
              <Link
                href="/dashboard"
                className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                Back to Home
              </Link>
            }
          />
        ) : (
          /* Review wizard steps */
          <div className="space-y-4">
            {/* Entry card */}
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      currentEntry.type === "income"
                        ? "var(--success-subtle)"
                        : "var(--surface-subtle)",
                  }}
                >
                  {currentEntry.type === "income" ? (
                    <Lucide.ArrowDownLeft className="h-6 w-6" style={{ color: "var(--success)" }} />
                  ) : (
                    <Lucide.ArrowUpRight className="h-6 w-6" style={{ color: "var(--text-tertiary)" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-h2 truncate" style={{ color: "var(--text)" }}>
                    {currentEntry.note || currentEntry.merchant || "Untitled"}
                  </div>
                  <div className="text-meta mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {new Date(currentEntry.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  {currentEntry.methodOrAccount && (
                    <div className="text-meta mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {currentEntry.methodOrAccount}
                    </div>
                  )}
                </div>
                <div
                  className="text-xl font-bold tabular-nums"
                  style={{
                    color: currentEntry.type === "income" ? "var(--success)" : "var(--text)",
                  }}
                >
                  {currentEntry.type === "income" ? "+" : "−"}
                  {centsToDollars(Math.abs(currentEntry.amountCents))}
                </div>
              </div>

              {/* Type badge */}
              <div className="mt-4 flex gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor:
                      currentEntry.type === "income"
                        ? "var(--success-subtle)"
                        : "var(--danger-subtle)",
                    color:
                      currentEntry.type === "income" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {currentEntry.type === "income" ? (
                    <>
                      <Lucide.ArrowDownLeft className="h-3 w-3" />
                      Received
                    </>
                  ) : (
                    <>
                      <Lucide.ArrowUpRight className="h-3 w-3" />
                      Spent
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Step content */}
            {step === "confirm" && (
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h3 className="text-h2 mb-4" style={{ color: "var(--text)" }}>
                  Step 1: Confirm details
                </h3>
                <p className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                  Does this look correct?
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="text-meta">Type</span>
                    <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                      {currentEntry.type === "income" ? "Received" : "Spent"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <span className="text-meta">Amount</span>
                    <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                      {centsToDollars(currentEntry.amountCents)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-meta">Date</span>
                    <span className="text-body font-medium" style={{ color: "var(--text)" }}>
                      {new Date(currentEntry.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={skipEntry}
                    className="flex-1 rounded-lg py-3 text-sm font-medium border transition-colors hover:bg-[var(--surface-subtle)]"
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={confirmAndContinue}
                    className="flex-1 rounded-lg py-3 text-sm font-semibold"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    Looks good
                  </button>
                </div>
              </div>
            )}

            {step === "category" && (
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h3 className="text-h2 mb-4" style={{ color: "var(--text)" }}>
                  Step 2: Choose category
                </h3>
                <p className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                  What type of {currentEntry.type === "income" ? "income" : "expense"} is this?
                </p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {categoryOptions.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => selectCategory(cat)}
                      className={`rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                        pendingCategory === cat
                          ? "bg-[var(--accent-subtle)] border-[var(--accent)]"
                          : "hover:bg-[var(--surface-subtle)]"
                      }`}
                      style={{
                        border: `1px solid ${pendingCategory === cat ? "var(--accent)" : "var(--border)"}`,
                        color: pendingCategory === cat ? "var(--accent)" : "var(--text)",
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep("confirm")}
                  className="w-full text-center text-meta font-medium py-2"
                  style={{ color: "var(--accent)" }}
                >
                  ← Back
                </button>
              </div>
            )}

            {step === "tags" && (
              <div
                className="rounded-xl p-5"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <h3 className="text-h2 mb-4" style={{ color: "var(--text)" }}>
                  Step 3: Add context tags
                </h3>
                <p className="text-meta mb-4" style={{ color: "var(--text-secondary)" }}>
                  Select any that apply (optional)
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {CONTEXT_TAGS.map((tag) => {
                    const isSelected = pendingTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
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

                {/* Selected summary */}
                <div className="mb-6 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-subtle)" }}>
                  <div className="text-micro mb-2">Review summary:</div>
                  <div className="text-body">
                    <strong>Category:</strong> {pendingCategory || "None"}
                  </div>
                  {pendingTags.length > 0 && (
                    <div className="text-body mt-1">
                      <strong>Tags:</strong> {pendingTags.join(", ")}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("category")}
                    className="flex-1 rounded-lg py-3 text-sm font-medium border transition-colors hover:bg-[var(--surface-subtle)]"
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={finishReview}
                    disabled={saving}
                    className="flex-1 rounded-lg py-3 text-sm font-semibold disabled:opacity-60"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    {saving ? "Saving…" : "Done"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </SignedIn>
    </div>
  );
}
