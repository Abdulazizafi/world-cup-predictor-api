/**
 * src/middlewares/validate.ts
 * ─────────────────────────────────────────────────────────────────
 * Generic Zod request validation middleware factory.
 *
 * Usage:
 *   router.post('/route', validate(MyZodSchema), controller.handler);
 *
 * Validates `req.body` against the provided Zod schema. If validation
 * fails, the ZodError is forwarded to the global error handler which
 * formats it as a 422 response with field-level error details.
 *
 * The middleware REPLACES req.body with the parsed (and potentially
 * transformed/stripped) output, ensuring downstream handlers always
 * receive clean, type-safe data.
 * ─────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Returns an Express middleware that validates req.body against
 * the given Zod schema.
 *
 * @param schema - A Zod schema object to validate against
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Parse and replace body with the cleaned/transformed Zod output
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Pass to global error handler for consistent formatting
        next(err);
      } else {
        next(err);
      }
    }
  };
