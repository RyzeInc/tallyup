import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { countsInBudget, reportingAmount } from "../lib/finance/semantics";

const DAY_MS = 24 * 60 * 60 * 1000;

type Frequency = "monthly" | "weekly" | "annual" | "custom";

type PlanVersion = {
  _id: Id<"budgetPlanVersions">;
  planId: Id<"budgetPlans">;
  version: number;
  frequency: Frequency;
  periodDays?: number;
  amountCents: number;
  effectiveFrom: number;
  effectiveTo?: number;
  rolloverPolicyId?: Id<"rolloverPolicies">;
  capPolicyId?: string;
  overridesByMonth?: { month: string; amountCents: number }[];
};

function monthKeyFor(ts: number, offsetMinutes: number): string {
  const offsetMs = offsetMinutes * 60 * 1000;
  const shifted = new Date(ts + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${y}-${mm}`;
}

function startOfTzDay(ts: number, offsetMinutes: number): number {
  const offsetMs = offsetMinutes * 60 * 1000;
  const shifted = new Date(ts + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  return Date.UTC(y, m, d) - offsetMs;
}

function isBoundary(ts: number, boundary: "monthly" | "quarterly" | "yearly", offsetMinutes: number): boolean {
  const offsetMs = offsetMinutes * 60 * 1000;
  const shifted = new Date(ts + offsetMs);
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  if (boundary === "yearly") return m === 0 && d === 1;
  if (boundary === "quarterly") return d === 1 && (m === 0 || m === 3 || m === 6 || m === 9);
  return d === 1;
}

function addMonthsTz(ts: number, months: number, offsetMinutes: number): number {
  const offsetMs = offsetMinutes * 60 * 1000;
  const shifted = new Date(ts + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const next = Date.UTC(y, m + months, 1);
  return next - offsetMs;
}

function addYearsTz(ts: number, years: number, offsetMinutes: number): number {
  const offsetMs = offsetMinutes * 60 * 1000;
  const shifted = new Date(ts + offsetMs);
  const y = shifted.getUTCFullYear();
  const next = Date.UTC(y + years, 0, 1);
  return next - offsetMs;
}

function getPeriodStartForDate(
  ts: number,
  version: PlanVersion,
  offsetMinutes: number,
  anchorStart: number
): number {
  const dayStart = startOfTzDay(ts, offsetMinutes);
  if (version.frequency === "monthly") {
    return addMonthsTz(dayStart, 0, offsetMinutes);
  }
  if (version.frequency === "annual") {
    return addYearsTz(dayStart, 0, offsetMinutes);
  }
  const anchorDay = startOfTzDay(anchorStart, offsetMinutes);
  const periodDays = version.frequency === "weekly" ? 7 : (version.periodDays ?? 30);
  const diffDays = Math.floor((dayStart - anchorDay) / DAY_MS);
  const periods = Math.floor(diffDays / periodDays);
  return anchorDay + periods * periodDays * DAY_MS;
}

function getNextPeriodStart(
  periodStart: number,
  version: PlanVersion,
  offsetMinutes: number
): number {
  if (version.frequency === "monthly") {
    return addMonthsTz(periodStart, 1, offsetMinutes);
  }
  if (version.frequency === "annual") {
    return addYearsTz(periodStart, 1, offsetMinutes);
  }
  const periodDays = version.frequency === "weekly" ? 7 : (version.periodDays ?? 30);
  return periodStart + periodDays * DAY_MS;
}

function computeBudgetedCents(version: PlanVersion, periodStart: number, offsetMinutes: number): number {
  const key = monthKeyFor(periodStart, offsetMinutes);
  if (version.overridesByMonth) {
    const match = version.overridesByMonth.find((o) => o.month === key);
    if (match) return match.amountCents;
  }
  return version.amountCents;
}

function clampCarryOut(
  carryOut: number,
  policy: {
    allowNegative: boolean;
    capPositiveCents?: number;
    capNegativeCents?: number;
  }
): number {
  let out = carryOut;
  if (!policy.allowNegative && out < 0) out = 0;
  if (policy.capPositiveCents !== undefined && out > policy.capPositiveCents) out = policy.capPositiveCents;
  if (policy.capNegativeCents !== undefined && out < policy.capNegativeCents) out = policy.capNegativeCents;
  return out;
}

type AuthCtx = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } };

async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

async function materializeForUser(
  ctx: MutationCtx,
  userId: string,
  planId: Id<"budgetPlans">,
  rangeStart: number,
  rangeEnd: number,
  timezoneOffsetMinutes: number
) {
  const plan = await ctx.db.get(planId);
  if (!plan || plan.userId !== userId) throw new Error("Plan not found");

  const versions = await ctx.db
    .query("budgetPlanVersions")
    .withIndex("by_plan_effective", (q) => q.eq("planId", planId))
    .collect();

  if (versions.length === 0) return { ok: true, created: 0, updated: 0 };

  const versionList = versions.sort((a, b) => a.effectiveFrom - b.effectiveFrom) as PlanVersion[];
  const start = startOfTzDay(rangeStart, timezoneOffsetMinutes);
  const end = startOfTzDay(rangeEnd, timezoneOffsetMinutes);

  const prior = await ctx.db
    .query("budgetPeriods")
    .withIndex("by_user_plan_period", (q) =>
      q.eq("userId", userId).eq("planId", plan._id).lt("periodStart", start)
    )
    .order("desc")
    .take(1);

  let cursor = start;
  let lastCarryOut = prior[0]?.carryOutCents ?? 0;
  let created = 0;
  let updated = 0;

  while (cursor <= end) {
    const activeVersion = [...versionList]
      .filter((v) => v.effectiveFrom <= cursor && (v.effectiveTo === undefined || v.effectiveTo >= cursor))
      .sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0];

    if (!activeVersion) {
      cursor += DAY_MS;
      continue;
    }

    const periodStart = getPeriodStartForDate(cursor, activeVersion, timezoneOffsetMinutes, plan.effectiveFrom);
    const nextStart = getNextPeriodStart(periodStart, activeVersion, timezoneOffsetMinutes);
    const periodEnd = nextStart - 1;

    if (periodEnd < start) {
      cursor = nextStart;
      continue;
    }
    if (periodStart > end) break;

    const budgetedCents = computeBudgetedCents(activeVersion, periodStart, timezoneOffsetMinutes);

    const existing = await ctx.db
      .query("budgetPeriods")
      .withIndex("by_user_plan_period", (q) =>
        q.eq("userId", userId).eq("planId", plan._id).eq("periodStart", periodStart)
      )
      .take(1);

    const rolloverPolicy = activeVersion.rolloverPolicyId
      ? await ctx.db.get(activeVersion.rolloverPolicyId)
      : null;

    let carryInCents = 0;
    if (rolloverPolicy) {
      if (rolloverPolicy.resetAtBoundary === "never") {
        carryInCents = lastCarryOut;
      } else if (!isBoundary(periodStart, rolloverPolicy.resetAtBoundary, timezoneOffsetMinutes)) {
        carryInCents = lastCarryOut;
      }
    }

    const spentCents = existing[0]?.spentCents ?? 0;
    let availableCents = budgetedCents - spentCents + carryInCents;
      const carryOutCents = rolloverPolicy
        ? clampCarryOut(availableCents, rolloverPolicy)
        : 0;

    if (!rolloverPolicy) {
      availableCents = budgetedCents - spentCents;
    }

    const now = Date.now();

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        planVersion: activeVersion.version,
        budgetedCents,
        spentCents,
        carryInCents,
        carryOutCents,
        availableCents,
        materializedAt: now,
        updatedAt: now,
      });
      updated += 1;
    } else {
      await ctx.db.insert("budgetPeriods", {
        userId,
        planId: plan._id,
        planVersion: activeVersion.version,
        budgetCategoryId: plan.budgetCategoryId,
        budgetGroupId: plan.budgetGroupId,
        periodStart,
        periodEnd,
        budgetedCents,
        spentCents,
        carryInCents,
        carryOutCents,
        availableCents,
        materializedAt: now,
        updatedAt: now,
      });
      created += 1;
    }

    lastCarryOut = carryOutCents;
    cursor = nextStart;
  }

  return { ok: true, created, updated };
}

export const createBudgetPlan = mutation({
  args: {
    name: v.string(),
    planType: v.union(v.literal("category"), v.literal("group")),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    budgetGroupId: v.optional(v.id("budgetGroups")),
    frequency: v.union(v.literal("monthly"), v.literal("weekly"), v.literal("annual"), v.literal("custom")),
    periodDays: v.optional(v.number()),
    amountCents: v.number(),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    rolloverPolicyId: v.optional(v.id("rolloverPolicies")),
    capPolicyId: v.optional(v.string()),
    overridesByMonth: v.optional(v.array(v.object({ month: v.string(), amountCents: v.number() }))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const planId = await ctx.db.insert("budgetPlans", {
      userId,
      name: args.name,
      planType: args.planType,
      budgetCategoryId: args.budgetCategoryId,
      budgetGroupId: args.budgetGroupId,
      frequency: args.frequency,
      periodDays: args.periodDays,
      amountCents: args.amountCents,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      rolloverPolicyId: args.rolloverPolicyId,
      capPolicyId: args.capPolicyId,
      overridesByMonth: args.overridesByMonth,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("budgetPlanVersions", {
      userId,
      planId,
      version: 1,
      frequency: args.frequency,
      periodDays: args.periodDays,
      amountCents: args.amountCents,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      rolloverPolicyId: args.rolloverPolicyId,
      capPolicyId: args.capPolicyId,
      overridesByMonth: args.overridesByMonth,
      createdAt: now,
    });

    return { ok: true, id: planId };
  },
});

export const updateBudgetPlan = mutation({
  args: {
    planId: v.id("budgetPlans"),
    frequency: v.optional(v.union(v.literal("monthly"), v.literal("weekly"), v.literal("annual"), v.literal("custom"))),
    periodDays: v.optional(v.number()),
    amountCents: v.optional(v.number()),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    rolloverPolicyId: v.optional(v.id("rolloverPolicies")),
    capPolicyId: v.optional(v.string()),
    overridesByMonth: v.optional(v.array(v.object({ month: v.string(), amountCents: v.number() }))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) throw new Error("Plan not found");

    const nextVersion = (plan.version ?? 0) + 1;
    const now = Date.now();

    const frequency = args.frequency ?? plan.frequency;
    const periodDays = args.periodDays ?? plan.periodDays;
    const amountCents = args.amountCents ?? plan.amountCents;

    await ctx.db.insert("budgetPlanVersions", {
      userId,
      planId: args.planId,
      version: nextVersion,
      frequency,
      periodDays,
      amountCents,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      rolloverPolicyId: args.rolloverPolicyId ?? plan.rolloverPolicyId,
      capPolicyId: args.capPolicyId ?? plan.capPolicyId,
      overridesByMonth: args.overridesByMonth ?? plan.overridesByMonth,
      createdAt: now,
    });

    await ctx.db.patch(args.planId, {
      frequency,
      periodDays,
      amountCents,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      rolloverPolicyId: args.rolloverPolicyId ?? plan.rolloverPolicyId,
      capPolicyId: args.capPolicyId ?? plan.capPolicyId,
      overridesByMonth: args.overridesByMonth ?? plan.overridesByMonth,
      version: nextVersion,
      updatedAt: now,
    });

    return { ok: true, version: nextVersion };
  },
});

export const materializeBudgetPeriods = mutation({
  args: {
    planId: v.id("budgetPlans"),
    rangeStart: v.number(),
    rangeEnd: v.number(),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const offsetMinutes = args.timezoneOffsetMinutes ?? 0;
    return await materializeForUser(ctx, userId, args.planId, args.rangeStart, args.rangeEnd, offsetMinutes);
  },
});

export const materializeBudgetPeriodsInternal = internalMutation({
  args: {
    userId: v.string(),
    planId: v.id("budgetPlans"),
    rangeStart: v.number(),
    rangeEnd: v.number(),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const offsetMinutes = args.timezoneOffsetMinutes ?? 0;
    return await materializeForUser(ctx, args.userId, args.planId, args.rangeStart, args.rangeEnd, offsetMinutes);
  },
});

export const recomputeBudgetPeriod = internalMutation({
  args: {
    periodId: v.id("budgetPeriods"),
  },
  handler: async (ctx, args) => {
    const period = await ctx.db.get(args.periodId);
    if (!period) return { ok: false };

    const plan = await ctx.db.get(period.planId);
    if (!plan) return { ok: false };

    let budgetCategoryIds: Id<"budgetCategories">[] = [];
    if (plan.planType === "category" && plan.budgetCategoryId) {
      budgetCategoryIds = [plan.budgetCategoryId];
    }

    const groupId = plan.budgetGroupId;
    if (plan.planType === "group" && groupId) {
      const members = await ctx.db
        .query("budgetGroupMembers")
        .withIndex("by_group", (q) => q.eq("budgetGroupId", groupId))
        .collect();
      budgetCategoryIds = members.map((m) => m.budgetCategoryId);
    }

    let spentCents = 0;
    const entryImpacts = await ctx.db
      .query("budgetEntryImpacts")
      .withIndex("by_period", (q) => q.eq("periodId", period._id))
      .collect();

    for (const impact of entryImpacts) {
      await ctx.db.delete(impact._id);
    }

    for (const categoryId of budgetCategoryIds) {
      const entries = await ctx.db
        .query("entries")
        .withIndex("by_user_budget_date", (q) =>
          q.eq("userId", period.userId)
            .eq("budgetCategoryId", categoryId)
            .gte("date", period.periodStart)
            .lt("date", period.periodEnd + 1)
        )
        .collect();

      for (const entry of entries) {
        // Archived, pending, transfer and excluded rows are settled in one place so
        // budget spend always agrees with Activity, Dashboard, and Insights.
        if (!countsInBudget(entry)) continue;

        let entryAmount = Math.abs(entry.amountCents);
        if (entry.splitParts && entry.splitParts.length > 0) {
          entryAmount = 0;
          for (const part of entry.splitParts) {
            if (!part.budgetCategoryId || part.budgetCategoryId !== categoryId) continue;
            entryAmount += part.amountCents;
          }
        }

        if (!entryAmount) continue;
        const impactAmount = reportingAmount(entry) < 0 ? -entryAmount : entryAmount;
        spentCents += impactAmount;
        await ctx.db.insert("budgetEntryImpacts", {
          userId: period.userId,
          entryId: entry._id,
          periodId: period._id,
          budgetCategoryId: categoryId,
          budgetGroupId: plan.budgetGroupId,
          amountCents: impactAmount,
          appliedAt: Date.now(),
        });
      }
    }

    const rolloverPolicy = plan.rolloverPolicyId ? await ctx.db.get(plan.rolloverPolicyId) : null;
    const carryInCents = period.carryInCents ?? 0;
    let availableCents = period.budgetedCents - spentCents + carryInCents;
    const carryOutCents = rolloverPolicy
      ? clampCarryOut(availableCents, rolloverPolicy)
      : 0;
    if (!rolloverPolicy) {
      availableCents = period.budgetedCents - spentCents;
    }

    await ctx.db.patch(period._id, {
      spentCents,
      availableCents,
      carryOutCents,
      updatedAt: Date.now(),
    });

    return { ok: true, spentCents };
  },
});

export const enqueueBudgetDirty = internalMutation({
  args: {
    userId: v.string(),
    budgetCategoryId: v.optional(v.id("budgetCategories")),
    dirtyDate: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("budgetDirtyQueue", {
      userId: args.userId,
      budgetCategoryId: args.budgetCategoryId,
      dirtyDate: args.dirtyDate,
      reason: args.reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

type BudgetPeriodSummary = {
  planId: string;
  budgetCategoryId?: string;
  budgetGroupId?: string;
  budgetedCents: number;
  spentCents: number;
  availableCents: number;
  paceExpectedCents: number;
  paceDeltaCents: number;
  projectedEndCents: number;
  forecastRiskCents: number;
  periods: {
    periodStart: number;
    periodEnd: number;
    budgetedCents: number;
    spentCents: number;
    availableCents: number;
    carryInCents: number;
    carryOutCents: number;
    planVersion: number;
    materializedAt: number;
  }[];
};

export const getBudgetStatus = query({
  args: {
    rangeStart: v.number(),
    rangeEnd: v.number(),
    asOfDate: v.number(),
    timezoneOffsetMinutes: v.optional(v.number()),
    rangeMode: v.optional(v.union(v.literal("actualOnly"), v.literal("proratedBudget"), v.literal("fullMonthsOnly"))),
    includePending: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx as QueryCtx);
    const rangeMode = args.rangeMode ?? "proratedBudget";
    const offsetMinutes = args.timezoneOffsetMinutes ?? 0;
    const asOfEnd = startOfTzDay(args.asOfDate, offsetMinutes) + DAY_MS - 1;

    const periods = await ctx.db
      .query("budgetPeriods")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.lte(q.field("periodStart"), args.rangeEnd),
          q.gte(q.field("periodEnd"), args.rangeStart)
        )
      )
      .collect();

    const byPlan: Record<string, BudgetPeriodSummary> = {};

    for (const period of periods) {
      if (!byPlan[period.planId]) {
        byPlan[period.planId] = {
          planId: period.planId,
          budgetCategoryId: period.budgetCategoryId,
          budgetGroupId: period.budgetGroupId,
          budgetedCents: 0,
          spentCents: 0,
          availableCents: 0,
          paceExpectedCents: 0,
          paceDeltaCents: 0,
          projectedEndCents: 0,
          forecastRiskCents: 0,
          periods: [],
        };
      }
      const entry = byPlan[period.planId];
      entry.budgetedCents += period.budgetedCents;
      entry.spentCents += period.spentCents;
      entry.availableCents += period.availableCents;
      entry.periods.push({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        budgetedCents: period.budgetedCents,
        spentCents: period.spentCents,
        availableCents: period.availableCents,
        carryInCents: period.carryInCents,
        carryOutCents: period.carryOutCents,
        planVersion: period.planVersion,
        materializedAt: period.materializedAt,
      });
    }

    const summary = Object.values(byPlan).map((entry) => {
      const current = entry.periods.find((p) => p.periodStart <= asOfEnd && p.periodEnd >= asOfEnd);
      if (current) {
        const periodLength = current.periodEnd - current.periodStart + 1;
        const elapsed = Math.max(0, Math.min(1, (asOfEnd - current.periodStart + 1) / periodLength));
        const paceExpected = Math.round(current.budgetedCents * elapsed);
        const projectedEnd = elapsed > 0 ? Math.round(current.spentCents / elapsed) : current.spentCents;
        entry.paceExpectedCents = paceExpected;
        entry.paceDeltaCents = current.spentCents - paceExpected;
        entry.projectedEndCents = projectedEnd;
        entry.forecastRiskCents = projectedEnd - current.budgetedCents;
      }
      return entry;
    });

    return {
      summary,
      explain: {
        timezoneOffsetMinutes: offsetMinutes,
        rangeMode,
        includePending: args.includePending ?? false,
        dateBasis: "transactionDate",
        asOfDate: startOfTzDay(args.asOfDate, offsetMinutes),
        asOfEnd,
        paceModel: "linear",
        forecastModel: "linear",
      },
    };
  },
});
