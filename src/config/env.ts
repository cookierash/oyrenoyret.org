/**
 * Environment Configuration
 * 
 * Validates and exports environment variables.
 * All environment variables should be accessed through this module.
 * 
 * Security: Never expose sensitive values to the client.
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),
  /** Required in production for cron endpoints. When set, must be at least 16 characters. */
  CRON_SECRET: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 16, 'CRON_SECRET must be at least 16 characters when set'),
  /** Optional secret for registration tokens (falls back to NEXTAUTH_SECRET when unset). */
  REGISTRATION_TOKEN_SECRET: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 32, 'REGISTRATION_TOKEN_SECRET must be at least 32 characters when set'),
  /** Upstash Redis REST endpoint for distributed rate limiting (recommended in production). */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  /** Upstash Redis REST token for distributed rate limiting (recommended in production). */
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  /** Optional admin bootstrap credentials */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
}).refine(
  (env) => {
    const hasUrl = Boolean(env.UPSTASH_REDIS_REST_URL);
    const hasToken = Boolean(env.UPSTASH_REDIS_REST_TOKEN);
    return (hasUrl && hasToken) || (!hasUrl && !hasToken);
  },
  {
    message: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together',
    path: ['UPSTASH_REDIS_REST_URL'],
  }
);

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid environment variables: ${issues}`);
    }
    throw error;
  }
}

export const env = getEnv();
