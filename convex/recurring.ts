import { mutation, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { Entry as DetectorEntry } from "./detector";
import { normalizeMerchant } from "./merchant";

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };
type RecurringRuleDoc = Doc<"recurringRules">;
type CadenceKind =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom_days";

function resolveCadence(rule: RecurringRuleDoc): { kind: CadenceKind; intervalDays?: number; anchorDate?: number } {
  if (rule.cadence?.kind) return rule.cadence;
  if (rule.cadenceType) {
    switch (rule.cadenceType) {
      case "weekly":
        return { kind: "weekly" };
      case "biweekly":
        return { kind: "biweekly" };
      case "quarterly":
        return { kind: "quarterly" };
      case "yearly":
        return { kind: "yearly" };
      case "custom":
        return { kind: "custom_days", intervalDays: rule.intervalDays ?? 30 };
      case "semiMonthly":
        return { kind: "custom_days", intervalDays: 15 };
      case "monthly":
      default:
        return { kind: "monthly" };
    }
  }
  if (rule.intervalType) {
    switch (rule.intervalType) {
      case "daily":
        return { kind: "custom_days", intervalDays: 1 };
      case "weekly":
        return { kind: "weekly" };
      case "custom":
        return { kind: "custom_days", intervalDays: rule.intervalDays ?? 30 };
      case "monthly":
      default:
        return { kind: "monthly" };
    }
  }
  return { kind: "monthly" };
}

function addDays(ts: number, days: number): number {
  return ts + days * 24 * 60 * 60 * 1000;
}

function addMonths(ts: number, months: number): number {
  const d = new Date(ts);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month overflow (e.g., Jan 31 -> Feb 28/29)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d.getTime();
}

function nextExpectedDate(start: number, cadence: { kind: CadenceKind; intervalDays?: number }): number {
  switch (cadence.kind) {
    case "weekly":
      return addDays(start, 7);
    case "biweekly":
      return addDays(start, 14);
    case "quarterly":
      return addMonths(start, 3);
    case "yearly":
      return addMonths(start, 12);
    case "custom_days":
      return addDays(start, cadence.intervalDays ?? 30);
    case "monthly":
    default:
      return addMonths(start, 1);
  }
}

async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

function cleanStr(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t.length ? t : undefined;
}

