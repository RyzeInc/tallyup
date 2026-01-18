import { formatMoney } from "@/components/utils";
import type { CoachFoundationUpdate } from "./foundation";

function formatCadence(value: string | undefined): string {
  if (!value) return "";
  if (value === "semimonthly") return "Semi-monthly";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatFoundationUpdate(update: CoachFoundationUpdate): string[] {
  const lines: string[] = [];

  if (update.balanceSheet) {
    const bs = update.balanceSheet;
    if (bs.cashCents !== undefined) lines.push(`Cash: ${formatMoney(bs.cashCents)}`);
    if (bs.savingsCents !== undefined) lines.push(`Savings: ${formatMoney(bs.savingsCents)}`);
    if (bs.creditCardDebtCents !== undefined) lines.push(`Credit card debt: ${formatMoney(bs.creditCardDebtCents)}`);
    if (bs.loanDebtCents !== undefined) lines.push(`Loan debt: ${formatMoney(bs.loanDebtCents)}`);
    if (bs.retirementCents !== undefined) lines.push(`Retirement: ${formatMoney(bs.retirementCents)}`);
    if (bs.investmentCents !== undefined) lines.push(`Investments: ${formatMoney(bs.investmentCents)}`);
  }

  if (update.debts?.length) {
    update.debts.forEach((debt) => {
      const pieces = [debt.name, formatMoney(debt.balanceCents)];
      if (debt.aprPct !== undefined) pieces.push(`${debt.aprPct}% APR`);
      if (debt.minPaymentCents !== undefined) pieces.push(`Min ${formatMoney(debt.minPaymentCents)}`);
      if (debt.status) pieces.push(debt.status);
      lines.push(`Debt: ${pieces.join(" - ")}`);
    });
  }

  if (update.incomeProfile) {
    const income = update.incomeProfile;
    if (income.cadence) lines.push(`Income cadence: ${formatCadence(income.cadence)}`);
    if (income.employmentType) lines.push(`Employment type: ${income.employmentType}`);
    if (income.variability) lines.push(`Income variability: ${income.variability}`);
    if (income.baselineMonthlyCents !== undefined) lines.push(`Baseline monthly income: ${formatMoney(income.baselineMonthlyCents)}`);
  }

  if (update.fixedObligations?.length) {
    update.fixedObligations.forEach((bill) => {
      lines.push(`Fixed obligation: ${bill.name} - ${formatMoney(bill.amountCents)} (${formatCadence(bill.cadence)})`);
    });
  }

  if (update.goals?.length) {
    update.goals.forEach((goal) => {
      const parts = [goal.name];
      if (goal.targetAmountCents !== undefined) parts.push(formatMoney(goal.targetAmountCents));
      if (goal.targetDate) parts.push(`By ${goal.targetDate}`);
      if (goal.priority !== undefined) parts.push(`Priority ${goal.priority}`);
      if (goal.sacrificeLevel) parts.push(`Sacrifice ${goal.sacrificeLevel}`);
      lines.push(`Goal: ${parts.join(" - ")}`);
    });
  }

  if (update.riskProfile) {
    const risk = update.riskProfile;
    if (risk.dependentsCount !== undefined) lines.push(`Dependents: ${risk.dependentsCount}`);
    if (risk.insurance) {
      const insurancePieces = Object.entries(risk.insurance)
        .map(([key, value]) => `${key}: ${value}`);
      if (insurancePieces.length) lines.push(`Insurance: ${insurancePieces.join(", ")}`);
    }
  }

  if (update.taxProfile) {
    const tax = update.taxProfile;
    if (tax.filingStatus) lines.push(`Filing status: ${tax.filingStatus}`);
    if (tax.roughBracketPct !== undefined) lines.push(`Rough tax bracket: ${tax.roughBracketPct}%`);
    if (tax.owedOrRefund) lines.push(`Tax outcome: ${tax.owedOrRefund}`);
  }

  return lines;
}
