/**
 * src/controllers/predictionController.ts
 * ─────────────────────────────────────────────────────────────────
 * HTTP handler for prediction submission.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import * as predictionService from '../services/predictionService';
import { SubmitPredictionInput } from '../schemas/prediction.schema';

/**
 * POST /api/predictions
 * Submits or updates a prediction for a match.
 * Returns 400 if the match kickoff time has passed.
 */
export const submitPrediction = async (
  req: Request<object, object, SubmitPredictionInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { matchId, predictedScoreA, predictedScoreB, useDoublePoints, penaltyWinner } = req.body;

    const prediction = await predictionService.submitOrUpdatePrediction(
      req.user!.id,
      matchId,
      predictedScoreA,
      predictedScoreB,
      useDoublePoints,
      penaltyWinner,
    );

    res.status(201).json({
      status: 'success',
      message: 'Prediction saved!',
      data: { prediction },
    });
  } catch (err) {
    next(err);
  }
};
