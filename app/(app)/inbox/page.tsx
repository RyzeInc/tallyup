"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import EntryCard from "@/components/EntryCard";
import TagChips from "@/components/TagChips";
import RecurringModal from "@/components/RecurringModal";
import { DEFAULT_TAGS, cacheKey, uniqCaseInsensitive } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import * as Lucide from "lucide-react";
import { useTabs } from "@/components/PersistentTabs";

export default function InboxPage() {
  const { user } = useUser();
  const { setActiveTab } = useTabs();
  const toast = useToast();
  const inbox = useQuery(api.entries.listInbox, { limit: 80 }) as any[] | undefined;

  // Use both types for suggestions
  const expenseCats = useQuery(api.entries.listCategories, { type: "expense", bucket: undefined }) as
    | string[]
    | undefined;
  const incomeCats = useQuery(api.entries.listCategories, { type: "income", bucket: undefined }) as
    | string[]
    | undefined;

  const updateEntry = useMutation(api.entries.updateEntry);

  const localExpenseCats = useMemo(() => {
    if (!user?.id) return [];
    try {
      const raw = localStorage.getItem(cacheKey(user.id, "expense"));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }, [user?.id]);

  const catSuggestions = useMemo(() => {
    return uniqCaseInsensitive([
      ...(localExpenseCats ?? []),
      ...((expenseCats ?? []) as string[]),
      ...((incomeCats ?? []) as string[]),
    ]).slice(0, 60);
  }, [localExpenseCats, expenseCats, incomeCats]);

  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div>
      <PageHeader
        title="Needs Review"
        subtitle="A few entries need context"
      />
      <div className="mb-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Tip: You can save a pattern to recognize similar future entries (auto-apply is off by default and requires
        confirmation).
      </div>

      <SignedOut>
        <EmptyState
          icon={<Lucide.LogIn className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Sign in required"
          subtitle="Sign in to view items that need review."
          action={
            <SignInButton mode="modal">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                Sign in
              </button>
            </SignInButton>
          }
        />
      </SignedOut>

      <SignedIn>
        {!inbox ? (
          <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>
        ) : inbox.length === 0 ? (
          <EmptyState
            icon={<Lucide.CheckCircle2 className="h-7 w-7" style={{ color: "var(--success)" }} />}
            title="All caught up!"
            subtitle="Nothing needs review right now. New entries without categories will appear here."
            action={
              <button
                onClick={() => setActiveTab("activity")}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
              >
                View Transactions
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {inbox.map((e) => (
              <InboxItem
                key={e._id}
                entry={e}
                onUpdate={updateEntry}
                catSuggestions={catSuggestions}
                onMakeRecurring={() => setSelected(e)}
              />
            ))}
          </div>
        )}
      </SignedIn>

      {selected ? <RecurringModal entry={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function InboxItem({
  entry,
  onUpdate,
  catSuggestions,
  onMakeRecurring,
}: {
  entry: any;
  onUpdate: (args: any) => Promise<any>;
  catSuggestions: string[];
  onMakeRecurring?: () => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState(entry.category ?? "");
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const suggestions = useQuery(api.entries.entrySuggestions, { id: entry._id }) as any[] | undefined;

  async function done() {
    setBusy(true);
    setErr(null);
    try {
      await onUpdate({
        id: entry._id,
        category: category.trim() ? category.trim() : undefined,
        tags: tags.length ? tags : undefined,
        needsReview: !category.trim(), // stays in inbox if still unlabeled
      });
      if (category.trim()) {
        toast.success("Marked as reviewed");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
      toast.error("Failed to update", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <EntryCard
      entry={entry}
      rightSlot={
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMakeRecurring?.()}
            className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-200"
          >
            Save as pattern
          </button>

          <button
            onClick={done}
            disabled={busy}
            className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs text-neutral-400">Category</div>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list={`cats-${entry._id}`}
            placeholder="Type category…"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none focus:border-neutral-600"
          />
          <datalist id={`cats-${entry._id}`}>
            {catSuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <div className="mb-2 text-xs text-neutral-400">Tags</div>
          <TagChips value={tags} onChange={setTags} options={DEFAULT_TAGS as unknown as string[]} />
        </div>

        {suggestions && suggestions.length ? (
          <div className="mt-2 flex gap-2 items-center text-sm">
            {suggestions.map((s: any, idx: number) => (
              <div key={idx} className="rounded-md border px-3 py-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-neutral-400">{s.reason}</div>
                  <div className="text-sm font-medium">{s.kind === "rule" ? s.reason : `${s.value}`}</div>
                  {s.kind === "category" ? (
                    <button className="ml-2 text-xs underline" onClick={() => { setCategory(s.value); done(); }}>Apply</button>
                  ) : null}
                  {s.kind === "tag" ? (
                    <button className="ml-2 text-xs underline" onClick={() => { setTags((t) => Array.from(new Set([...t, s.value]))); done(); }}>Apply</button>
                  ) : null}
                  {s.kind === "rule" ? (
                    <button className="ml-2 text-xs underline" onClick={() => onMakeRecurring?.()}>Save as pattern</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {err ? <div className="text-xs text-rose-400">{err}</div> : null}
      </div>
    </EntryCard>
  );
}
