/**
 * src/routes/groupRoutes.ts
 * ─────────────────────────────────────────────────────────────────
 * Route definitions for /api/groups
 * All group routes require authentication.
 * ─────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import * as groupController from '../controllers/groupController';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { CreateGroupSchema, JoinGroupSchema } from '../schemas/group.schema';

const router = Router();

// Apply authentication to all group routes
router.use(authenticate);

// POST /api/groups/create
router.post('/create', validate(CreateGroupSchema), groupController.createGroup);

// POST /api/groups/join
router.post('/join', validate(JoinGroupSchema), groupController.joinGroup);

// GET /api/groups/:groupId/leaderboard
router.get('/:groupId/leaderboard', groupController.getLeaderboard);

// GET /api/groups/:groupId/activity
router.get('/:groupId/activity', groupController.getGroupActivity);

// GET /api/groups/:groupId/compare/:userId
router.get('/:groupId/compare/:userId', groupController.comparePredictions);

// GET /api/groups/:groupId/insights
router.get('/:groupId/insights', groupController.getGroupInsights);

// Sheikh Decrees
router.get('/:groupId/active-decree', groupController.getActiveDecree);
router.post('/:groupId/decree', groupController.issueDecree);
router.post('/:groupId/swear-allegiance', groupController.swearAllegiance);

export default router;
