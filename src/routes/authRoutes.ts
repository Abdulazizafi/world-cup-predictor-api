/**
 * src/routes/authRoutes.ts
 * ─────────────────────────────────────────────────────────────────
 * Route definitions for /api/auth
 * ─────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { RegisterSchema, LoginSchema } from '../schemas/auth.schema';

const router = Router();

// POST /api/auth/register — public
router.post('/register', validate(RegisterSchema), authController.register);

// POST /api/auth/login — public
router.post('/login', validate(LoginSchema), authController.login);

// POST /api/auth/logout — requires auth (to clear valid session)
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me — requires auth
router.get('/me', authenticate, authController.getMe);

export default router;
