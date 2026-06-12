/**
 * src/controllers/authController.ts
 * ─────────────────────────────────────────────────────────────────
 * HTTP handlers for authentication endpoints.
 * Controllers are thin — they extract request data, call services,
 * and format HTTP responses. No business logic lives here.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';

/**
 * POST /api/auth/register
 * Creates a new user and immediately logs them in (sets JWT cookie).
 */
export const register = async (
  req: Request<object, object, RegisterInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username, password } = req.body;
    const user = await authService.register(res, username, password);

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully.',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Validates credentials and sets a fresh JWT cookie.
 */
export const login = async (
  req: Request<object, object, LoginInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username, password } = req.body;
    const user = await authService.login(res, username, password);

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully.',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Clears the JWT cookie.
 */
export const logout = (
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  authService.logout(res);

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
};

/**
 * GET /api/auth/me
 * Returns the current user's profile including their group info.
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // req.user is guaranteed by the authenticate middleware
    const user = await authService.getMe(req.user!.id);

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};
