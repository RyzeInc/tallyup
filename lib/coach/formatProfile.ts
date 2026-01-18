import type { CoachProfileUpdate } from "./profile";
import { formatMoney } from "@/components/utils";

const LABELS: Record<keyof CoachProfileUpdate, string> = {
  monthlyIncomeCents: "Monthly take-home income",
  payCadence: "Pay cadence",
  fixedBills: "Fixed bills",
  monthlyVariableCents: "Monthly variable spending",
  debtBalanceCents: "Total debt balance",
  savingsBalanceCents: "Savings balance",
  investmentBalanceCents: "Investment balance",
  goalTarget: "Goal target",
  goalTimelineMonths: "Goal timeline (months)",
  riskTolerance: "Risk tolerance",
  notes: "Notes",
};

function formatCadence(value: CoachProfileUpdate["payCadence"]): string {
  if (!value) return "";
  switch (value) {
    case "semimonthly":
      return "Semi-monthly";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export function formatProfileUpdate(update: CoachProfileUpdate): string[] {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(update) as Array<
    [keyof CoachProfileUpdate, CoachProfileUpdate[keyof CoachProfileUpdate]]
  >) {
    if (value === undefined) continue;
    const label = LABELS[key] ?? key;
    if (key === "fixedBills" && Array.isArray(value)) {
      const bills = value.map((bill) => `${bill.name}: ${formatMoney(bill.amountCents)} (${formatCadence(bill.cadence)})`);
      if (bills.length) lines.push(`${label}: ${bills.join(", ")}`);
      continue;
    }
    if (typeof value === "number" && key.endsWith("Cents")) {
      lines.push(`${label}: ${formatMoney(value)}`);
      continue;
    }
    if (key === "payCadence" && typeof value === "string") {
      lines.push(`${label}: ${formatCadence(value as CoachProfileUpdate["payCadence"])}`);
      continue;
    }
    lines.push(`${label}: ${String(value)}`);
  }

  return lines;
}