export const createRecurringRule = mutation({
  args: {
    type: v.union(v.literal("expense"), v.literal("income")),
    displayName: v.optional(v.string()),
    name: v.optional(v.string()),
    bucket: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    amountCents: v.optional(v.number()),
    minAmountCents: v.optional(v.number()),
    maxAmountCents: v.optional(v.number()),
    amountTolerancePercent: v.optional(v.number()),
    amountMode: v.optional(v.union(v.literal("fixed"), v.literal("range"), v.literal("unknown"))),
    intervalType: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("custom"))),
    intervalDays: v.optional(v.number()),
    cadenceType: v.optional(v.union(v.literal("weekly"), v.literal("biweekly"), v.literal("semiMonthly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"), v.literal("custom"))),
    cadenceAnchor: v.optional(v.string()),
    timingFlexDays: v.optional(v.number()),
    autolinkEnabled: v.optional(v.boolean()),
    note: v.optional(v.string()),
    active: v.optional(v.boolean()),
    status: v.optional(v.union(
      v.literal("suggested"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("archived")
    )),
    merchantKeys: v.optional(v.array(v.string())),
    accountScope: v.optional(v.object({
      kind: v.union(v.literal("any"), v.literal("only")),
      accountIds: v.optional(v.array(v.id("accounts"))),
    })),
    amountPolicy: v.optional(v.object({
      kind: v.union(v.literal("fixed"), v.literal("range"), v.literal("variable")),
      amountCents: v.optional(v.number()),
      minCents: v.optional(v.number()),
      maxCents: v.optional(v.number()),
      toleranceBps: v.optional(v.number()),
    })),
    cadence: v.optional(v.object({
      kind: v.union(
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly"),
        v.literal("custom_days")
      ),
      intervalDays: v.optional(v.number()),
      anchorDate: v.optional(v.number()),
    })),
    budgetBehavior: v.optional(v.object({
      committed: v.boolean(),
      rollupKey: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    if (args.intervalType === undefined && args.intervalDays === undefined && args.cadenceType === undefined) {
      // it's fine to not define cadence at creation; detection can fill this in later
    }

    const now = Date.now();
    const active = args.active === undefined ? true : !!args.active;
    const status = args.status ?? (active ? "active" : "paused");

    const id = await ctx.db.insert("recurringRules", {
      userId,
      type: args.type,
      displayName: cleanStr(args.displayName),
      name: cleanStr(args.name),
      bucket: cleanStr(args.bucket),
      category: cleanStr(args.category),
      tags: args.tags?.map(t => t.trim()).filter(Boolean) || undefined,
      amountCents: args.amountCents,
      minAmountCents: args.minAmountCents,
      maxAmountCents: args.maxAmountCents,
      amountTolerancePercent: args.amountTolerancePercent,
      amountMode: args.amountMode,
      intervalType: args.intervalType,
      intervalDays: args.intervalDays,
      cadenceType: args.cadenceType,
      cadenceAnchor: cleanStr(args.cadenceAnchor),
      timingFlexDays: args.timingFlexDays,
      status,
      merchantKeys: args.merchantKeys?.map(k => normalizeMerchant(k)).filter(Boolean) as string[] | undefined,
      accountScope: args.accountScope,
      amountPolicy: args.amountPolicy,
      cadence: args.cadence,
      budgetBehavior: args.budgetBehavior,
      autolinkEnabled: args.autolinkEnabled === undefined ? false : !!args.autolinkEnabled,
      lastMatchedAt: undefined,
      active,
      confidence: 0,
      note: cleanStr(args.note),
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, id };
  },
});

export const updateRecurringRule = mutation({
  args: {
    id: v.id("recurringRules"),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    displayName: v.optional(v.string()),
    name: v.optional(v.string()),
    bucket: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    amountCents: v.optional(v.number()),
    minAmountCents: v.optional(v.number()),
    maxAmountCents: v.optional(v.number()),
    amountTolerancePercent: v.optional(v.number()),
    amountMode: v.optional(v.union(v.literal("fixed"), v.literal("range"), v.literal("unknown"))),
    intervalType: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("custom"))),
    intervalDays: v.optional(v.number()),
    cadenceType: v.optional(v.union(v.literal("weekly"), v.literal("biweekly"), v.literal("semiMonthly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"), v.literal("custom"))),
    cadenceAnchor: v.optional(v.string()),
    timingFlexDays: v.optional(v.number()),
    autolinkEnabled: v.optional(v.boolean()),
    note: v.optional(v.string()),
    active: v.optional(v.boolean()),
    status: v.optional(v.union(
      v.literal("suggested"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("archived")
    )),
    merchantKeys: v.optional(v.array(v.string())),
    accountScope: v.optional(v.object({
      kind: v.union(v.literal("any"), v.literal("only")),
      accountIds: v.optional(v.array(v.id("accounts"))),
    })),
    amountPolicy: v.optional(v.object({
      kind: v.union(v.literal("fixed"), v.literal("range"), v.literal("variable")),
      amountCents: v.optional(v.number()),
      minCents: v.optional(v.number()),
      maxCents: v.optional(v.number()),
      toleranceBps: v.optional(v.number()),
    })),
    cadence: v.optional(v.object({
      kind: v.union(
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly"),
        v.literal("custom_days")
      ),
      intervalDays: v.optional(v.number()),
      anchorDate: v.optional(v.number()),
    })),
    budgetBehavior: v.optional(v.object({
      committed: v.boolean(),
      rollupKey: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");

    const patch: Partial<RecurringRuleDoc> & { updatedAt: number } = { updatedAt: Date.now() };
    if (args.type !== undefined) patch.type = args.type;
    if (args.displayName !== undefined) patch.displayName = cleanStr(args.displayName);
    if (args.name !== undefined) patch.name = cleanStr(args.name);
    if (args.bucket !== undefined) patch.bucket = cleanStr(args.bucket);
    if (args.category !== undefined) patch.category = cleanStr(args.category);
    if (args.tags !== undefined) patch.tags = args.tags?.map(t => t.trim()).filter(Boolean) || undefined;
    if (args.amountCents !== undefined) patch.amountCents = Math.round(args.amountCents);
    if (args.minAmountCents !== undefined) patch.minAmountCents = Math.round(args.minAmountCents);
    if (args.maxAmountCents !== undefined) patch.maxAmountCents = Math.round(args.maxAmountCents);
    if (args.amountTolerancePercent !== undefined) patch.amountTolerancePercent = args.amountTolerancePercent;
    if (args.amountMode !== undefined) patch.amountMode = args.amountMode;
    if (args.intervalType !== undefined) patch.intervalType = args.intervalType;
    if (args.intervalDays !== undefined) patch.intervalDays = args.intervalDays;
    if (args.cadenceType !== undefined) patch.cadenceType = args.cadenceType;
    if (args.cadenceAnchor !== undefined) patch.cadenceAnchor = cleanStr(args.cadenceAnchor);
    if (args.timingFlexDays !== undefined) patch.timingFlexDays = args.timingFlexDays;
    if (args.autolinkEnabled !== undefined) patch.autolinkEnabled = args.autolinkEnabled;
    if (args.note !== undefined) patch.note = cleanStr(args.note);
    if (args.active !== undefined) patch.active = args.active;
    if (args.status !== undefined) patch.status = args.status;
    if (args.merchantKeys !== undefined) {
      const mapped = args.merchantKeys.map((k) => normalizeMerchant(k)).filter((s): s is string => !!s);
      patch.merchantKeys = mapped.length > 0 ? mapped : undefined;
    }
    if (args.accountScope !== undefined) patch.accountScope = args.accountScope;
    if (args.amountPolicy !== undefined) patch.amountPolicy = args.amountPolicy;
    if (args.cadence !== undefined) patch.cadence = args.cadence;
    if (args.budgetBehavior !== undefined) patch.budgetBehavior = args.budgetBehavior;

    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

export const deleteRecurringRule = mutation({
  args: { id: v.id("recurringRules") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.id);
    // Note: we do not automatically remove links from entries here; consider a background backfill
    return { ok: true };
  },
});

export const listRecurringRules = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 200, 10), 1000);

    return await ctx.db
      .query("recurringRules")
      .withIndex("by_user_active", q => q.eq("userId", userId).eq("active", true))
      .order("desc")
      .take(limit);
  },
});

// Candidate detection (stub): returns an array of suggested rules with confidence.
// TODO: implement grouping & interval detection algorithm here.
import { detectRecurringCandidatesFromEntries } from "./detector";

export const detectRecurringCandidates = query({
  args: { lookbackDays: v.optional(v.number()), minConfidence: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const lookbackDays = args.lookbackDays ?? 365;
    const minConfidence = args.minConfidence ?? 50;

    const rows = await ctx.db
      .query("entries")
      .withIndex("by_user_date", q => q.eq("userId", userId))
      .order("asc")
      .take(2000);

    const candidates = detectRecurringCandidatesFromEntries(rows as DetectorEntry[], { lookbackDays, minOccurrences: 3 });
    return candidates.filter(c => c.confidence >= minConfidence).slice(0, 50);
  },
});

export const linkEntriesToRule = mutation({
  args: { ruleId: v.id("recurringRules"), entryIds: v.array(v.id("entries")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== userId) throw new Error("Not found");

    for (const eid of args.entryIds) {
      const existing = await ctx.db.get(eid);
      if (!existing || existing.userId !== userId) continue;
      await ctx.db.patch(eid, { recurringRuleId: args.ruleId, updatedAt: Date.now() });
    }

    // Update lastMatchedAt on rule
    await ctx.db.patch(args.ruleId, { lastMatchedAt: Date.now(), updatedAt: Date.now() });

    return { ok: true };
  },
});

// Backfill action (long-running): examine historical entries, create rules, and optionally link entries.
// Implement as an action so it can be run safely from the server/CLI.
export const backfillRecurringRules = action({
  args: { dryRun: v.optional(v.boolean()), minConfidence: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const minConfidence = args.minConfidence ?? 70;
    const dryRun = !!args.dryRun;

    // collect a sample of recent entries to discover users (use a query via ctx.runQuery)
    const recent = await ctx.runQuery(api.entries.listRecentEntries, { limit: 5000 });
    const userSet = new Set<string>();
    for (const r of recent) userSet.add(r.userId);

    const summary: { users: number; candidates: number; created: number; linked: number } = { users: 0, candidates: 0, created: 0, linked: 0 };

    for (const userId of userSet) {
      summary.users++;
      const rows = await ctx.runQuery(internal.entries.listEntriesForUser, { userId, startDate: 0, endDate: Date.now(), limit: 2000 });

      const candidates = detectRecurringCandidatesFromEntries(rows as DetectorEntry[]);
      for (const c of candidates) {
        summary.candidates++;
        if (c.confidence < minConfidence) continue;

        if (!dryRun) {
          const res = await ctx.runMutation(api.recurring.createRecurringRule, {
            type: c.type,
            displayName: `${c.bucket ?? ""} ${c.category ?? ""}`.trim() || undefined,
            name: `${c.bucket ?? ""} ${c.category ?? ""}`.trim() || undefined,
            bucket: c.bucket,
            category: c.category,
            tags: undefined,
            amountCents: c.amountCents,
            amountTolerancePercent: c.amountTolerancePercent,
            amountMode: c.amountMode,
            intervalType: c.intervalType,
            intervalDays: c.intervalDays,
            autolinkEnabled: c.confidence >= 80,
            note: "Created by backfill",
            active: true,
          });

          const createdId = res.id;
          summary.created++;

          // link matching entries
          const toLink: Id<"entries">[] = [];
          for (const e of rows) {
            const bucketMatch = ((e.bucket ?? "").trim().toLowerCase() || "") === (c.bucket ?? "").trim().toLowerCase();
            const categoryMatch = ((e.category ?? "").trim().toLowerCase() || "") === (c.category ?? "").trim().toLowerCase();
            let amountMatch = false;
            if (c.amountCents !== undefined && c.amountCents !== null) {
              const tol = c.amountTolerancePercent ?? 0;
              const diff = Math.abs(e.amountCents - c.amountCents);
              amountMatch = tol > 0 ? diff <= Math.max(1, Math.round((c.amountCents * tol) / 100)) : diff === 0;
            } else {
              amountMatch = true;
            }
            if (bucketMatch && categoryMatch && amountMatch) toLink.push(e._id);
          }

          if (toLink.length) {
            await ctx.runMutation(api.recurring.linkEntriesToRule, { ruleId: createdId, entryIds: toLink });
            summary.linked += toLink.length;
          }
        }
      }
    }

    return { ok: true, summary };
  },
});

function getExpectedAmountCents(rule: RecurringRuleDoc): number | undefined {
  if (rule.amountPolicy?.kind === "fixed") {
    return rule.amountPolicy.amountCents ?? rule.amountCents;
  }
  if (rule.amountPolicy?.kind === "range") {
    return rule.amountPolicy.amountCents ?? rule.amountCents;
  }
  if (rule.amountCents !== undefined) return rule.amountCents;
  return undefined;
}

function cadenceWindowDays(kind: CadenceKind): number {
  switch (kind) {
    case "weekly":
      return 2;
    case "biweekly":
      return 3;
    case "quarterly":
      return 7;
    case "yearly":
      return 14;
    case "custom_days":
      return 5;
    case "monthly":
    default:
      return 5;
  }
}

export const listRecurringRulesAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 200, 10), 1000);
    return await ctx.db
      .query("recurringRules")
      .filter(q => q.eq(q.field("userId"), userId))
      .order("desc")
      .take(limit);
  },
});

