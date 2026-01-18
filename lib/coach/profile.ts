import { z } from "zod";

export const CoachPayCadenceSchema = z.enum([
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "irregular",
]);

export const CoachRiskToleranceSchema = z.enum(["low", "medium", "high"]);

export const CoachBillSchema = z.object({
  name: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  cadence: CoachPayCadenceSchema,
});

export const CoachProfileSchema = z
  .object({
    monthlyIncomeCents: z.number().int().nonnegative().optional(),
    payCadence: CoachPayCadenceSchema.optional(),
    fixedBills: z.array(CoachBillSchema).optional(),
    monthlyVariableCents: z.number().int().nonnegative().optional(),
    debtBalanceCents: z.number().int().nonnegative().optional(),
    savingsBalanceCents: z.number().int().nonnegative().optional(),
    investmentBalanceCents: z.number().int().nonnegative().optional(),
    goalTarget: z.string().optional(),
    goalTimelineMonths: z.number().int().positive().optional(),
    riskTolerance: CoachRiskToleranceSchema.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const CoachProfileUpdateSchema = CoachProfileSchema.partial();

export type CoachProfile = z.infer<typeof CoachProfileSchema>;
export type CoachProfileUpdate = z.infer<typeof CoachProfileUpdateSchema>;
