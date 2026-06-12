/**
 * src/config/env.ts
 * ─────────────────────────────────────────────────────────────────
 * Type-safe environment variable loader using Zod.
 * Throws at startup if any required variable is missing or invalid,
 * preventing silent runtime failures in production.
 * ─────────────────────────────────────────────────────────────────
 */
import { z } from 'zod';

// Define the schema for all required environment variables
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10)),

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters long'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  WC_API_BASE_URL: z
    .string()
    .url('WC_API_BASE_URL must be a valid URL')
    .default('https://worldcup26.ir/api'),

  SYNC_INTERVAL_LIVE: z
    .string()
    .default('120000')
    .transform((val) => parseInt(val, 10)),

  SYNC_INTERVAL_IDLE: z
    .string()
    .default('600000')
    .transform((val) => parseInt(val, 10)),
});

// Parse and validate — throws a descriptive error if validation fails
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Export the validated, typed config object
export const env = parsed.data;
export type Env = typeof env;
