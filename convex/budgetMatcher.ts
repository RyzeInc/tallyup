import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type MatchInput = {
  category?: string;
  merchant?: string;
  tags?: string[];
};

function normalize(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : undefined;
}

export async function resolveBudgetCategoryId(
  ctx: MutationCtx,
  userId: string,
  input: MatchInput
): Promise<Id<"budgetCategories"> | undefined> {
  const categories = await ctx.db
    .query("budgetCategories")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const categoryKey = normalize(input.category);
  const merchantKey = normalize(input.merchant);
  const tagKeys = new Set((input.tags ?? []).map(normalize).filter(Boolean) as string[]);

  for (const budget of categories) {
    if (budget.archived) continue;

    if (categoryKey && budget.matchCategories?.some((c) => normalize(c) === categoryKey)) {
      return budget._id;
    }
  }

  for (const budget of categories) {
    if (budget.archived) continue;

    if (merchantKey && budget.matchMerchants?.some((m) => normalize(m) === merchantKey)) {
      return budget._id;
    }
  }

  for (const budget of categories) {
    if (budget.archived) continue;

    if (tagKeys.size && budget.matchTags?.some((t) => tagKeys.has(normalize(t) ?? ""))) {
      return budget._id;
    }
  }

  return undefined;
}
