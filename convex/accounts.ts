import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

async function requireUserId(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

async function getLatestSnapshot(
  ctx: QueryCtx,
  accountId: Id<"accounts">,
  endExclusive: number
) {
  const rows = await ctx.db
    .query("accountSnapshots")
    .withIndex("by_account_asOf", (q) =>
      q.eq("accountId", accountId).lt("asOf", endExclusive)
    )
    .order("desc")
    .take(1);
  return rows[0] ?? null;
}

async function getSnapshotInRange(
  ctx: QueryCtx,
  accountId: Id<"accounts">,
  start: number,
  endExclusive: number,
  direction: "asc" | "desc"
) {
  const rows = await ctx.db
    .query("accountSnapshots")
    .withIndex("by_account_asOf", (q) =>
      q.eq("accountId", accountId).gte("asOf", start).lt("asOf", endExclusive)
    )
    .order(direction)
    .take(1);
  return rows[0] ?? null;
}

async function getSnapshotBefore(ctx: QueryCtx, accountId: Id<"accounts">, before: number) {
  const rows = await ctx.db
    .query("accountSnapshots")
    .withIndex("by_account_asOf", (q) =>
      q.eq("accountId", accountId).lt("asOf", before)
    )
    .order("desc")
    .take(1);
  return rows[0] ?? null;
}

// ============================================
// ACCOUNTS QUERIES & MUTATIONS
// ============================================

export const listAccounts = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    selectorOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    let accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (!args.includeArchived) {
      accounts = accounts.filter((a) => !a.isArchived);
    }
    if (args.selectorOnly) {
      accounts = accounts.filter((a) => a.showInTransactionSelector !== false);
    }

    return accounts.sort((a, b) => {
      const aTime = a.createdAt ?? 0;
      const bTime = b.createdAt ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getAccount = query({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) return null;
    return account;
  },
});

export const createAccount = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("credit"),
      v.literal("checking"),
      v.literal("savings"),
      v.literal("investment"),
      v.literal("loan"),
      v.literal("business"),
      v.literal("other")
    ),
    institutionName: v.optional(v.string()),
    logoKey: v.optional(v.string()),
    last4: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
    apr: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    minPayment: v.optional(v.number()),
    valuationMode: v.optional(v.union(v.literal("totalOnly"))),
    showInTransactionSelector: v.optional(v.boolean()),
    initialBalance: v.number(),
    asOf: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const initialBalance = Math.round(args.initialBalance);
    if (!Number.isFinite(initialBalance)) {
      throw new Error("Balance must be a number");
    }

    const accountId = await ctx.db.insert("accounts", {
      userId,
      name: args.name.trim(),
      type: args.type,
      institutionName: args.institutionName?.trim() || undefined,
      logoKey: args.logoKey?.trim() || undefined,
      last4: args.last4?.trim() || undefined,
      creditLimit: args.creditLimit,
      apr: args.apr,
      interestRate: args.interestRate,
      minPayment: args.minPayment,
      valuationMode: args.valuationMode ?? "totalOnly",
      showInTransactionSelector: args.showInTransactionSelector ?? true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("accountSnapshots", {
      userId,
      accountId,
      asOf: args.asOf ?? now,
      balance: initialBalance,
      createdAt: now,
    });

    return { ok: true, id: accountId };
  },
});

export const updateAccount = mutation({
  args: {
    id: v.id("accounts"),
    name: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("credit"),
        v.literal("checking"),
        v.literal("savings"),
        v.literal("investment"),
        v.literal("loan"),
        v.literal("business"),
        v.literal("other")
      )
    ),
    institutionName: v.optional(v.string()),
    logoKey: v.optional(v.string()),
    last4: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
    apr: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    minPayment: v.optional(v.number()),
    valuationMode: v.optional(v.union(v.literal("totalOnly"))),
    showInTransactionSelector: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.type !== undefined) patch.type = args.type;
    if (args.institutionName !== undefined) {
      patch.institutionName = args.institutionName.trim() || undefined;
    }
    if (args.logoKey !== undefined) {
      patch.logoKey = args.logoKey.trim() || undefined;
    }
    if (args.last4 !== undefined) patch.last4 = args.last4.trim() || undefined;
    if (args.creditLimit !== undefined) patch.creditLimit = args.creditLimit;
    if (args.apr !== undefined) patch.apr = args.apr;
    if (args.interestRate !== undefined) patch.interestRate = args.interestRate;
    if (args.minPayment !== undefined) patch.minPayment = args.minPayment;
    if (args.valuationMode !== undefined) patch.valuationMode = args.valuationMode;
    if (args.showInTransactionSelector !== undefined) {
      patch.showInTransactionSelector = args.showInTransactionSelector;
    }
    if (args.isArchived !== undefined) patch.isArchived = args.isArchived;

    await ctx.db.patch(args.id, patch);
  },
});

export const addAccountSnapshot = mutation({
  args: {
    accountId: v.id("accounts"),
    asOf: v.optional(v.number()),
    balance: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }

    const now = Date.now();
    const balance = Math.round(args.balance);
    if (!Number.isFinite(balance)) {
      throw new Error("Balance must be a number");
    }
    await ctx.db.insert("accountSnapshots", {
      userId,
      accountId: args.accountId,
      asOf: args.asOf ?? now,
      balance,
      createdAt: now,
    });
  },
});