export const listExpectedCharges = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    states: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const start = args.startDate ?? 0;
    const end = args.endDate ?? Date.now() + 365 * 24 * 60 * 60 * 1000;
    const items = await ctx.db
      .query("expectedCharges")
      .withIndex("by_user_date", q => q.eq("userId", userId).gte("expectedDate", start).lte("expectedDate", end))
      .collect();
    if (!args.states?.length) return items;
    const allowed = new Set(args.states);
    return items.filter(i => allowed.has(i.state));
  },
});

// Enriched expected charges with rule + account data for UI display
export const listExpectedChargesEnriched = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    states: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const start = args.startDate ?? 0;
    const end = args.endDate ?? Date.now() + 365 * 24 * 60 * 60 * 1000;
    const limit = Math.min(args.limit ?? 500, 1000);

    let charges = await ctx.db
      .query("expectedCharges")
      .withIndex("by_user_date", q => q.eq("userId", userId).gte("expectedDate", start).lte("expectedDate", end))
      .take(limit);

    if (args.states?.length) {
      const allowed = new Set(args.states);
      charges = charges.filter(c => allowed.has(c.state));
    }

    // Collect unique ruleIds and fetch rules in batch
    const ruleIds = [...new Set(charges.map(c => c.ruleId))];
    const rulesMap = new Map<string, RecurringRuleDoc>();
    for (const ruleId of ruleIds) {
      const rule = await ctx.db.get(ruleId);
      if (rule) rulesMap.set(ruleId, rule);
    }

    // Collect unique accountIds from rules and fetch accounts
    const accountIds = new Set<Id<"accounts">>();
    for (const rule of rulesMap.values()) {
      if (rule.accountScope?.accountIds?.length) {
        for (const accId of rule.accountScope.accountIds) {
          accountIds.add(accId);
        }
      }
    }
    const accountsMap = new Map<string, { name: string; institutionName?: string; last4?: string }>();
    for (const accId of accountIds) {
      const acc = await ctx.db.get(accId);
      if (acc) {
        accountsMap.set(accId, { name: acc.name, institutionName: acc.institutionName, last4: acc.last4 });
      }
    }

    // Enrich charges with rule/account data
    return charges.map(charge => {
      const rule = rulesMap.get(charge.ruleId);
      const primaryAccountId = rule?.accountScope?.accountIds?.[0];
      const account = primaryAccountId ? accountsMap.get(primaryAccountId) : undefined;
      const cadence = rule ? resolveCadence(rule) : { kind: "monthly" as CadenceKind };

      return {
        ...charge,
        // Rule info
        name: rule?.displayName ?? rule?.name ?? rule?.category ?? "Unknown",
        type: rule?.type ?? "expense",
        category: rule?.category,
        amountCents: charge.expectedAmountCents ?? rule?.amountPolicy?.amountCents ?? rule?.amountCents,
        amountMode: rule?.amountPolicy?.kind ?? rule?.amountMode ?? "unknown",
        cadenceKind: cadence.kind,
        // Account info
        accountName: account?.name,
        institutionName: account?.institutionName,
        accountLast4: account?.last4,
        // Rule status
        ruleStatus: rule?.status ?? "active",
        autolinkEnabled: rule?.autolinkEnabled ?? false,
      };
    });
  },
});

