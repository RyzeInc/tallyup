import { z } from "zod";
import { CoachProfileUpdateSchema } from "../coach/profile";
import { CoachFoundationUpdateSchema } from "../coach/foundation";

export const CoachOutputSchema = z
  .object({
    assistantMessage: z.string(),
    summaryBullets: z.array(z.string()),
    actions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    metricsUsed: z.array(z.string()).optional().default([]),
    profileUpdates: CoachProfileUpdateSchema.optional(),
    foundationUpdates: CoachFoundationUpdateSchema.optional(),
    memoryDelta: z
      .object({
        summary: z.string().optional(),
        openLoops: z.array(z.string()).optional(),
      })
      .optional(),
    memoryUpdates: z
      .array(
        z.object({
          type: z.string(),
          content: z.string(),
          confidence: z.enum(["user_said", "inferred"]).optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .optional(),
    transactionDrilldownRequest: z
      .object({
        reason: z.string(),
        windowDays: z.number().int().min(7).max(90),
      })
      .optional(),
  })
  .strict();

export type CoachOutput = z.infer<typeof CoachOutputSchema>;
