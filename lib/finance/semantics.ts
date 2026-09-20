/** Shared rules for transactions used by budgets, reporting, and lifecycle updates. */
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
export function isPosted(entry: FinancialEntry): boolean {
  return !entry.isArchived && (!entry.status || entry.status === "posted");
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
/** Physical money movement is independent of whether a report excludes it. */
export function cashMovement(entry: FinancialEntry): number {
  if (!isPosted(entry)) return 0;
  const amount = Math.abs(entry.amountCents);
  if (entry.type === "transfer") return entry.isTransferSource === true ? -amount : entry.isTransferSource === false ? amount : 0;
  return entry.type === "income" || entry.entryType === "refund" ? amount : -amount;
}
