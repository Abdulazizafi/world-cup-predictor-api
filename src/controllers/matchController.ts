/**
 * src/controllers/matchController.ts
 * ─────────────────────────────────────────────────────────────────
 * HTTP handler for match retrieval.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import * as matchService from '../services/matchService';
import { AppError } from '../errors/AppError';

/**
 * GET /api/matches
 * Returns all World Cup matches with the current user's prediction joined.
 */
export const getAllMatches = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const matches = await matchService.getAllMatches(req.user!.id);

    res.status(200).json({
      status: 'success',
      data: {
        count: matches.length,
        matches,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/matches/:id/score
 * Updates match score and status manually (Admin only).
 * Triggers point calculations if status is set to FINISHED.
 */
export const updateMatchScore = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const matchId = req.params.id;
    const { status } = req.body;
    let { scoreA, scoreB } = req.body;

    // 1. Validation
    if (!['PENDING', 'LIVE', 'FINISHED'].includes(status)) {
      throw new AppError('Invalid status value. Must be PENDING, LIVE, or FINISHED.', 400);
    }

    if (status === 'PENDING') {
      scoreA = null;
      scoreB = null;
    } else {
      if (scoreA === undefined || scoreB === undefined || scoreA === null || scoreB === null) {
        throw new AppError('Scores are required for LIVE or FINISHED matches.', 400);
      }
      const sa = parseInt(String(scoreA), 10);
      const sb = parseInt(String(scoreB), 10);
      if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0) {
        throw new AppError('Scores must be non-negative integers.', 400);
      }
      scoreA = sa;
      scoreB = sb;
    }

    // 2. Call service
    const match = await matchService.updateMatchScore(matchId, scoreA, scoreB, status);

    res.status(200).json({
      status: 'success',
      data: {
        match,
      },
    });
  } catch (err) {
    next(err);
  }
};

