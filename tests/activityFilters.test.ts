import { describe, it, expect } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import {
  emptyFilters,
  filterActivityEntries,
  readActivityFilters,
  writeActivityFilters,
  amountRangeError,
} from "../lib/activity/filters";

const entry = (patch: Partial<Doc<"entries">> = {}): Doc<"entries"> => ({
  _id: "entry" as Id<"entries">,
  _creationTime: 1,
  userId: "user",
  type: "expense",
  amountCents: 1200,
  date: 100,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});
const category = (id: string, name: string, parentId?: string) => ({
  _id: id as Id<"categories">,
  name,
  parentId: parentId as Id<"categories"> | undefined,
  categoryType: "expense" as const,
});
const categories = [
  category("food", "Food & Drink"),
  category("groceries", "Groceries", "food"),
];

describe("Activity filtering over the complete period", () => {
  it("finds checking-account spending beyond the old 60-row page and 180-row scan", () => {
    const rows = Array.from({ length: 300 }, (_, i) =>
      entry({
        _id: `entry-${i}` as Id<"entries">,
        date: 1000 - i,
        accountId: (i === 299 ? "checking" : "credit") as Id<"accounts">,
      }),
    );
    expect(
      filterActivityEntries(
        rows,
        { ...emptyFilters, accounts: ["checking"] },
        [],
      ),
    ).toEqual([rows[299]]);
  });
  it("preserves all entries sharing a transaction date", () => {
    const rows = Array.from({ length: 250 }, (_, i) =>
      entry({ _id: `entry-${i}` as Id<"entries"> }),
    );
    expect(filterActivityEntries(rows, emptyFilters, [])).toHaveLength(250);
  });
  it("uses account IDs, never ambiguous payment labels", () => {
    const rows = [
      entry({
        accountId: "one" as Id<"accounts">,
        methodOrAccount: "Checking",
      }),
      entry({
        _id: "two" as Id<"entries">,
        accountId: "two" as Id<"accounts">,
        methodOrAccount: "Checking",
      }),
      entry({ _id: "legacy" as Id<"entries">, methodOrAccount: "Checking" }),
    ];
    expect(
      filterActivityEntries(rows, { ...emptyFilters, accounts: ["one"] }, []),
    ).toEqual([rows[0]]);
    expect(
      filterActivityEntries(
        rows,
        { ...emptyFilters, accounts: ["__unlinked__"] },
        [],
      ),
    ).toEqual([rows[2]]);
  });
  it("matches category IDs, legacy names, and descendants", () => {
    const rows = [
      entry({ categoryId: "groceries" as Id<"categories"> }),
      entry({ _id: "legacy" as Id<"entries">, bucket: "Groceries" }),
    ];
    expect(
      filterActivityEntries(
        rows,
        { ...emptyFilters, categories: ["food"] },
        categories,
      ),
    ).toHaveLength(2);
    expect(
      filterActivityEntries(
        rows,
        { ...emptyFilters, categories: ["Groceries"] },
        categories,
      ),
    ).toHaveLength(2);
    expect(
      filterActivityEntries(
        rows,
        { ...emptyFilters, categories: ["groceries"] },
        categories,
      ),
    ).toHaveLength(2);
  });
  it("does not match obsolete text over a canonical category", () => {
    const row = entry({
      categoryId: "groceries" as Id<"categories">,
      category: "Travel",
    });
    expect(
      filterActivityEntries(
        [row],
        { ...emptyFilters, categories: ["Travel"] },
        categories,
      ),
    ).toHaveLength(0);
  });
  it("supports uncategorized entries and subcategory selections", () => {
    expect(
      filterActivityEntries(
        [entry()],
        { ...emptyFilters, categories: ["__uncategorized__"] },
        categories,
      ),
    ).toHaveLength(1);
    expect(
      filterActivityEntries(
        [
          entry({
            categoryId: "food" as Id<"categories">,
            subcategoryId: "groceries" as Id<"categories">,
          }),
        ],
        { ...emptyFilters, categories: ["groceries"] },
        categories,
      ),
    ).toHaveLength(1);
  });
  it("combines dimensions with AND and values within each dimension with OR", () => {
    const row = entry({
      accountId: "checking" as Id<"accounts">,
      contextTags: ["Shared"],
      methodOrAccount: " Debit ",
    });
    const filters = {
      ...emptyFilters,
      accounts: ["checking", "savings"],
      tags: ["shared", "Work"],
      methods: ["debit"],
      min: "12",
      max: "12",
    };
    expect(filterActivityEntries([row], filters, [])).toEqual([row]);
    expect(
      filterActivityEntries([row], { ...filters, max: "11" }, []),
    ).toHaveLength(0);
  });
  it("searches titles, canonical category labels, account names, and all tag types", () => {
    const row = entry({
      title: "Weekly shop",
      categoryId: "groceries" as Id<"categories">,
      accountId: "bank" as Id<"accounts">,
      intentTags: ["Essential"],
    });
    const accounts = [
      { _id: "bank" as Id<"accounts">, name: "Everyday checking" },
    ];
    for (const q of ["weekly", "groceries", "checking", "essential"])
      expect(
        filterActivityEntries(
          [row],
          { ...emptyFilters, q },
          categories,
          accounts,
        ),
      ).toEqual([row]);
  });
  it("never shows archived entries and reflects changed/deleted rows without a cache", () => {
    const row = entry({ isArchived: true });
    expect(filterActivityEntries([row], emptyFilters, [])).toEqual([]);
    const filters = { ...emptyFilters, accounts: ["bank"] };
    expect(
      filterActivityEntries(
        [entry({ accountId: "bank" as Id<"accounts"> })],
        filters,
        [],
      ),
    ).toHaveLength(1);
    expect(
      filterActivityEntries(
        [entry({ accountId: "other" as Id<"accounts"> })],
        filters,
        [],
      ),
    ).toHaveLength(0);
    expect(filterActivityEntries([], filters, [])).toHaveLength(0);
  });
  it("sorts the complete set by amount magnitude before display limits", () => {
    const rows = [
      entry(),
      entry({ _id: "large" as Id<"entries">, amountCents: -4000, date: 1 }),
    ];
    expect(
      filterActivityEntries(rows, { ...emptyFilters, sort: "highest" }, [])[0],
    ).toEqual(rows[1]);
  });
});

