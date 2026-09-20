import { describe, it, expect } from "vitest";
import {
  cashflowTotals,
  countsInBudget,
  countsInCashflow,
  isPending,
  pendingTotals,
  reportingAmount,
} from "../lib/finance/semantics";
import { getReviewReason, REVIEW_REASONS } from "../lib/constants";

const expense = (extra: Record<string, unknown> = {}) =>
  ({ type: "expense" as const, amountCents: 1000, ...extra });
const income = (extra: Record<string, unknown> = {}) =>
  ({ type: "income" as const, amountCents: 5000, ...extra });

describe("Shared financial semantics", () => {
  it("drops archived transactions from every total", () => {
    const archived = expense({ isArchived: true });
    expect(countsInCashflow(archived)).toBe(false);
    expect(countsInBudget(archived)).toBe(false);
    expect(cashflowTotals([expense(), archived]).expenseCents).toBe(1000);
  });

  it("keeps pending money out of posted totals and reports it separately", () => {
    const pending = expense({ status: "pending" });
    expect(countsInCashflow(pending)).toBe(false);
    expect(countsInBudget(pending)).toBe(false);
    expect(isPending(pending)).toBe(true);
    expect(cashflowTotals([pending]).expenseCents).toBe(0);
    expect(pendingTotals([pending]).expenseCents).toBe(1000);
  });

  it("does not report an archived pending row as pending", () => {
    expect(pendingTotals([expense({ status: "pending", isArchived: true })]).expenseCents).toBe(0);
  });

  it("nets refunds against spending instead of adding to it", () => {
    const refund = expense({ entryType: "refund", amountCents: 400 });
    expect(reportingAmount(refund)).toBe(-400);
    expect(cashflowTotals([expense(), refund]).expenseCents).toBe(600);
  });

  it("excludes transfers and card payments from cash flow", () => {
    expect(countsInCashflow({ type: "transfer", amountCents: 1000 })).toBe(false);
    expect(countsInCashflow(expense({ entryType: "payment" }))).toBe(false);
    expect(countsInCashflow(expense({ entryType: "transfer" }))).toBe(false);
  });

  it("honours every budget exclusion flag the schema exposes", () => {
    expect(countsInBudget(expense({ excludeFromBudgets: true }))).toBe(false);
    expect(countsInBudget(expense({ ignoredForBudgets: true }))).toBe(false);
    expect(countsInBudget(expense({ excludeFromTotals: true }))).toBe(false);
    expect(countsInBudget(income())).toBe(false);
    expect(countsInBudget(expense())).toBe(true);
  });

  it("only cash flow, never budgets, is narrowed by the insights flag", () => {
    expect(countsInBudget(expense({ ignoredForInsights: true }))).toBe(true);
  });
});

describe("Review reason", () => {
  const base = { category: "Groceries", amountCents: 1000 };

  it("treats a linked account as an account", () => {
    expect(getReviewReason({ ...base, accountId: "acct_1" })).toBeNull();
  });

  it("still accepts a freeform payment label", () => {
    expect(getReviewReason({ ...base, methodOrAccount: "Visa" })).toBeNull();
  });

  it("asks for an account only when neither is present", () => {
    expect(getReviewReason(base)).toBe(REVIEW_REASONS.NEEDS_ACCOUNT);
    expect(getReviewReason({ ...base, accountId: "", methodOrAccount: "  " })).toBe(
      REVIEW_REASONS.NEEDS_ACCOUNT,
    );
  });

  it("reports a missing category before a missing account", () => {
    expect(getReviewReason({ amountCents: 1000 })).toBe(REVIEW_REASONS.NEEDS_CATEGORY);
  });
});
