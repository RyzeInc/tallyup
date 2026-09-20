import type { Doc } from "../../convex/_generated/dataModel";

export type ActivityFilters = {
  type: "all" | "expense" | "income";
  q: string;
  review: boolean;
  categories: string[];
  tags: string[];
  accounts: string[];
  methods: string[];
  min: string;
  max: string;
  sort: "newest" | "oldest" | "highest" | "lowest";
};

export const emptyFilters: ActivityFilters = {
  type: "all",
  q: "",
  review: false,
  categories: [],
  tags: [],
  accounts: [],
  methods: [],
  min: "",
  max: "",
  sort: "newest",
};

const keys = [
  "type",
  "q",
  "review",
  "category",
  "tag",
  "account",
  "method",
  "min",
  "max",
  "sort",
];
export function readActivityFilters(params: URLSearchParams): ActivityFilters {
  const type = params.get("type");
  const sort = params.get("sort");
  const values = (key: string) => [
    ...new Set(params.getAll(key).filter(Boolean)),
  ];
  return {
    type: type === "expense" || type === "income" ? type : "all",
    q: params.get("q") ?? "",
    review: params.get("review") === "1",
    categories: values("category"),
    tags: values("tag"),
    accounts: values("account"),
    methods: values("method"),
    min: params.get("min") ?? "",
    max: params.get("max") ?? "",
    sort:
      sort === "oldest" || sort === "highest" || sort === "lowest"
        ? sort
        : "newest",
  };
}

export function writeActivityFilters(
  params: URLSearchParams,
  filters: ActivityFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  keys.forEach((key) => next.delete(key));
  if (filters.type !== "all") next.set("type", filters.type);
  if (filters.q) next.set("q", filters.q);
  if (filters.review) next.set("review", "1");
  for (const [key, values] of [
    ["category", filters.categories],
    ["tag", filters.tags],
    ["account", filters.accounts],
    ["method", filters.methods],
  ] as const) {
    values.forEach((value) => next.append(key, value));
  }
  if (filters.min) next.set("min", filters.min);
  if (filters.max) next.set("max", filters.max);
  if (filters.sort !== "newest") next.set("sort", filters.sort);
  return next;
}

export function amountInCents(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number * 100)
    : undefined;
}

export function amountRangeError(
  filters: Pick<ActivityFilters, "min" | "max">,
): string | undefined {
  const min = amountInCents(filters.min);
  const max = amountInCents(filters.max);
  if ((filters.min && min === undefined) || (filters.max && max === undefined))
    return "Enter a valid, non-negative amount.";
  if (min !== undefined && max !== undefined && min > max)
    return "Minimum must be less than or equal to maximum.";
}

type Category = Pick<
  Doc<"categories">,
  "_id" | "name" | "parentId" | "slug" | "categoryType"
>;
const normalized = (value?: string) => value?.trim().toLowerCase() ?? "";

/** Resolve canonical IDs and legacy labels without guessing an account from its name. */
export function filterActivityEntries(
  entries: Doc<"entries">[],
  filters: ActivityFilters,
  categories: Category[],
  accounts: Pick<Doc<"accounts">, "_id" | "name">[] = [],
): Doc<"entries">[] {
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const accountNames = new Map(accounts.map((a) => [String(a._id), a.name]));
  const requested = new Set(filters.categories.map(normalized));
  const selectedIds = new Set(
    categories
      .filter((c) =>
        [c._id, c.name, c.slug].some((value) =>
          requested.has(normalized(value)),
        ),
      )
      .map((c) => String(c._id)),
  );
  // Selecting a parent includes descendants, even in older catalogs with multiple levels.
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (
        category.parentId &&
        selectedIds.has(category.parentId) &&
        !selectedIds.has(category._id)
      ) {
        selectedIds.add(category._id);
        changed = true;
      }
    }
  }
  const min = amountInCents(filters.min);
  const max = amountInCents(filters.max);
  const search = normalized(filters.q);
  const rows = entries.filter((entry) => {
    if (entry.isArchived) return false;
    if (filters.type !== "all" && entry.type !== filters.type) return false;
    if (filters.review && !entry.needsReview) return false;
    if (
      filters.accounts.length &&
      !filters.accounts.includes(entry.accountId ?? "__unlinked__")
    )
      return false;
    if (
      filters.methods.length &&
      !filters.methods
        .map(normalized)
        .includes(normalized(entry.methodOrAccount) || "__unspecified__")
    )
      return false;
    const magnitude = Math.abs(entry.amountCents);
    if (min !== undefined && magnitude < min) return false;
    if (max !== undefined && magnitude > max) return false;
    const tags = [
      ...(entry.tags ?? []),
      ...(entry.contextTags ?? []),
      ...(entry.intentTags ?? []),
    ];
    if (
      filters.tags.length &&
      !filters.tags.some((tag) =>
        tags.map(normalized).includes(normalized(tag)),
      )
    )
      return false;
    const canonical = entry.categoryId ? byId.get(entry.categoryId) : undefined;
    const legacy = entry.category?.trim() || entry.bucket?.trim();
    const resolved =
      canonical ??
      byId.get(legacy ?? "") ??
      categories.find(
        (c) =>
          c.categoryType === entry.type &&
          [c.name, c.slug].some(
            (value) => value && normalized(value) === normalized(legacy),
          ),
      );
    if (requested.size) {
      const categoryMatch = resolved
        ? selectedIds.has(resolved._id)
        : requested.has(
            normalized(entry.categoryId ?? legacy) || "__uncategorized__",
          ) ||
          (!entry.categoryId &&
            normalized(legacy) === "uncategorized" &&
            requested.has("__uncategorized__"));
      const subcategoryMatch =
        entry.subcategoryId && selectedIds.has(entry.subcategoryId);
      if (!categoryMatch && !subcategoryMatch) return false;
    }
    if (search) {
      const haystack = [
        entry.title,
        entry.note,
        entry.merchant,
        resolved?.name,
        legacy,
        entry.methodOrAccount,
        entry.accountId && accountNames.get(entry.accountId),
        ...tags,
      ]
        .filter(Boolean)
        .join(" ");
      if (!normalized(haystack).includes(search)) return false;
    }
    return true;
  });
  return rows.sort((a, b) => {
    const tie =
      b.date - a.date ||
      b._creationTime - a._creationTime ||
      a._id.localeCompare(b._id);
    switch (filters.sort) {
      case "oldest":
        return a.date - b.date || tie;
      case "highest":
        return Math.abs(b.amountCents) - Math.abs(a.amountCents) || tie;
      case "lowest":
        return Math.abs(a.amountCents) - Math.abs(b.amountCents) || tie;
      default:
        return tie;
    }
  });
}
