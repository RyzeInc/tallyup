import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { cashMovement, countsInBudget, countsInCashflow } from "../lib/finance/semantics";

type Entry = Doc<"entries">;

export async function validateEntryLinks(ctx: MutationCtx, userId: string, links: {
  accountId?: Id<"accounts"> | null; goalId?: Id<"goals"> | null;
  budgetCategoryId?: Id<"budgetCategories"> | null; categoryId?: Id<"categories"> | null;
  subcategoryId?: Id<"categories"> | null; recurringRuleId?: Id<"recurringRules"> | null;
  originalEntryId?: Id<"entries"> | null;
  splitParts?: { budgetCategoryId?: Id<"budgetCategories">; amountCents: number }[];
}) {
  for (const id of [links.accountId, links.goalId, links.budgetCategoryId, links.categoryId,
    links.subcategoryId, links.recurringRuleId, links.originalEntryId,
    ...(links.splitParts ?? []).map(part => part.budgetCategoryId)]) {
    if (!id) continue;
    const record = await ctx.db.get(id);
    if (!record || record.userId !== userId) throw new Error("A linked account, category, or record is unavailable.");
    if (("isArchived" in record && record.isArchived) || ("archived" in record && record.archived)) {
      throw new Error("Restore archived records before linking new activity to them.");
    }
  }
}

async function adjustBalance(ctx: MutationCtx, userId: string, accountId: Id<"accounts"> | undefined, delta: number) {
  if (!accountId || !delta) return;
  const account = await ctx.db.get(accountId);
  if (!account || account.userId !== userId || account.isLinked) return;
  const snapshot = await ctx.db.query("accountSnapshots")
    .withIndex("by_account_asOf", q => q.eq("accountId", accountId)).order("desc").first();
  const now = Date.now();
  // Never rewrite a historical snapshot when today's transaction changes.
  await ctx.db.insert("accountSnapshots", { userId, accountId, balance: (snapshot?.balance ?? 0) + delta,
    asOf: Math.max(now, snapshot?.asOf ?? now), createdAt: now });
}

function previousBalanceImpact(entry?: Entry): number {
  if (!entry || entry.isArchived) return 0;
  if (entry.balanceImpactCents !== undefined) return entry.balanceImpactCents;
  // Older builds only applied ordinary, non-excluded income/expense amounts.
  // Reverse what was actually applied, not what the new rules would have applied.
  if (entry.type === "transfer" || entry.excludeFromTotals) return 0;
  return entry.type === "income" ? entry.amountCents : -entry.amountCents;
}

export async function syncEntryBalance(ctx: MutationCtx, before: Entry | undefined, after: Entry | undefined) {
  const userId = (after ?? before)!.userId;
  let nextImpact = 0;
  if (after?.accountId) {
    const account = await ctx.db.get(after.accountId);
    if (account?.userId === userId && !account.isLinked) {
      const isDebt = account.type === "credit" || account.type === "loan";
      nextImpact = cashMovement(after) * (isDebt ? -1 : 1);
    }
  }
  const oldImpact = previousBalanceImpact(before);
  if (before?.accountId === after?.accountId) {
    await adjustBalance(ctx, userId, after?.accountId, nextImpact - oldImpact);
  } else {
    await adjustBalance(ctx, userId, before?.accountId, -oldImpact);
    await adjustBalance(ctx, userId, after?.accountId, nextImpact);
  }
  if (after) await ctx.db.patch(after._id, { balanceImpactCents: nextImpact });
}

export async function dirtyEntryBudgets(ctx: MutationCtx, entry: Entry, reason: string) {
  if (!countsInBudget(entry)) return;
  const ids = new Set([entry.budgetCategoryId, ...(entry.splitParts ?? []).map(part => part.budgetCategoryId)]);
  for (const budgetCategoryId of ids) {
    if (!budgetCategoryId) continue;
    const now = Date.now();
    await ctx.db.insert("budgetDirtyQueue", { userId: entry.userId, budgetCategoryId, dirtyDate: entry.date,
      reason, status: "pending", createdAt: now, updatedAt: now });
  }
}

async function goalDelta(ctx: MutationCtx, userId: string, goalId: Id<"goals">, delta: number) {
  const goal = await ctx.db.get(goalId);
  if (!goal || goal.userId !== userId || !delta) return;
  await ctx.db.patch(goalId, { currentAmountCents: Math.max(0, goal.currentAmountCents + delta), updatedAt: Date.now() });
}

