/**
 * src/middlewares/adminMiddleware.ts
 * ─────────────────────────────────────────────────────────────────
 * Admin authorization middleware.
 *
 * Checks if the logged-in user has admin privileges. Privileged
 * usernames are configured via the ADMIN_USERNAMES environment
 * variable (comma-separated, case-insensitive).
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export const authorizeAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // 1. Ensure user is authenticated
  if (!req.user) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }

  // 2. Load and normalize admin usernames from environment variables
  const adminString = process.env.ADMIN_USERNAMES || 'abdulazizafi,abdulazizalowaifi';
  const allowedUsernames = adminString
    .toLowerCase()
    .split(',')
    .map((username) => username.trim());

  const currentUser = req.user.username.toLowerCase().trim();

  // 3. Verify membership
  if (!allowedUsernames.includes(currentUser)) {
    return next(new AppError('Permission denied. Admin privileges required.', 403));
  }

  next();
};
