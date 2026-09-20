/** Shared rules for transactions used by budgets, reporting, and lifecycle updates.
 *
 * Every consumer that totals money — Activity, Dashboard, Insights, budgets, goals,
 * and the coach — reads these predicates instead of re-deriving them. When a rule
 * changes here, every screen changes with it. */
export interface FinancialEntry {
  type: "income" | "expense" | "transfer";
  amountCents: number;
  status?: string;
  entryType?: string | null;
  isArchived?: boolean;
  excludeFromTotals?: boolean;
  excludeFromCashFlow?: boolean;
  excludeFromBudgets?: boolean;
  ignoredForBudgets?: boolean;
  ignoredForInsights?: boolean;
  isTransferSource?: boolean;
}

/** Soft-deleted rows stay in the table but must leave every total. */
export function isActive(entry: FinancialEntry): boolean {
  return !entry.isArchived;
}
export function isPending(entry: FinancialEntry): boolean {
  return isActive(entry) && entry.status === "pending";
}
export function isPosted(entry: FinancialEntry): boolean {
  return isActive(entry) && (!entry.status || entry.status === "posted");
}
export function isTransfer(entry: FinancialEntry): boolean {
  return entry.type === "transfer" || entry.entryType === "transfer" || entry.entryType === "payment";
}
export function countsInCashflow(entry: FinancialEntry): boolean {
  return isPosted(entry) && !isTransfer(entry) && !entry.excludeFromTotals && !entry.excludeFromCashFlow;
}
export function countsInBudget(entry: FinancialEntry): boolean {
  return isPosted(entry) && entry.type === "expense" && !isTransfer(entry) &&
    !entry.excludeFromTotals && !entry.excludeFromBudgets && !entry.ignoredForBudgets;
}
/** Insights may exclude rows that still belong in cash flow, never the reverse. */
export function countsInInsights(entry: FinancialEntry): boolean {
  return countsInCashflow(entry) && !entry.ignoredForInsights;
}
/** A refund reduces the category it was charged to rather than adding to income. */
export function reportingAmount(entry: FinancialEntry): number {
  return Math.abs(entry.amountCents) * (entry.type === "expense" && entry.entryType === "refund" ? -1 : 1);
}
export function cashflowTotals(entries: FinancialEntry[]) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const entry of entries) {
    if (!countsInCashflow(entry)) continue;
    if (entry.type === "income") incomeCents += reportingAmount(entry);
    if (entry.type === "expense") expenseCents += reportingAmount(entry);
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}
/** Money that has left or entered an account but has not posted yet. */
export function pendingTotals(entries: FinancialEntry[]) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const entry of entries) {
    if (!isPending(entry) || isTransfer(entry) || entry.excludeFromTotals || entry.excludeFromCashFlow) continue;
    if (entry.type === "income") incomeCents += reportingAmount(entry);
    if (entry.type === "expense") expenseCents += reportingAmount(entry);
  }
  return { incomeCents, expenseCents };
}
/** Physical money movement is independent of whether a report excludes it. */
export function cashMovement(entry: FinancialEntry): number {
  if (!isPosted(entry)) return 0;
  const amount = Math.abs(entry.amountCents);
  if (entry.type === "transfer") return entry.isTransferSource === true ? -amount : entry.isTransferSource === false ? amount : 0;
  return entry.type === "income" || entry.entryType === "refund" ? amount : -amount;
}
