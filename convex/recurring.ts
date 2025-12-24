import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { listRecentEntries, listEntriesForUser } from "./entries";

async function requireUserId(ctx: any): Promise<string> {
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    if (args.intervalType === undefined && args.intervalDays === undefined && args.cadenceType === undefined) {
      // it's fine to not define cadence at creation; detection can fill this in later
    }

    const now = Date.now();

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
      autolinkEnabled: args.autolinkEnabled === undefined ? false : !!args.autolinkEnabled,
      lastMatchedAt: undefined,
      active: args.active === undefined ? true : !!args.active,
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");

    const patch: any = { updatedAt: Date.now() };
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

    const candidates = detectRecurringCandidatesFromEntries(rows as any[], { lookbackDays, minOccurrences: 3 });
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
    const recent = await ctx.runQuery(listRecentEntries as any, { limit: 5000 });
    const userSet = new Set<string>();
    for (const r of recent) userSet.add(r.userId);

    const summary: any = { users: 0, candidates: 0, created: 0, linked: 0 };

    for (const userId of userSet) {
      summary.users++;
      const rows = await ctx.runQuery(listEntriesForUser as any, { userId, startDate: 0, endDate: Date.now(), limit: 2000 });

      const candidates = detectRecurringCandidatesFromEntries(rows as any[]);
      for (const c of candidates) {
        summary.candidates++;
        if (c.confidence < minConfidence) continue;

        if (!dryRun) {
          const now = Date.now();
          const res = await ctx.runMutation(createRecurringRule as any, {
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
          const toLink: any[] = [];
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
            await ctx.runMutation(linkEntriesToRule as any, { ruleId: createdId, entryIds: toLink });
            summary.linked += toLink.length;
          }
        }
      }
    }

    return { ok: true, summary };
  },
});

