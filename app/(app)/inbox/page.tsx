"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import EntryCard from "@/components/EntryCard";
import TagChips from "@/components/TagChips";
import RecurringModal from "@/components/RecurringModal";
import { DEFAULT_TAGS, cacheKey, uniqCaseInsensitive } from "@/components/utils";

export default function InboxPage() {
  const { user } = useUser();
  const inbox = useQuery(api.entries.listInbox, { limit: 80 }) as any[] | undefined;

  // Use both types for suggestions
  const expenseCats = useQuery(api.entries.listCategories, { type: "expense", bucket: undefined }) as string[] | undefined;
  const incomeCats = useQuery(api.entries.listCategories, { type: "income", bucket: undefined }) as string[] | undefined;

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
      <div className="mb-4">
        <div className="text-2xl font-semibold tracking-tight">Inbox</div>
        <div className="mt-1 text-sm text-neutral-400">Finish labeling to improve accuracy.</div>
        <div className="mt-2 text-sm text-neutral-400">Tip: You can mark an entry as recurring to link similar future transactions (autolink is optional and requires confirmation).</div>
      </div>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm text-neutral-300 mb-3">Sign in to view your inbox.</div>
          <SignInButton mode="modal">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {!inbox ? (
          <div className="text-sm text-neutral-400">Loading…</div>
        ) : inbox.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-300">
            Nothing to review 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {inbox.map((e) => (
              <InboxItem key={e._id} entry={e} onUpdate={updateEntry} catSuggestions={catSuggestions} onMakeRecurring={() => setSelected(e)} />
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
  const [category, setCategory] = useState(entry.category ?? "");
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
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
            Make recurring
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
          <div className="text-xs text-neutral-400 mb-1">Category</div>
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
          <div className="text-xs text-neutral-400 mb-2">Tags</div>
          <TagChips value={tags} onChange={setTags} options={DEFAULT_TAGS as unknown as string[]} />
        </div>

        {err ? <div className="text-xs text-rose-400">{err}</div> : null}
      </div>
    </EntryCard>
  );
}
