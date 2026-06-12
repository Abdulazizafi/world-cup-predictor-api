/**
 * src/services/matchService.ts
 * ─────────────────────────────────────────────────────────────────
 * Business logic for match retrieval.
 * Thin layer — most logic lives in the repository since match data
 * is read-only from the API's perspective.
 * ─────────────────────────────────────────────────────────────────
 */
import * as matchRepo from '../repositories/matchRepository';

/**
 * Retrieve all World Cup matches, with the current user's prediction
 * joined to each match (or null if they haven't predicted yet).
 */
export const getAllMatches = async (userId: string) => {
  return matchRepo.getAllMatches(userId);
};
