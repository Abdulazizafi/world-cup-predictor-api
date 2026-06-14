/**
 * src/routes/matchRoutes.ts
 * ─────────────────────────────────────────────────────────────────
 * Route definitions for /api/matches
 * ─────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import * as matchController from '../controllers/matchController';
import { authenticate } from '../middlewares/authenticate';

const router = Router();

// GET /api/matches — authenticated (needs userId for prediction join)
router.get('/', authenticate, matchController.getAllMatches);

export default router;
