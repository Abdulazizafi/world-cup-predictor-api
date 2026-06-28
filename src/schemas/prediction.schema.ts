/**
 * src/schemas/prediction.schema.ts
 * ─────────────────────────────────────────────────────────────────
 * Zod validation schema for prediction submission.
 * ─────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';

/**
 * Schema for POST /api/predictions
 *
 * Score rules:
 *   - Non-negative integers (can't predict negative goals)
 *   - Max 30 (sanity cap — highest scoring WC game was 10-1)
 */
export const SubmitPredictionSchema = z.object({
  matchId: z
    .string({ required_error: 'Match ID is required.' })
    .uuid('Match ID must be a valid UUID.'),

  predictedScoreA: z
    .number({ required_error: 'Predicted score for Team A is required.' })
    .int('Score must be a whole number.')
    .min(0, 'Score cannot be negative.')
    .max(30, 'Score seems unrealistically high.'),

  predictedScoreB: z
    .number({ required_error: 'Predicted score for Team B is required.' })
    .int('Score must be a whole number.')
    .min(0, 'Score cannot be negative.')
    .max(30, 'Score seems unrealistically high.'),

  useDoublePoints: z.boolean().optional(),

  penaltyWinner: z.enum(['A', 'B']).nullable().optional(),
});

// Inferred TypeScript type
export type SubmitPredictionInput = z.infer<typeof SubmitPredictionSchema>;
