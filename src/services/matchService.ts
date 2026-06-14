/**
 * src/services/matchService.ts
 * ─────────────────────────────────────────────────────────────────
 * Business logic for match retrieval.
 * Thin layer — most logic lives in the repository since match data
 * is read-only from the API's perspective.
 * ─────────────────────────────────────────────────────────────────
 */
import * as matchRepo from '../repositories/matchRepository';
import { calculatePoints } from './pointsEngine';

/**
 * Retrieve all World Cup matches, with the current user's prediction
 * joined to each match (or null if they haven't predicted yet).
 */
export const getAllMatches = async (userId: string) => {
  return matchRepo.getAllMatches(userId);
};

/**
 * Override match score and status manually (Admin only).
 * Triggers points calculation engine if the match is marked as FINISHED.
 */
export const updateMatchScore = async (
  matchId: string,
  scoreA: number | null,
  scoreB: number | null,
  status: string,
) => {
  const updatedMatch = await matchRepo.updateMatchScoreAndStatus(
    matchId,
    scoreA,
    scoreB,
    status,
  );

  if (status === 'FINISHED' && scoreA !== null && scoreB !== null) {
    await calculatePoints(matchId, scoreA, scoreB);
  }

  return updatedMatch;
};

