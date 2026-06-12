/**
 * src/types/express.d.ts
 * ─────────────────────────────────────────────────────────────────
 * Augments the Express Request interface to include the authenticated
 * user payload decoded from the JWT cookie. This gives us full
 * TypeScript type-safety inside all authenticated route handlers.
 * ─────────────────────────────────────────────────────────────────
 */
declare namespace Express {
  interface Request {
    /**
     * Populated by the `authenticate` middleware after successful
     * JWT verification. Contains the minimal user identity needed
     * for authorization checks across all route handlers.
     */
    user?: {
      id: string;
      username: string;
    };
  }
}
