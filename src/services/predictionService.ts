/**
 * src/services/predictionService.ts
 * ─────────────────────────────────────────────────────────────────
 * Business logic for prediction submission.
 *
 * Critical UX Rule enforced here:
 *   Predictions are LOCKED once the match kickoff time has passed.
 *   Any submission at or after match.matchTime is rejected with 400.
 * ─────────────────────────────────────────────────────────────────
 */
import * as predictionRepo from '../repositories/predictionRepository';
import * as matchRepo from '../repositories/matchRepository';
import * as groupRepo from '../repositories/groupRepository';
import { AppError } from '../errors/AppError';

/**
 * Submit or update a prediction for a match.
 *
 * Flow:
 *   1. Validate the match exists
 *   2. Enforce kickoff lock — reject if match has started or finished
 *   3. Upsert the prediction (creates if new, updates if existing)
 *
 * @param userId          - The authenticated user's ID
 * @param matchId         - The match UUID being predicted
 * @param predictedScoreA - User's predicted goals for Team A
 * @param predictedScoreB - User's predicted goals for Team B
 */
export const submitOrUpdatePrediction = async (
  userId: string,
  matchId: string,
  predictedScoreA: number,
  predictedScoreB: number,
  useDoublePoints?: boolean,
  penaltyWinner?: string | null,
) => {
  // 1. Resolve the match
  const match = await matchRepo.findMatchById(matchId);
  if (!match) {
    throw new AppError('Match not found.', 404);
  }

  // 2. Enforce the prediction window: open only within 24 hours before kickoff
  const now = new Date();
  const matchTimeMs = new Date(match.matchTime).getTime();
  const opensAt = matchTimeMs - 24 * 60 * 60 * 1000;

  if (now.getTime() < opensAt) {
    throw new AppError(
      `Predictions for ${match.teamA} vs ${match.teamB} are not open yet. They open 24 hours before kickoff.`,
      400,
    );
  }

  if (now.getTime() >= matchTimeMs || match.status === 'FINISHED' || match.status === 'LIVE') {
    throw new AppError(
      `Predictions for ${match.teamA} vs ${match.teamB} are closed. The match has already started or finished.`,
      400,
    );
  }

  // Validate the Double Points limit (max 5 tokens)
  if (useDoublePoints === true) {
    const isBanned = await groupRepo.isUserTransferBanned(userId);
    if (isBanned) {
      throw new AppError('You are banned from using double points by order of the Sheikh!', 400);
    }

    const currentX2Count = await predictionRepo.countDoublePointsPredictions(userId, matchId);
    if (currentX2Count >= 5) {
      throw new AppError('You can only apply Double Points (x2) to a maximum of 5 matches.', 400);
    }
  }

  // 3. Upsert the prediction
  const prediction = await predictionRepo.upsertPrediction({
    userId,
    matchId,
    predictedScoreA,
    predictedScoreB,
    useDoublePoints,
    penaltyWinner,
  });

  return {
    id: prediction.id,
    matchId: prediction.matchId,
    predictedScoreA: prediction.predictedScoreA,
    predictedScoreB: prediction.predictedScoreB,
    pointsEarned: prediction.pointsEarned,
    useDoublePoints: prediction.useDoublePoints,
    penaltyWinner: prediction.penaltyWinner,
    createdAt: prediction.createdAt,
    updatedAt: prediction.updatedAt,
    match: {
      teamA: match.teamA,
      teamB: match.teamB,
      matchTime: match.matchTime,
      stage: match.stage,
    },
  };
};

