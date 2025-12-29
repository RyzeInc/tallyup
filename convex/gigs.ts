import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Gig-related queries for hourly rate calculations and platform grouping
 */

async function requireUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.subject;
}

// Platform groupings for aggregate reporting
const GIG_PLATFORM_GROUPS: Record<string, string> = {
  // Rideshare
  uber: "rideshare",
  lyft: "rideshare",
  via: "rideshare",
  alto: "rideshare",
  // Delivery
  doordash: "delivery",
  ubereats: "delivery",
  grubhub: "delivery",
  instacart: "delivery",
  postmates: "delivery",
  spark: "delivery",
  shipt: "delivery",
  gopuff: "delivery",
  amazon_flex: "delivery",
  // Freelance
  upwork: "freelance",
  fiverr: "freelance",
  toptal: "freelance",
  // Rental
  airbnb: "rental",
  vrbo: "rental",
  turo: "rental",
};

function normalizeForGrouping(platform: string): string {
  return platform.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function getGigGroup(platform: string): string {
  const normalized = normalizeForGrouping(platform);
  return GIG_PLATFORM_GROUPS[normalized] || "other";
}

/**
 * Get hourly rate summary grouped by gig platform category
 * Returns aggregated earnings, hours, and calculated hourly rates
 */
export const getGigHourlySummary = query({
  args: {
    startTs: v.optional(v.number()),
    endTs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    
    // Query entries with gig data (hoursWorked is set)
    let entries = await ctx.db
      .query("entries")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    // Filter by date range if provided
    if (args.startTs) {
      entries = entries.filter((e) => e.date >= args.startTs!);
    }
    if (args.endTs) {
      entries = entries.filter((e) => e.date <= args.endTs!);
    }

    // Filter to only gig entries (have hoursWorked)
    const gigEntries = entries.filter(
      (e) => e.type === "income" && e.hoursWorked && e.hoursWorked > 0
    );

    if (gigEntries.length === 0) {
      return {
        hasData: false,
        groups: [],
        totals: {
          totalEarningsCents: 0,
          totalHours: 0,
          averageHourlyRateCents: 0,
        },
      };
    }

    // Group by platform type/group
    const groupedData: Record<
      string,
      {
        group: string;
        platforms: Set<string>;
        earningsCents: number;
        hours: number;
        entries: number;
      }
    > = {};

    for (const entry of gigEntries) {
      const platform = entry.platformType || entry.category || "Unknown";
      const group = entry.gigGroup || getGigGroup(platform);

      if (!groupedData[group]) {
        groupedData[group] = {
          group,
          platforms: new Set(),
          earningsCents: 0,
          hours: 0,
          entries: 0,
        };
      }

      groupedData[group].platforms.add(platform);
      groupedData[group].earningsCents += entry.amountCents;
      groupedData[group].hours += entry.hoursWorked || 0;
      groupedData[group].entries += 1;
    }

    // Convert to array and calculate hourly rates
    const groups = Object.values(groupedData)
      .map((g) => ({
        group: g.group,
        platforms: Array.from(g.platforms),
        earningsCents: g.earningsCents,
        hours: Math.round(g.hours * 100) / 100,
        entries: g.entries,
        hourlyRateCents:
          g.hours > 0 ? Math.round(g.earningsCents / g.hours) : 0,
      }))
      .sort((a, b) => b.earningsCents - a.earningsCents);

    // Calculate totals
    const totalEarningsCents = groups.reduce(
      (sum, g) => sum + g.earningsCents,
      0
    );
    const totalHours = groups.reduce((sum, g) => sum + g.hours, 0);
    const averageHourlyRateCents =
      totalHours > 0 ? Math.round(totalEarningsCents / totalHours) : 0;

    return {
      hasData: true,
      groups,
      totals: {
        totalEarningsCents,
        totalHours: Math.round(totalHours * 100) / 100,
        averageHourlyRateCents,
      },
    };
  },
});

/**
 * Get user's gig profiles for context-aware prompts
 */
export const getActiveGigProfiles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const profiles = await ctx.db
      .query("gigProfiles")
      .withIndex("by_user_active", (q) => 
        q.eq("userId", userId).eq("active", true)
      )
      .collect();

    return profiles;
  },
});

/**
 * Suggest a gig profile type based on user's entry patterns
 */
export const suggestGigProfiles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    // Get recent income entries with gig-like characteristics
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_user_type_date", (q) => 
        q.eq("userId", userId).eq("type", "income")
      )
      .order("desc")
      .take(100);

    // Analyze patterns to suggest profiles
    const platformCounts: Record<string, number> = {};
    
    for (const entry of entries) {
      const platform = entry.platformType || entry.category;
      if (platform) {
        const group = getGigGroup(platform);
        platformCounts[group] = (platformCounts[group] || 0) + 1;
      }
    }

    // Return suggestions for groups with >= 3 entries
    const suggestions = Object.entries(platformCounts)
      .filter(([, count]) => count >= 3)
      .map(([group, count]) => ({
        profileType: group,
        entryCount: count,
        suggested: true,
      }))
      .sort((a, b) => b.entryCount - a.entryCount);

    return suggestions;
  },
});
