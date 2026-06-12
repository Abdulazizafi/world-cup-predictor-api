/**
 * src/services/pointsEngine.ts
 * ─────────────────────────────────────────────────────────────────
 * Points Calculation Engine.
 *
 * Called automatically by the SyncService when a match transitions
 * to FINISHED status. Scores all existing predictions for that match
 * and bulk-updates the database in a single transaction.
 *
 * Scoring Rules:
 *   Exact score match  (e.g. predicted 2-1, result 2-1) → 5 points
 *   Correct outcome    (e.g. predicted 3-0, result 1-0) → 3 points
 *   Wrong prediction                                    → 0 points
 * ─────────────────────────────────────────────────────────────────
 */
import * as predictionRepo from '../repositories/predictionRepository';

/**
 * Determines the match outcome from a score pair.
 * Returns 'A' if Team A wins, 'B' if Team B wins, 'D' for draw.
 */
const getOutcome = (scoreA: number, scoreB: number): 'A' | 'B' | 'D' => {
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'D';
};

/**
 * Calculate and persist points for all predictions on a finished match.
 *
 * @param matchId      - Internal UUID of the finished match
 * @param actualScoreA - Final goals scored by Team A
 * @param actualScoreB - Final goals scored by Team B
 */
export const calculatePoints = async (
  matchId: string,
  actualScoreA: number,
  actualScoreB: number,
): Promise<{ updated: number; totalPoints: number }> => {
  // 1. Fetch all predictions for this match
  const predictions = await predictionRepo.findPredictionsByMatchId(matchId);

  if (predictions.length === 0) {
    console.log(`⚙️  Points Engine: No predictions for match ${matchId}. Skipping.`);
    return { updated: 0, totalPoints: 0 };
  }

  const actualOutcome = getOutcome(actualScoreA, actualScoreB);

  // 2. Score each prediction
  const updates = predictions.map((prediction) => {
    const predictedOutcome = getOutcome(
      prediction.predictedScoreA,
      prediction.predictedScoreB,
    );

    let pointsEarned = 0;

    if (
      prediction.predictedScoreA === actualScoreA &&
      prediction.predictedScoreB === actualScoreB
    ) {
      // Perfect: exact scoreline match
      pointsEarned = 5;
    } else if (predictedOutcome === actualOutcome) {
      // Good: correct winner/draw but wrong scores
      pointsEarned = 3;
    }
    // else: wrong outcome → 0 points (already initialised)

    return { id: prediction.id, pointsEarned };
  });

  // 3. Persist all updates in a single atomic transaction
  await predictionRepo.bulkUpdatePoints(updates);

  const totalPoints = updates.reduce((sum, u) => sum + u.pointsEarned, 0);

  console.log(
    `⚙️  Points Engine: Match ${matchId} scored. ` +
      `${updates.length} predictions updated. ` +
      `Total points awarded: ${totalPoints}.`,
  );

  return { updated: updates.length, totalPoints };
};