export const addAccountSnapshots = mutation({
  args: {
    asOf: v.optional(v.number()),
    updates: v.array(
      v.object({
        accountId: v.id("accounts"),
        balance: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const asOf = args.asOf ?? now;

    for (const update of args.updates) {
      const account = await ctx.db.get(update.accountId);
      if (!account || account.userId !== userId) {
        throw new Error("Account not found");
      }
      const balance = Math.round(update.balance);
      if (!Number.isFinite(balance)) {
        throw new Error("Balance must be a number");
      }
      await ctx.db.insert("accountSnapshots", {
        userId,
        accountId: update.accountId,
        asOf,
        balance,
        createdAt: now,
      });
    }
  },
});

export const listAccountSnapshots = query({
  args: {
    accountId: v.id("accounts"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId) return [];

    const start = args.startDate ?? 0;
    const endExclusive = (args.endDate ?? Date.now()) + 1;
    const limit = Math.min(Math.max(args.limit ?? 400, 20), 1200);

    const rows = await ctx.db
      .query("accountSnapshots")
      .withIndex("by_account_asOf", (q) =>
        q.eq("accountId", args.accountId).gte("asOf", start).lt("asOf", endExclusive)
      )
      .order("desc")
      .take(limit);

    return rows;
  },
});

export const getAccountWithSnapshots = query({
  args: {
    accountId: v.id("accounts"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId) return null;

    const start = args.startDate ?? 0;
    const endExclusive = (args.endDate ?? Date.now()) + 1;
    const limit = Math.min(Math.max(args.limit ?? 400, 20), 1200);

    const latestSnapshot = await getLatestSnapshot(ctx, args.accountId, endExclusive);
    const snapshots = await ctx.db
      .query("accountSnapshots")
      .withIndex("by_account_asOf", (q) =>
        q.eq("accountId", args.accountId).gte("asOf", start).lt("asOf", endExclusive)
      )
      .order("desc")
      .take(limit);

    return { account, latestSnapshot, snapshots };
  },
});

export const getAccountsOverview = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const endExclusive = args.endDate + 1;

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeAccounts = accounts.filter((a) => !a.isArchived);

    let assetsTotal = 0;
    let debtTotal = 0;
    let asOf = 0;

    let assetsStart = 0;
    let assetsEnd = 0;
    let assetsCount = 0;

    let debtStart = 0;
    let debtEnd = 0;
    let debtCount = 0;

    const enriched = [];

    for (const account of activeAccounts) {
      const latestSnapshot = await getLatestSnapshot(ctx, account._id, endExclusive);
      const endSnapshot = await getSnapshotInRange(
        ctx,
        account._id,
        args.startDate,
        endExclusive,
        "desc"
      );
      const earliestInRange = await getSnapshotInRange(
        ctx,
        account._id,
        args.startDate,
        endExclusive,
        "asc"
      );
      let startSnapshot = earliestInRange;
      if (endSnapshot && earliestInRange && earliestInRange.asOf === endSnapshot.asOf) {
        startSnapshot = await getSnapshotBefore(ctx, account._id, args.startDate);
      }

      const latestBalance = latestSnapshot?.balance ?? null;
      const latestAsOf = latestSnapshot?.asOf ?? null;
      if (latestAsOf && latestAsOf > asOf) asOf = latestAsOf;

      const isDebt = account.type === "credit" || account.type === "loan";
      const balanceForTotals = latestBalance ?? 0;

      if (isDebt) {
        debtTotal += Math.abs(balanceForTotals);
      } else {
        assetsTotal += balanceForTotals;
      }

      let changePct: number | null = null;
      if (
        startSnapshot &&
        endSnapshot &&
        startSnapshot.asOf !== endSnapshot.asOf &&
        startSnapshot.balance !== 0
      ) {
        changePct =
          (endSnapshot.balance - startSnapshot.balance) / Math.abs(startSnapshot.balance);
      }

      if (startSnapshot && endSnapshot && startSnapshot.asOf !== endSnapshot.asOf) {
        if (isDebt) {
          debtStart += Math.abs(startSnapshot.balance);
          debtEnd += Math.abs(endSnapshot.balance);
          debtCount += 1;
        } else {
          assetsStart += startSnapshot.balance;
          assetsEnd += endSnapshot.balance;
          assetsCount += 1;
        }
      }

      enriched.push({
        ...account,
        latestSnapshot,
        changePct,
      });
    }

    let assetsChangePct: number | null = null;
    if (assetsCount > 0 && assetsStart !== 0) {
      assetsChangePct = (assetsEnd - assetsStart) / Math.abs(assetsStart);
    }

    let debtChangePct: number | null = null;
    if (debtCount > 0 && debtStart !== 0) {
      debtChangePct = (debtEnd - debtStart) / Math.abs(debtStart);
    }

    return {
      accounts: enriched,
      totals: {
        assets: assetsTotal,
        debt: debtTotal,
        netWorth: assetsTotal - debtTotal,
        asOf: asOf || null,
        assetsChangePct,
        debtChangePct,
      },
    };
  },
});
