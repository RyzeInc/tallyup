"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ToastProvider";
import * as Lucide from "lucide-react";
import { centsToDollars } from "@/components/utils";
import type { Id, Doc } from "convex/_generated/dataModel";

type DeleteTarget = {
  type: "account" | "entry";
  id: string;
  name: string;
} | null;

type ArchivedAccount = Doc<"accounts"> & { isArchived?: boolean };
type ArchivedEntry = Doc<"entries"> & { isArchived?: boolean };

export default function ArchivedPage() {
  const toast = useToast();
  const archivedAccounts = useQuery(api.accounts.listAccounts, { includeArchived: true }) || [];
  const archivedOnly = (archivedAccounts as ArchivedAccount[]).filter((a) => a.isArchived);

  const archivedEntries = (useQuery(api.entries.listArchivedEntries, {}) || []) as ArchivedEntry[];

  const restoreAccount = useMutation(api.accounts.restoreAccount);
  const restoreEntry = useMutation(api.entries.restoreEntry);
  const permanentDeleteAccount = useMutation(api.accounts.permanentDeleteAccount);
  const permanentDeleteEntry = useMutation(api.entries.permanentDeleteEntry);

  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    setDeleteTarget(null);
    setDeleting(id);
    
    try {
      if (type === "account") {
        await permanentDeleteAccount({ id: id as Id<"accounts">, force: true });
        toast?.success("Account permanently deleted");
      } else {
        await permanentDeleteEntry({ id: id as Id<"entries"> });
        toast?.success("Transaction permanently deleted");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to delete ${type}`;
      toast?.error(`Failed to delete ${type}`, { description: msg });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Archive" subtitle="Restore or permanently delete archived items" />

      <section className="mt-6">
        <h3 className="text-lg font-medium" style={{ color: "var(--text)" }}>Archived Accounts</h3>
        {archivedOnly.length === 0 ? (
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>No archived accounts.</p>
        ) : (
          <ul className="space-y-3 mt-3">
            {archivedOnly.map((a) => (
              <li 
                key={a._id} 
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--surface-subtle)" }}
                  >
                    <Lucide.Building2 className="h-5 w-5" style={{ color: "var(--text-tertiary)" }} />
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: "var(--text)" }}>{a.name}</div>
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.institutionName || "Manual account"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setRestoring(a._id);
                      try {
                        const res = await restoreAccount({ id: a._id });
                        if (res && res.restored) {
                          toast?.success("Account restored");
                        }
                      } catch {
                        toast?.error("Failed to restore account");
                      } finally {
                        setRestoring(null);
                      }
                    }}
                    disabled={restoring === a._id || deleting === a._id}
                    className="py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                    style={{ 
                      backgroundColor: "var(--primary)", 
                      color: "var(--primary-foreground)",
                      opacity: restoring === a._id ? 0.5 : 1
                    }}
                  >
                    {restoring === a._id ? "Restoring..." : "Restore"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: "account", id: a._id, name: a.name })}
                    disabled={restoring === a._id || deleting === a._id}
                    className="py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                    style={{ 
                      backgroundColor: "var(--danger-subtle)", 
                      color: "var(--danger)",
                      opacity: deleting === a._id ? 0.5 : 1
                    }}
                  >
                    {deleting === a._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-lg font-medium" style={{ color: "var(--text)" }}>Archived Transactions</h3>
        {archivedEntries.length === 0 ? (
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>No archived transactions.</p>
        ) : (
          <ul className="space-y-2 mt-3">
            {archivedEntries.map((e) => {
              const isIncome = e.type === "income";
              const isTransfer = e.type === "transfer";
              return (
                <li 
                  key={e._id} 
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div 
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ 
                        backgroundColor: isIncome ? "var(--success-subtle)" : isTransfer ? "var(--accent-subtle)" : "var(--surface-subtle)" 
                      }}
                    >
                      {isIncome ? (
                        <Lucide.ArrowDownLeft className="h-4 w-4" style={{ color: "var(--success)" }} />
                      ) : isTransfer ? (
                        <Lucide.ArrowLeftRight className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      ) : (
                        <Lucide.ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {e.merchant ?? e.category ?? e.note ?? "Untitled"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        <span className="mx-1">·</span>
                        <span style={{ color: isIncome ? "var(--success)" : "var(--text-secondary)" }}>
                          {isIncome ? "+" : isTransfer ? "" : "−"}{centsToDollars(e.amountCents)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        setRestoring(e._id);
                        try {
                          const res = await restoreEntry({ id: e._id });
                          if (res && res.restored) {
                            toast?.success("Transaction restored");
                          }
                        } catch {
                          toast?.error("Failed to restore transaction");
                        } finally {
                          setRestoring(null);
                        }
                      }}
                      disabled={restoring === e._id || deleting === e._id}
                      className="py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ 
                        backgroundColor: "var(--primary)", 
                        color: "var(--primary-foreground)",
                        opacity: restoring === e._id ? 0.5 : 1
                      }}
                    >
                      {restoring === e._id ? "..." : "Restore"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ 
                        type: "entry", 
                        id: e._id, 
                        name: e.merchant ?? e.category ?? e.note ?? "Transaction" 
                      })}
                      disabled={restoring === e._id || deleting === e._id}
                      className="py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ 
                        backgroundColor: "var(--danger-subtle)", 
                        color: "var(--danger)",
                        opacity: deleting === e._id ? 0.5 : 1
                      }}
                    >
                      {deleting === e._id ? "..." : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Back to settings link */}
      <div className="mt-8">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          <Lucide.ChevronLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div 
            className="relative w-full max-w-sm rounded-xl p-6 shadow-xl"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>
              {deleteTarget.type === "account" ? "Delete Account?" : "Delete Transaction?"}
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              {deleteTarget.type === "account" 
                ? `Permanently delete "${deleteTarget.name}" and all its transactions? This cannot be undone.`
                : `Permanently delete "${deleteTarget.name}"? This cannot be undone.`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!!deleting}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--danger)", color: "white" }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