// Get monthly summary stats for the obligations view
export const getObligationsSummary = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const charges = await ctx.db
      .query("expectedCharges")
      .withIndex("by_user_date", q => q.eq("userId", userId).gte("expectedDate", args.startDate).lte("expectedDate", args.endDate))
      .collect();

    // Get rules for amount info
    const ruleIds = [...new Set(charges.map(c => c.ruleId))];
    const rulesMap = new Map<string, RecurringRuleDoc>();
    for (const ruleId of ruleIds) {
      const rule = await ctx.db.get(ruleId);
      if (rule) rulesMap.set(ruleId, rule);
    }

    let expectedTotal = 0;
    let loggedTotal = 0;
    let upcomingCount = 0;
    let dueCount = 0;
    let matchedCount = 0;
    let missedCount = 0;
    let skippedCount = 0;

    for (const charge of charges) {
      const rule = rulesMap.get(charge.ruleId);
      const amount = charge.expectedAmountCents ?? rule?.amountPolicy?.amountCents ?? rule?.amountCents ?? 0;
      expectedTotal += amount;

      switch (charge.state) {
        case "upcoming":
          upcomingCount++;
          break;
        case "due":
          dueCount++;
          break;
        case "matched":
          matchedCount++;
          loggedTotal += amount;
          break;
        case "missed":
          missedCount++;
          break;
        case "skipped":
          skippedCount++;
          break;
      }
    }

    // Get open inbox items count
    const inboxItems = await ctx.db
      .query("recurringInbox")
      .withIndex("by_user_status", q => q.eq("userId", userId).eq("status", "open"))
      .collect();

    return {
      expectedTotal,
      loggedTotal,
      leftToLog: expectedTotal - loggedTotal,
      chargesCount: charges.length,
      upcomingCount,
      dueCount,
      matchedCount,
      missedCount,
      skippedCount,
      attentionCount: inboxItems.length + missedCount + dueCount,
      progressPercent: expectedTotal > 0 ? Math.round((loggedTotal / expectedTotal) * 100) : 0,
    };
  },
});

