import { z } from "zod";
import { CoachPayCadenceSchema } from "./profile";

export const CoachBalanceSheetSchema = z
  .object({
    cashCents: z.number().int().nonnegative().optional(),
    savingsCents: z.number().int().nonnegative().optional(),
    creditCardDebtCents: z.number().int().nonnegative().optional(),
    loanDebtCents: z.number().int().nonnegative().optional(),
    retirementCents: z.number().int().nonnegative().optional(),
    investmentCents: z.number().int().nonnegative().optional(),
    otherAssetsCents: z.number().int().nonnegative().optional(),
    otherLiabilitiesCents: z.number().int().nonnegative().optional(),
  })
  .strict();

export const CoachDebtSchema = z
  .object({
    name: z.string().min(1),
    balanceCents: z.number().int().nonnegative(),
    aprPct: z.number().min(0).max(100).optional(),
    minPaymentCents: z.number().int().nonnegative().optional(),
    promoEndsOn: z.string().optional(),
    status: z.enum(["current", "delinquent", "collections"]).optional(),
  })
  .strict();

export const CoachIncomeProfileSchema = z
  .object({
    cadence: CoachPayCadenceSchema.optional(),
    employmentType: z.enum(["salaried", "hourly", "commission", "self_employed", "mixed"]).optional(),
    variability: z.enum(["stable", "variable", "seasonal"]).optional(),
    baselineMonthlyCents: z.number().int().nonnegative().optional(),
    worstMonthCents: z.number().int().nonnegative().optional(),
    typicalMonthCents: z.number().int().nonnegative().optional(),
    bestMonthCents: z.number().int().nonnegative().optional(),
  })
  .strict();

export const CoachFixedObligationSchema = z
  .object({
    name: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
    cadence: CoachPayCadenceSchema,
  })
  .strict();

export const CoachGoalSchema = z
  .object({
    name: z.string().min(1),
    priority: z.number().int().min(1).max(5).optional(),
    targetDate: z.string().optional(),
    targetAmountCents: z.number().int().nonnegative().optional(),
    sacrificeLevel: z.enum(["low", "medium", "high"]).optional(),
    constraints: z.string().optional(),
  })
  .strict();

export const CoachRiskProfileSchema = z
  .object({
    dependentsCount: z.number().int().nonnegative().optional(),
    insurance: z
      .object({
        health: z.enum(["covered", "not_covered", "unknown"]).optional(),
        auto: z.enum(["covered", "not_covered", "unknown"]).optional(),
        homeRenters: z.enum(["covered", "not_covered", "unknown"]).optional(),
        disability: z.enum(["covered", "not_covered", "unknown"]).optional(),
        life: z.enum(["covered", "not_covered", "unknown"]).optional(),
      })
      .strict()
      .optional(),
    benefitsNotes: z.string().optional(),
  })
  .strict();

export const CoachTaxProfileSchema = z
  .object({
    filingStatus: z.enum(["single", "married_joint", "married_separate", "head_of_household"]).optional(),
    incomeMix: z
      .object({
        w2Pct: z.number().min(0).max(100).optional(),
        form1099Pct: z.number().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    roughBracketPct: z.number().min(0).max(60).optional(),
    deductionsNotes: z.string().optional(),
    owedOrRefund: z.enum(["owed", "refund", "mixed", "unknown"]).optional(),
  })
  .strict();

export const CoachFoundationSchema = z
  .object({
    balanceSheet: CoachBalanceSheetSchema.optional(),
    debts: z.array(CoachDebtSchema).optional(),
    incomeProfile: CoachIncomeProfileSchema.optional(),
    fixedObligations: z.array(CoachFixedObligationSchema).optional(),
    goals: z.array(CoachGoalSchema).optional(),
    riskProfile: CoachRiskProfileSchema.optional(),
    taxProfile: CoachTaxProfileSchema.optional(),
  })
  .strict();

export const CoachFoundationUpdateSchema = CoachFoundationSchema.partial();

export type CoachFoundation = z.infer<typeof CoachFoundationSchema>;
export type CoachFoundationUpdate = z.infer<typeof CoachFoundationUpdateSchema>;
