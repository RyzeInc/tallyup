import React from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import EditEntryModal from "../components/EditEntryModal";
import type { Id } from "../convex/_generated/dataModel";
import type { TxDraft } from "../components/logging/types";

const form = vi.hoisted(() => ({
  props: null as null | {
    existing: TxDraft;
    onSubmit: (draft: TxDraft) => Promise<unknown>;
  },
}));
vi.mock("../components/logging", () => ({
  QuickLogForm: (props: typeof form.props) => {
    form.props = props;
    return null;
  },
}));
vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn() }),
}));
const save = vi.fn().mockResolvedValue({ ok: true });
const entry = {
  _id: "entry",
  type: "expense" as const,
  amountCents: 1200,
  date: Date.now(),
  accountId: "checking" as Id<"accounts">,
  methodOrAccount: "Debit",
  title: "Lunch",
  note: "Old note",
  merchant: "Cafe",
  tags: ["Shared"],
  recurringRuleId: "rule" as Id<"recurringRules">,
  subcategoryId: "sub" as Id<"categories">,
};
beforeEach(() => {
  save.mockClear();
  vi.mocked(useQuery).mockReturnValue(undefined);
  vi.mocked(useMutation).mockImplementation(
    (ref) =>
      (getFunctionName(ref) === "entries:updateEntry"
        ? save
        : vi.fn().mockResolvedValue({})) as ReturnType<typeof useMutation>,
  );
});
describe("Transaction edit synchronization", () => {
  it("explicitly clears account, payment label, text, tags, and subcategory", async () => {
    render(<EditEntryModal entry={entry} onClose={vi.fn()} />);
    await waitFor(() => expect(form.props).not.toBeNull());
    const draft = {
      ...form.props!.existing,
      account: {},
      title: "",
      merchant: "",
      note: "",
      tags: [],
      subcategoryId: undefined,
    };
    await form.props!.onSubmit(draft);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: null,
        methodOrAccount: "",
        title: "",
        merchant: "",
        note: "",
        tags: [],
        subcategoryId: null,
      }),
    );
  });
  it("sends an explicit category clear for previously categorized entries", async () => {
    render(
      <EditEntryModal
        entry={{ ...entry, categoryId: "food" as Id<"categories"> }}
        onClose={vi.fn()}
      />,
    );
    await form.props!.onSubmit({
      ...form.props!.existing,
      categoryId: undefined,
    });
    expect(save.mock.calls[0][0].categoryId).toBeNull();
  });
  it("does not detach recurring rules during an ordinary edit", async () => {
    render(<EditEntryModal entry={entry} onClose={vi.fn()} />);
    await form.props!.onSubmit(form.props!.existing);
    expect(save.mock.calls[0][0]).not.toHaveProperty("recurringRuleId");
    expect(save.mock.calls[0][0].accountId).toBe("checking");
  });
});
