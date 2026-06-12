/**
 * src/routes/predictionRoutes.ts
 * ─────────────────────────────────────────────────────────────────
 * Route definitions for /api/predictions
 * ─────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import * as predictionController from '../controllers/predictionController';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { SubmitPredictionSchema } from '../schemas/prediction.schema';

const router = Router();

// POST /api/predictions — authenticated + validated
router.post(
  '/',
  authenticate,
  validate(SubmitPredictionSchema),
  predictionController.submitPrediction,
);

export default router;
