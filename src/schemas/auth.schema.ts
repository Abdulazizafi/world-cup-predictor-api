/**
 * src/schemas/auth.schema.ts
 * ─────────────────────────────────────────────────────────────────
 * Zod validation schemas for Auth endpoints.
 * Enforces strict rules on username and password format before
 * any business logic or database queries are executed.
 * ─────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';

/**
 * Schema for POST /api/auth/register
 *
 * Username rules:
 *   - 3 to 20 characters
 *   - Alphanumeric and underscores only (no spaces, no special chars)
 *   - Case-insensitive uniqueness is handled at the service layer
 *
 * Password rules:
 *   - Minimum 6 characters (bcrypt handles the rest)
 *   - Max 72 chars (bcrypt silently truncates beyond that)
 */
export const RegisterSchema = z.object({
  username: z
    .string({ required_error: 'Username is required.' })
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username must be at most 20 characters.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username may only contain letters, numbers, and underscores.',
    ),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(72, 'Password must be at most 72 characters.'),
});

/**
 * Schema for POST /api/auth/login
 * Same fields as register — reused for clarity and DRY principle.
 */
export const LoginSchema = z.object({
  username: z
    .string({ required_error: 'Username is required.' })
    .trim()
    .min(1, 'Username cannot be empty.'),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password cannot be empty.'),
});

// Inferred TypeScript types from the schemas
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
