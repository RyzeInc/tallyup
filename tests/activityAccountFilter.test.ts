import { describe, it, expect } from "vitest";
import type { Doc } from "../convex/_generated/dataModel";
import {
  accountLabelIndex,
  emptyFilters,
  filterActivityEntries,
  resolveEntryAccount,
} from "../lib/activity/filters";

type Entry = Doc<"entries">;
const entry = (extra: Partial<Entry>): Entry =>
  ({
    _id: "e1",
    _creationTime: 1,
    userId: "owner",
    type: "expense",
    amountCents: 1000,
    date: 100,
    needsReview: false,
    ...extra,
  }) as Entry;

const checking = { _id: "acct_checking", name: "Everyday Checking" } as Doc<"accounts">;
const savings = { _id: "acct_savings", name: "Savings" } as Doc<"accounts">;
const filters = (accounts: string[]) => ({ ...emptyFilters, accounts });

describe("Activity account filter", () => {
  it("finds spending saved with only the account's name", () => {
    const labelOnly = entry({ _id: "label", methodOrAccount: "Everyday Checking" });
    const linked = entry({ _id: "linked", accountId: checking._id });
    const other = entry({ _id: "other", methodOrAccount: "Cash" });

    const rows = filterActivityEntries(
      [labelOnly, linked, other],
      filters([checking._id]),
      [],
      [checking, savings],
    );
    expect(rows.map((r) => r._id).sort()).toEqual(["label", "linked"]);
  });

  it("matches the label regardless of case or padding", () => {
    const rows = filterActivityEntries(
      [entry({ methodOrAccount: "  everyday checking " })],
      filters([checking._id]),
      [],
      [checking],
    );
    expect(rows).toHaveLength(1);
  });

  it("refuses to guess when two accounts share a name", () => {
    const duplicate = [
      { _id: "acct_a", name: "Checking" },
      { _id: "acct_b", name: "Checking" },
    ] as Doc<"accounts">[];
    const ambiguous = entry({ methodOrAccount: "Checking" });

    expect(accountLabelIndex(duplicate).size).toBe(0);
    expect(
      filterActivityEntries([ambiguous], filters(["acct_a"]), [], duplicate),
    ).toHaveLength(0);
    // It stays reachable rather than vanishing from the app entirely.
    expect(
      filterActivityEntries([ambiguous], filters(["__unlinked__"]), [], duplicate),
    ).toHaveLength(1);
  });

  it("keeps the link authoritative when a label disagrees with it", () => {
    const conflicted = entry({ accountId: savings._id, methodOrAccount: "Everyday Checking" });
    expect(resolveEntryAccount(conflicted, accountLabelIndex([checking, savings]))).toBe(
      savings._id,
    );
    expect(
      filterActivityEntries([conflicted], filters([checking._id]), [], [checking, savings]),
    ).toHaveLength(0);
    expect(
      filterActivityEntries([conflicted], filters([savings._id]), [], [checking, savings]),
    ).toHaveLength(1);
  });

  it("counts only genuinely unassigned rows as unassigned", () => {
    const rows = filterActivityEntries(
      [
        entry({ _id: "none" }),
        entry({ _id: "unknown-label", methodOrAccount: "Apple Pay" }),
        entry({ _id: "known-label", methodOrAccount: "Savings" }),
      ],
      filters(["__unlinked__"]),
      [],
      [checking, savings],
    );
    expect(rows.map((r) => r._id).sort()).toEqual(["none", "unknown-label"]);
  });
});