/** Replace this entry's whole contribution set, including multiple automatic allocations. */
export async function syncEntryGoals(ctx: MutationCtx, before: Entry | undefined, after: Entry | undefined) {
  const entry = (after ?? before)!;
  const contributions = await ctx.db.query("goalContributions")
    .withIndex("by_entry", q => q.eq("entryId", entry._id)).collect();
  const previous = new Map<Id<"goals">, number>();
  for (const contribution of contributions) {
    if (contribution.userId !== entry.userId) continue;
    previous.set(contribution.goalId, (previous.get(contribution.goalId) ?? 0) + contribution.amountCents);
  }
  const desired = new Map<Id<"goals">, number>();
  if (after && after.type === "income" && countsInCashflow(after)) {
    if (after.goalId) {
      desired.set(after.goalId, after.amountCents);
    } else {
      const goals = await ctx.db.query("goals").withIndex("by_user", q => q.eq("userId", entry.userId)).collect();
      const category = (after.category ?? after.bucket ?? "").trim().toLowerCase();
      let remainingIncome = after.amountCents;
      // Deterministic priority prevents a set of allocations from exceeding actual income.
      goals.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.createdAt - b.createdAt || a._id.localeCompare(b._id));
      for (const goal of goals) {
        if (goal.archived || goal.status !== "active" || !goal.autoAllocateEnabled ||
          !goal.fundingIncomeCategories?.some(value => value.trim().toLowerCase() === category)) continue;
        const base = Math.max(0, goal.currentAmountCents - (previous.get(goal._id) ?? 0));
        const percent = Math.min(100, Math.max(0, goal.autoAllocatePercent ?? 10));
        const amount = Math.min(remainingIncome, Math.max(0, goal.targetAmountCents - base), Math.round(after.amountCents * percent / 100));
        if (amount > 0) { desired.set(goal._id, amount); remainingIncome -= amount; }
      }
    }
  }
  for (const goalId of new Set([...previous.keys(), ...desired.keys()])) {
    await goalDelta(ctx, entry.userId, goalId, (desired.get(goalId) ?? 0) - (previous.get(goalId) ?? 0));
  }
  for (const contribution of contributions) {
    if (contribution.userId === entry.userId) await ctx.db.delete(contribution._id);
  }
  if (after) for (const [goalId, amountCents] of desired) {
    await ctx.db.insert("goalContributions", { userId: after.userId, entryId: after._id, goalId,
      amountCents, date: after.date, createdAt: Date.now() });
  }
}

export async function applyEntryCreated(ctx: MutationCtx, entry: Entry) {
  await syncEntryBalance(ctx, undefined, entry);
  await syncEntryGoals(ctx, undefined, entry);
  await dirtyEntryBudgets(ctx, entry, "entry_created");
}

/** The same cleanup is used by individual, account, recurring-series, and archive deletion. */
export async function removeEntry(ctx: MutationCtx, userId: string, id: Id<"entries">, removePair = true): Promise<boolean> {
  const entry = await ctx.db.get(id);
  if (!entry) return false;
  if (entry.userId !== userId) throw new Error("Entry not found");
  if (entry.transferId && removePair) {
    const transfer = await ctx.db.get(entry.transferId);
    if (transfer?.userId === userId) {
      for (const pairId of [transfer.fromEntryId, transfer.toEntryId]) {
        if (pairId && pairId !== id) await removeEntry(ctx, userId, pairId, false);
      }
      await ctx.db.delete(transfer._id);
    }
  }
  await syncEntryBalance(ctx, entry, undefined);
  await syncEntryGoals(ctx, entry, undefined);
  await dirtyEntryBudgets(ctx, entry, "entry_deleted");
  const impacts = await ctx.db.query("budgetEntryImpacts").withIndex("by_entry", q => q.eq("entryId", id)).collect();
  for (const impact of impacts) if (impact.userId === userId) await ctx.db.delete(impact._id);
  const charges = await ctx.db.query("expectedCharges").withIndex("by_user_date", q => q.eq("userId", userId))
    .filter(q => q.eq(q.field("matchedEntryId"), id)).collect();
  for (const charge of charges) await ctx.db.patch(charge._id, { matchedEntryId: undefined,
    state: charge.expectedDate > Date.now() ? "upcoming" : "due", resolvedAt: undefined,
    resolutionNote: "Matched transaction removed" });
  const refunds = await ctx.db.query("entries").withIndex("by_user_date", q => q.eq("userId", userId))
    .filter(q => q.eq(q.field("originalEntryId"), id)).collect();
  for (const refund of refunds) await ctx.db.patch(refund._id, { originalEntryId: undefined });
  const inbox = await ctx.db.query("recurringInbox").withIndex("by_user_status", q => q.eq("userId", userId))
    .filter(q => q.eq(q.field("entryId"), id)).collect();
  for (const item of inbox) await ctx.db.patch(item._id, { status: "dismissed", resolvedAt: Date.now() });
  await ctx.db.delete(id);
  return true;
}