export const listRecurringInbox = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed"))),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 200, 10), 1000);
    let items = await ctx.db
      .query("recurringInbox")
      .withIndex("by_user_created", q => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    if (args.status) items = items.filter(i => i.status === args.status);
    if (args.type) items = items.filter(i => i.type === args.type);
    return items;
  },
});

export const ensureExpectedCharges = internalMutation({
  args: { ruleId: v.id("recurringRules"), monthsAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) return { ok: false };
    const monthsAhead = Math.max(1, args.monthsAhead ?? 6);
    const cadence = resolveCadence(rule);
    const now = Date.now();
    const anchor = rule.cadence?.anchorDate ?? rule.lastMatchedAt ?? rule.createdAt ?? now;
    let cursor = anchor;
    const windowEnd = addMonths(now, monthsAhead);
    const expectedAmountCents = getExpectedAmountCents(rule);

    while (cursor <= windowEnd) {
      const existing = await ctx.db
        .query("expectedCharges")
        .withIndex("by_user_rule", q => q.eq("userId", rule.userId).eq("ruleId", rule._id))
        .filter(q => q.eq(q.field("expectedDate"), cursor))
        .first();
      if (!existing) {
        await ctx.db.insert("expectedCharges", {
          userId: rule.userId,
          ruleId: rule._id,
          expectedDate: cursor,
          expectedAmountCents,
          state: cursor <= now + 24 * 60 * 60 * 1000 ? "due" : "upcoming",
          generatedAt: now,
          generatedWindow: `${new Date(now).toISOString()}..${new Date(windowEnd).toISOString()}`,
        });
      }
      cursor = nextExpectedDate(cursor, cadence);
    }
    return { ok: true };
  },
});

