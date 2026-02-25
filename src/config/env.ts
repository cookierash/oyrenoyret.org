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
});

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
