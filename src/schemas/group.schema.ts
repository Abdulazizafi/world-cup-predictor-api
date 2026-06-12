/**
 * src/schemas/group.schema.ts
 * ─────────────────────────────────────────────────────────────────
 * Zod validation schemas for Group management endpoints.
 * ─────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';

/**
 * Schema for POST /api/groups/create
 * Group name is the only required input — invite code is auto-generated.
 */
export const CreateGroupSchema = z.object({
  name: z
    .string({ required_error: 'Group name is required.' })
    .trim()
    .min(3, 'Group name must be at least 3 characters.')
    .max(50, 'Group name must be at most 50 characters.'),
});

/**
 * Schema for POST /api/groups/join
 * Invite codes are always 6 uppercase alphanumeric characters.
 */
export const JoinGroupSchema = z.object({
  inviteCode: z
    .string({ required_error: 'Invite code is required.' })
    .trim()
    .toUpperCase()
    .length(6, 'Invite code must be exactly 6 characters.')
    .regex(
      /^[A-Z0-9]{6}$/,
      'Invite code must be 6 uppercase alphanumeric characters.',
    ),
});

// Inferred TypeScript types
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type JoinGroupInput = z.infer<typeof JoinGroupSchema>;