export const matchEntryToRecurring = internalMutation({
  args: { entryId: v.id("entries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return { ok: false };
    if (entry.excludeFromRecurring) return { ok: true };

    const merchantKey = entry.merchantNormalized ?? normalizeMerchant(entry.merchant ?? undefined);
    const rules = await ctx.db
      .query("recurringRules")
      .withIndex("by_user_active", q => q.eq("userId", entry.userId).eq("active", true))
      .collect();

    let best: { rule: RecurringRuleDoc; score: number; expectedChargeId?: Id<"expectedCharges">; explain: Record<string, unknown> } | null = null;
    let secondScore = 0;

    for (const rule of rules) {
      if (rule.type !== entry.type) continue;
      if (rule.status && rule.status !== "active") continue;
      if (rule.accountScope?.kind === "only" && rule.accountScope.accountIds?.length) {
        if (!entry.accountId || !rule.accountScope.accountIds.includes(entry.accountId)) continue;
      }

      let score = 0;
      const explain: Record<string, unknown> = {};

      if (rule.merchantKeys?.length && merchantKey) {
        if (rule.merchantKeys.includes(merchantKey)) {
          score += 60;
          explain.merchant = "match";
        } else {
          continue;
        }
      }

      const categoryLower = (entry.category ?? "").toLowerCase();
      const bucketLower = (entry.bucket ?? "").toLowerCase();
      if (rule.category && rule.category.toLowerCase() === categoryLower) {
        score += 15;
        explain.category = "match";
      }
      if (rule.bucket && rule.bucket.toLowerCase() === bucketLower) {
        score += 10;
        explain.bucket = "match";
      }

      const amountPolicy = rule.amountPolicy;
      if (amountPolicy?.kind === "fixed" && amountPolicy.amountCents !== undefined) {
        const tolBps = amountPolicy.toleranceBps ?? 300;
        const diff = Math.abs(entry.amountCents - amountPolicy.amountCents);
        const ok = diff <= Math.max(1, Math.round((amountPolicy.amountCents * tolBps) / 10000));
        if (!ok) continue;
        score += 15;
        explain.amount = "fixed";
      } else if (amountPolicy?.kind === "range") {
        const min = amountPolicy.minCents ?? -Infinity;
        const max = amountPolicy.maxCents ?? Infinity;
        if (entry.amountCents < min || entry.amountCents > max) continue;
        score += 10;
        explain.amount = "range";
      } else if (rule.amountCents !== undefined) {
        const tol = rule.amountTolerancePercent ?? 0;
        const diff = Math.abs(entry.amountCents - rule.amountCents);
        const ok = tol > 0 ? diff <= Math.max(1, Math.round((rule.amountCents * tol) / 100)) : diff === 0;
        if (!ok) continue;
        score += 10;
        explain.amount = "legacy";
      }

      const cadence = resolveCadence(rule);
      const windowDays = cadenceWindowDays(cadence.kind);
      const start = entry.date - windowDays * 24 * 60 * 60 * 1000;
      const end = entry.date + windowDays * 24 * 60 * 60 * 1000;
      const occurrence = await ctx.db
        .query("expectedCharges")
        .withIndex("by_user_rule", q => q.eq("userId", entry.userId).eq("ruleId", rule._id))
        .filter(q => q.or(q.eq(q.field("state"), "upcoming"), q.eq(q.field("state"), "due")))
        .filter(q => q.and(q.gte(q.field("expectedDate"), start), q.lte(q.field("expectedDate"), end)))
        .first();
      if (occurrence) {
        score += 15;
        explain.expectedCharge = occurrence._id;
      }

      if (!best || score > best.score) {
        secondScore = best?.score ?? 0;
        best = { rule, score, expectedChargeId: occurrence?._id, explain };
      } else if (score > secondScore) {
        secondScore = score;
      }
    }

    if (!best || best.score < 70) return { ok: true };

    if (secondScore >= best.score - 5) {
      await ctx.db.insert("recurringInbox", {
        userId: entry.userId,
        status: "open",
        type: "confirm_match",
        ruleId: best.rule._id,
        expectedChargeId: best.expectedChargeId,
        entryId: entry._id,
        payload: { score: best.score, explain: best.explain },
        createdAt: Date.now(),
      });
      return { ok: true };
    }

    await ctx.db.patch(entry._id, {
      recurringRuleId: best.rule._id,
      recurringMatch: {
        ruleId: best.rule._id,
        expectedChargeId: best.expectedChargeId,
        matchType: "auto",
        score: best.score,
        explain: best.explain,
      },
      updatedAt: Date.now(),
    });

    if (best.expectedChargeId) {
      await ctx.db.patch(best.expectedChargeId, {
        matchedEntryId: entry._id,
        state: "matched",
        resolvedAt: Date.now(),
      });
    }
    await ctx.db.patch(best.rule._id, { lastMatchedAt: Date.now(), updatedAt: Date.now() });
    return { ok: true };
  },
});

export const reconcileRecurring = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rules = await ctx.db
      .query("recurringRules")
      .withIndex("by_user_active", q => q.eq("userId", args.userId).eq("active", true))
      .collect();

    for (const rule of rules) {
      if (rule.status && rule.status !== "active") continue;
      await ctx.runMutation(internal.recurring.ensureExpectedCharges, { ruleId: rule._id, monthsAhead: 6 });

      const cadence = resolveCadence(rule);
      const graceDays = cadenceWindowDays(cadence.kind);
      const pastDue = now - graceDays * 24 * 60 * 60 * 1000;

      const due = await ctx.db
        .query("expectedCharges")
        .withIndex("by_user_rule", q => q.eq("userId", args.userId).eq("ruleId", rule._id))
        .filter(q => q.or(q.eq(q.field("state"), "due"), q.eq(q.field("state"), "upcoming")))
        .filter(q => q.lt(q.field("expectedDate"), pastDue))
        .collect();

      for (const occ of due) {
        await ctx.db.patch(occ._id, { state: "missed", resolvedAt: now });
        await ctx.db.insert("recurringInbox", {
          userId: args.userId,
          status: "open",
          type: "missed_payment",
          ruleId: rule._id,
          expectedChargeId: occ._id,
          payload: { expectedDate: occ.expectedDate },
          createdAt: now,
        });
      }
    }

    return { ok: true };
  },
});

