/**
 * src/routes/matchRoutes.ts
 * ─────────────────────────────────────────────────────────────────
 * Route definitions for /api/matches
 * ─────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import * as matchController from '../controllers/matchController';
import { authenticate } from '../middlewares/authenticate';
import { authorizeAdmin } from '../middlewares/adminMiddleware';

const router = Router();

// GET /api/matches — authenticated (needs userId for prediction join)
router.get('/', authenticate, matchController.getAllMatches);

// PUT /api/matches/:id/score — Admin override score
router.put('/:id/score', authenticate, authorizeAdmin, matchController.updateMatchScore);

export default router;
