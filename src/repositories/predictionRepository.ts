/**
 * src/repositories/predictionRepository.ts
 * ─────────────────────────────────────────────────────────────────
 * Data access layer for the Prediction model.
 * ─────────────────────────────────────────────────────────────────
 */
import { PrismaClient, Prediction } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Find a user's prediction for a specific match.
 * Used to check if a prediction already exists (for update vs create).
 */
export const findPrediction = async (
  userId: string,
  matchId: string,
): Promise<Prediction | null> => {
  return prisma.prediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
};

/**
 * Upsert a prediction (create if new, update if existing).
 * The @@unique([userId, matchId]) constraint guarantees at most one
 * prediction per user per match in the database.
 */
export const upsertPrediction = async (data: {
  userId: string;
  matchId: string;
  predictedScoreA: number;
  predictedScoreB: number;
  useDoublePoints?: boolean;
  penaltyWinner?: string | null;
}): Promise<Prediction> => {
  return prisma.prediction.upsert({
    where: { userId_matchId: { userId: data.userId, matchId: data.matchId } },
    update: {
      predictedScoreA: data.predictedScoreA,
      predictedScoreB: data.predictedScoreB,
      useDoublePoints: data.useDoublePoints,
      penaltyWinner: data.penaltyWinner,
    },
    create: {
      userId: data.userId,
      matchId: data.matchId,
      predictedScoreA: data.predictedScoreA,
      predictedScoreB: data.predictedScoreB,
      useDoublePoints: data.useDoublePoints ?? false,
      penaltyWinner: data.penaltyWinner,
    },
  });
};

/**
 * Get all predictions for a specific match.
 * Used by the Points Engine after a match finishes.
 */
export const findPredictionsByMatchId = async (
  matchId: string,
): Promise<Prediction[]> => {
  return prisma.prediction.findMany({ where: { matchId } });
};

/**
 * Bulk update points for a list of predictions.
 * Wrapped in a single transaction for atomicity — either all succeed
 * or none do, preventing partial point updates.
 */
export const bulkUpdatePoints = async (
  updates: Array<{ id: string; pointsEarned: number }>,
): Promise<void> => {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.prediction.update({
        where: { id: u.id },
        data: { pointsEarned: u.pointsEarned },
      }),
    ),
  );
};

/**
 * Count how many double points predictions a user has currently active,
 * optionally excluding a specific matchId (e.g. when updating).
 */
export const countDoublePointsPredictions = async (
  userId: string,
  excludeMatchId?: string,
): Promise<number> => {
  return prisma.prediction.count({
    where: {
      userId,
      useDoublePoints: true,
      NOT: excludeMatchId ? { matchId: excludeMatchId } : undefined,
    },
  });
};
