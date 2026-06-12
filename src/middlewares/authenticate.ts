/**
 * src/middlewares/authenticate.ts
 * ─────────────────────────────────────────────────────────────────
 * JWT authentication middleware.
 *
 * Reads the JWT from the `wcp_token` HttpOnly cookie, verifies its
 * signature using JWT_SECRET, then attaches the decoded user payload
 * to `req.user` for downstream handlers.
 *
 * If the token is missing, expired, or tampered with, a 401 error
 * is thrown — never a 403, to avoid leaking route existence.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

/** Shape of the JWT payload we sign and verify */
interface JwtPayload {
  id: string;
  username: string;
}

/**
 * Protects routes by requiring a valid JWT in the `wcp_token` cookie.
 * Attach this middleware to any route that requires authentication.
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // 1. Extract the token from the HttpOnly cookie
  const token: string | undefined = req.cookies?.wcp_token;

  if (!token) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }

  try {
    // 2. Verify signature and expiry
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // 3. Attach the user identity to the request object
    req.user = {
      id: decoded.id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    // Distinguish between expired and invalid tokens for clearer logging
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid session token. Please log in again.', 401));
  }
};
