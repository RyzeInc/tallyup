import React from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import ActivityPage from "../app/(app)/activity/page";
import type { Doc } from "../convex/_generated/dataModel";

const state = vi.hoisted(() => ({
  results: [] as Doc<"entries">[],
  status: "Exhausted",
  loadMore: vi.fn(),
  edit: null as Doc<"entries"> | null,
  params: new URLSearchParams(),
  query: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: true }),
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  SignInButton: () => null,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.params }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (...args: unknown[]) => state.query(...args),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({
    results: state.results,
    status: state.status,
    loadMore: state.loadMore,
  }),
}));
vi.mock("../components/TimeRangeProvider", () => ({
  useTimeRange: () => ({ startDate: 0, endDate: 1000, label: "This month" }),
}));
vi.mock("../components/GlobalDateRangePicker", () => ({
  default: () => <button>Date range</button>,
}));
vi.mock("../components/activity/ActivityTable", () => ({
  default: ({ entries }: { entries: Doc<"entries">[] }) => (
    <div data-testid="rows">
      {entries.map((entry) => (
        <span key={entry._id}>{entry.title}</span>
      ))}
    </div>
  ),
}));
vi.mock("../components/EditEntryModal", () => ({
  default: ({
    entry,
    onClose,
  }: {
    entry: Doc<"entries">;
    onClose: () => void;
  }) => (
    <div role="dialog">
      {entry.title}
      <button onClick={onClose}>Close edit</button>
    </div>
  ),
}));
vi.mock("../components/RecurringModal", () => ({ default: () => null }));
const accounts = [{ _id: "checking", name: "Checking" }];
const categories = [
  { _id: "groceries", name: "Groceries", categoryType: "expense" },
];
const row = {
  _id: "entry",
  _creationTime: 1,
  userId: "owner",
  type: "expense",
  amountCents: 1000,
  date: 50,
  title: "Grocery trip",
  accountId: "checking",
  categoryId: "groceries",
} as Doc<"entries">;
function navigate(search: string) {
  window.history.replaceState(null, "", `/activity${search}`);
  state.params = new URLSearchParams(search);
}
beforeEach(() => {
  navigate("");
  state.results = [row];
  state.status = "Exhausted";
  state.edit = null;
  state.loadMore.mockClear();
  state.query.mockImplementation((ref, args) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name === "accounts:listAccounts") return accounts;
    if (name === "categories:listCategories") return categories;
    if (name === "entries:getActivityEntry") return state.edit;
  });
});
describe("Activity page integration", () => {
  it("loads later pages automatically and never announces a premature empty result", () => {
    state.status = "CanLoadMore";
    state.results = [];
    const view = render(<ActivityPage />);
    expect(state.loadMore).toHaveBeenCalledWith(250);
    expect(
      screen.queryByText("No activity in this period"),
    ).not.toBeInTheDocument();
    state.status = "Exhausted";
    state.results = [row];
    view.rerender(<ActivityPage />);
    expect(screen.getByTestId("rows")).toHaveTextContent("Grocery trip");
  });
  it("immediately reflects edited and deleted query results", () => {
    const view = render(<ActivityPage />);
    expect(screen.getByTestId("rows")).toHaveTextContent("Grocery trip");
    state.results = [{ ...row, title: "Updated groceries" }];
    view.rerender(<ActivityPage />);
    expect(screen.getByTestId("rows")).toHaveTextContent("Updated groceries");
    state.results = [];
    view.rerender(<ActivityPage />);
    expect(screen.queryByTestId("rows")).not.toBeInTheDocument();
  });
  it("reads navigation changes and resets search and review when params disappear", () => {
    navigate("?q=missing&review=1");
    const view = render(<ActivityPage />);
    expect(screen.getByText("No matching transactions")).toBeInTheDocument();
    navigate("");
    view.rerender(<ActivityPage />);
    expect(
      screen.getByRole("textbox", { name: "Search transactions" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Needs review" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("rows")).toHaveTextContent("Grocery trip");
  });
  it("opens an edit target independently of filters and preserves filters on close", () => {
    navigate("?account=other&edit=entry");
    state.edit = row;
    render(<ActivityPage />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Grocery trip");
    fireEvent.click(screen.getByRole("button", { name: "Close edit" }));
    expect(window.location.search).toBe("?account=other");
  });
  it("clears every filter, including search and review", () => {
    navigate("?account=checking&category=groceries&q=Grocery&review=1&min=1");
    render(<ActivityPage />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear all filters" })[0],
    );
    expect(window.location.search).toBe("");
  });
});
