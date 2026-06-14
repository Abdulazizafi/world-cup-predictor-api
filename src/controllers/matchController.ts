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



