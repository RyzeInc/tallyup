import React from "react";
import { beforeAll, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActivityFilters from "../components/activity/ActivityFilters";
import { emptyFilters } from "../lib/activity/filters";
import type { Doc } from "../convex/_generated/dataModel";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
const accounts = [
  {
    _id: "checking",
    name: "Checking",
    last4: "1234",
    institutionName: "Test Bank",
  },
] as Doc<"accounts">[];
const categories = [
  { _id: "food", name: "Food & Drink", categoryType: "expense" },
  {
    _id: "groceries",
    name: "Groceries",
    parentId: "food",
    categoryType: "expense",
  },
] as Doc<"categories">[];
function setup() {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <ActivityFilters
      filters={emptyFilters}
      entries={[]}
      accounts={accounts}
      categories={categories}
      loading={false}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  return { onApply, onClose };
}
describe("Activity filter panel", () => {
  it("keeps account choices reachable and categories compact with selected summaries", () => {
    setup();
    expect(screen.getByText("Accounts").closest("details")).toHaveAttribute(
      "open",
    );
    expect(
      screen.getByText("Categories").closest("details"),
    ).not.toHaveAttribute("open");
    expect(screen.getByText("Test Bank · ••1234")).toBeVisible();
  });
  it("keeps draft changes local until applied and cancel does not apply", () => {
    const { onApply, onClose } = setup();
    fireEvent.click(screen.getByLabelText(/Checking/));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close filters" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });
  it("applies selected accounts and resets all dimensions", () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByLabelText(/Checking/));
    fireEvent.click(
      screen.getByRole("button", { name: "Show 0 transactions" }),
    );
    expect(onApply).toHaveBeenCalledWith({
      ...emptyFilters,
      accounts: ["checking"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Show 0 transactions" }),
    );
    expect(onApply).toHaveBeenLastCalledWith(emptyFilters);
  });
  it("searches categories and shows their parent context", () => {
    setup();
    screen.getByText("Categories").closest("details")!.open = true;
    fireEvent.change(screen.getByLabelText("Find a category"), {
      target: { value: "grocer" },
    });
    expect(screen.getByLabelText(/Groceries/)).toBeVisible();
    expect(screen.getByText("Spending · Food & Drink")).toBeVisible();
    expect(screen.queryByLabelText(/^Food & Drink/)).not.toBeInTheDocument();
  });
  it("shows legacy category drill-downs as selected and lets users remove them", () => {
    const onApply = vi.fn();
    render(
      <ActivityFilters
        filters={{ ...emptyFilters, categories: ["Groceries"] }}
        entries={[]}
        accounts={accounts}
        categories={categories}
        loading={false}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );
    screen.getByText("Categories").closest("details")!.open = true;
    expect(screen.getByLabelText(/Groceries/)).toBeChecked();
    fireEvent.click(screen.getByLabelText(/Groceries/));
    fireEvent.click(
      screen.getByRole("button", { name: "Show 0 transactions" }),
    );
    expect(onApply).toHaveBeenCalledWith(emptyFilters);
  });
  it("blocks invalid amount ranges with an explanation", () => {
    setup();
    screen.getByText("Amount").closest("details")!.open = true;
    fireEvent.change(screen.getByLabelText("Minimum ($)"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Maximum ($)"), {
      target: { value: "50" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Minimum must be less than or equal",
    );
    expect(
      screen.getByRole("button", { name: "Show 0 transactions" }),
    ).toBeDisabled();
  });
});