describe("Activity URL state", () => {
  it("round-trips all dimensions, multiple values, and reserved characters", () => {
    const filters = {
      ...emptyFilters,
      type: "expense" as const,
      q: "a & b",
      categories: ["Food & Drink", "Travel"],
      accounts: ["bank1", "bank2"],
      tags: ["shared", "work"],
      methods: ["cash", "debit"],
      min: "0",
      max: "45.99",
      review: true,
      sort: "highest" as const,
    };
    const params = writeActivityFilters(
      new URLSearchParams("edit=entry&focus=search"),
      filters,
    );
    expect(readActivityFilters(params)).toEqual(filters);
    expect(params.get("edit")).toBe("entry");
    expect(params.get("focus")).toBe("search");
  });
  it("clears all filter params while preserving unrelated navigation state", () => {
    const params = writeActivityFilters(
      new URLSearchParams(
        "category=Food&category=Travel&account=bank&q=rent&review=1&edit=entry",
      ),
      emptyFilters,
    );
    expect(params.toString()).toBe("edit=entry");
    expect(readActivityFilters(params)).toEqual(emptyFilters);
  });
  it("handles old single-value links and malformed enum values", () => {
    expect(
      readActivityFilters(
        new URLSearchParams("category=Food&type=bad&sort=bad"),
      ).categories,
    ).toEqual(["Food"]);
    expect(
      readActivityFilters(new URLSearchParams("type=bad&sort=bad")).type,
    ).toBe("all");
  });
  it("validates amount ranges including zero", () => {
    expect(amountRangeError({ min: "0", max: "0" })).toBeUndefined();
    expect(amountRangeError({ min: "12", max: "11" })).toBeTruthy();
    expect(amountRangeError({ min: "-1", max: "" })).toBeTruthy();
    expect(amountRangeError({ min: "oops", max: "" })).toBeTruthy();
  });
});
