/**
 * src/errors/AppError.ts
 * ─────────────────────────────────────────────────────────────────
 * Custom application error class that extends the native Error.
 *
 * The `isOperational` flag distinguishes between:
 *   - Operational errors (true):  predictable, user-facing errors
 *     like "username taken" or "predictions closed". Safe to send
 *     the message to the client.
 *   - Programming errors (false): unexpected bugs or third-party
 *     failures. The global error handler will hide these behind a
 *     generic "Internal Server Error" message.
 * ─────────────────────────────────────────────────────────────────
 */
export class AppError extends Error {
  /** HTTP status code to send in the response */
  public readonly statusCode: number;

  /** Message safe to expose to clients when true */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
  ) {
    super(message);

    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Capture stack trace, excluding the constructor call itself
    Error.captureStackTrace(this, this.constructor);
  }
}
