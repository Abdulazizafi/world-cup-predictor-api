/**
 * src/middlewares/errorHandler.ts
 * ─────────────────────────────────────────────────────────────────
 * Global error handler — the last middleware in the Express chain.
 *
 * Handles three categories of errors:
 *   1. AppError (operational): send statusCode + message to client.
 *   2. Zod validation errors: surfaced as 422 with field-level details.
 *   3. Unknown/programming errors: log internally, send generic 500.
 *
 * This centralises all error formatting so individual controllers
 * never need to call res.status().json() for error cases directly.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

/**
 * Express error-handling middleware (4 params required by Express convention).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ── 1. Operational AppError ──────────────────────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  // ── 2. Zod validation error ──────────────────────────────────
  if (err instanceof ZodError) {
    res.status(422).json({
      status: 'validation_error',
      message: 'Invalid input data.',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // ── 3. Unknown / programming error ───────────────────────────
  // Log the full error server-side, but never expose internals to client
  console.error('❌ Unhandled error:', err);

  res.status(500).json({
    status: 'error',
    message:
      env.NODE_ENV === 'development' && err instanceof Error
        ? err.message                  // Show detail in dev for debugging
        : 'An unexpected error occurred. Please try again.',
  });
};