export const resolveRecurringInbox = mutation({
  args: {
    id: v.id("recurringInbox"),
    resolution: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) throw new Error("Not found");

    if (item.type === "confirm_match") {
      const ruleId = args.resolution?.ruleId as Id<"recurringRules"> | undefined;
      const entryId = args.resolution?.entryId as Id<"entries"> | undefined;
      const expectedChargeId = args.resolution?.expectedChargeId as Id<"expectedCharges"> | undefined;
      if (ruleId && entryId) {
        await ctx.db.patch(entryId, {
          recurringRuleId: ruleId,
          recurringMatch: {
            ruleId,
            expectedChargeId,
            matchType: "user",
            score: args.resolution?.score,
            explain: args.resolution?.explain,
          },
          updatedAt: Date.now(),
        });
        if (expectedChargeId) {
          await ctx.db.patch(expectedChargeId, {
            matchedEntryId: entryId,
            state: "matched",
            resolvedAt: Date.now(),
          });
        }
      }
      if (args.resolution?.excludeFromRecurring && entryId) {
        await ctx.db.patch(entryId, { excludeFromRecurring: true, updatedAt: Date.now() });
      }
    }

    await ctx.db.patch(args.id, { status: "resolved", resolvedAt: Date.now() });
    return { ok: true };
  },
});

export const dismissRecurringInbox = mutation({
  args: { id: v.id("recurringInbox") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, { status: "dismissed", resolvedAt: Date.now() });
    return { ok: true };
  },
});

export const refreshExpectedCharges = mutation({
  args: { ruleId: v.id("recurringRules"), monthsAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== userId) throw new Error("Not found");
    await ctx.runMutation(internal.recurring.ensureExpectedCharges, { ruleId: args.ruleId, monthsAhead: args.monthsAhead });
    return { ok: true };
  },
});

