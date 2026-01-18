import { z } from "zod";

export const CoachOutputSchema = z
  .object({
    assistantMessage: z.string(),
    summaryBullets: z.array(z.string()),
    actions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    metricsUsed: z.array(z.string()).optional().default([]),
  })
  .strict();

export type CoachOutput = z.infer<typeof CoachOutputSchema>;