export const runRecurringAutopost = mutation({
  args: { monthsAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    void args.monthsAhead; // Reserved for future use
    const userId = await requireUserId(ctx);
    await ctx.runMutation(internal.recurring.reconcileRecurring, { userId });
    await ctx.runMutation(internal.recurring.materializeDueExpectedCharges, { userId });
    return { ok: true };
  },
});

export const materializeDueExpectedCharges = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const due = await ctx.db
      .query("expectedCharges")
      .withIndex("by_user_state", q => q.eq("userId", args.userId).eq("state", "due"))
      .collect();

    for (const charge of due) {
      if (charge.matchedEntryId) continue;
      if (charge.expectedDate > now) continue;

      const rule = await ctx.db.get(charge.ruleId);
      if (!rule) continue;

      const amountCents =
        charge.expectedAmountCents ??
        rule.amountPolicy?.amountCents ??
        rule.amountCents;
      if (!amountCents) continue;

      const entryId = await ctx.db.insert("entries", {
        userId: args.userId,
        type: rule.type,
        transactionType: rule.type === "income" ? "RECEIVED" : "SPENT",
        category: rule.category,
        bucket: rule.bucket ?? rule.category,
        note: rule.displayName ?? rule.name ?? "Recurring charge",
        merchant: rule.displayName ?? rule.name,
        amountCents,
        date: charge.expectedDate,
        status: "posted",
        entryType: rule.type === "income" ? "income" : "purchase",
        needsReview: false,
        recurringRuleId: rule._id,
        recurringMatch: {
          ruleId: rule._id,
          expectedChargeId: charge._id,
          matchType: "auto",
          score: 100,
          explain: { source: "expected_charge" },
        },
        merchantRaw: rule.displayName ?? rule.name,
        merchantNormalized: normalizeMerchant(rule.displayName ?? rule.name),
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.patch(charge._id, {
        matchedEntryId: entryId,
        state: "matched",
        resolvedAt: now,
      });
      await ctx.db.patch(rule._id, { lastMatchedAt: now, updatedAt: now });
    }
    return { ok: true };
  },
});

// Skip an expected charge (mark it as skipped so it doesn't show as due/missed)
export const skipExpectedCharge = mutation({
  args: { id: v.id("expectedCharges"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const charge = await ctx.db.get(args.id);
    if (!charge || charge.userId !== userId) throw new Error("Not found");
    if (charge.state === "matched") throw new Error("Already matched");

    await ctx.db.patch(args.id, {
      state: "skipped",
      resolvedAt: Date.now(),
      resolutionNote: args.note,
    });
    return { ok: true };
  },
});

// Link an existing entry to an expected charge
export const linkEntryToExpectedCharge = mutation({
  args: {
    expectedChargeId: v.id("expectedCharges"),
    entryId: v.id("entries"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const charge = await ctx.db.get(args.expectedChargeId);
    if (!charge || charge.userId !== userId) throw new Error("Expected charge not found");

    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== userId) throw new Error("Entry not found");

    const now = Date.now();

    // Update entry with recurring link
    await ctx.db.patch(args.entryId, {
      recurringRuleId: charge.ruleId,
      recurringMatch: {
        ruleId: charge.ruleId,
        expectedChargeId: charge._id,
        matchType: "user",
        score: 100,
        explain: { source: "user_link" },
      },
      updatedAt: now,
    });

    // Mark expected charge as matched
    await ctx.db.patch(args.expectedChargeId, {
      matchedEntryId: args.entryId,
      state: "matched",
      resolvedAt: now,
    });

    // Update rule lastMatchedAt
    await ctx.db.patch(charge.ruleId, { lastMatchedAt: now, updatedAt: now });

    return { ok: true };
  },
});

// Move the expected date of a charge
export const moveExpectedChargeDate = mutation({
  args: {
    id: v.id("expectedCharges"),
    newDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const charge = await ctx.db.get(args.id);
    if (!charge || charge.userId !== userId) throw new Error("Not found");
    if (charge.state === "matched") throw new Error("Already matched");

    await ctx.db.patch(args.id, {
      expectedDate: args.newDate,
      // Reset state based on new date
      state: args.newDate <= Date.now() + 24 * 60 * 60 * 1000 ? "due" : "upcoming",
    });
    return { ok: true };
  },
});

