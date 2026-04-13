/**
 * Application Constants
 * 
 * Centralized constants and configuration values.
 * Environment-specific values should use environment variables.
 */

export const APP_NAME = 'oyrenoyret.org';

export const USER_ROLES = {
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
} as const;

export const CONSENT_VERSION = '1.0.0';

export const RATE_LIMITS = {
  AUTH: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  AUTH_REGISTRATION: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  AUTH_VERIFICATION: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  AUTH_PASSWORD_RESET: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  AUTH_EMAIL_VERIFICATION: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  GENERAL: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  WRITE: {
    maxRequests: 30,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  VOTE: {
    maxRequests: 120,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  UNLOCK: {
    maxRequests: 20,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  CONTACT_MESSAGE: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  ADMIN_WRITE: {
    maxRequests: 60,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
  LIVE_EVENT: {
    maxRequests: 20,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },
} as const;

function parseIntWithClamp(
  raw: string | undefined,
  fallback: number,
  opts?: { min?: number; max?: number }
): number {
  const parsed = raw ? Number.parseInt(String(raw), 10) : NaN;
  const value = Number.isFinite(parsed) ? parsed : fallback;
  const min = typeof opts?.min === 'number' ? opts.min : undefined;
  const max = typeof opts?.max === 'number' ? opts.max : undefined;
  const clampedMin = typeof min === 'number' ? Math.max(value, min) : value;
  return typeof max === 'number' ? Math.min(clampedMin, max) : clampedMin;
}

/** Content length limits for user-generated content (chars) */
export const CONTENT_LIMITS = {
  MATERIAL_TITLE_MAX: 200,
  MATERIAL_CONTENT_MAX: 50_000,
  // Override via env vars (values are read at build-time in the browser bundle):
  // - NEXT_PUBLIC_DISCUSSION_TITLE_MAX
  // - NEXT_PUBLIC_DISCUSSION_CONTENT_MAX
  // - NEXT_PUBLIC_REPLY_CONTENT_MAX
  // Server-only equivalents without the NEXT_PUBLIC_ prefix are also supported,
  // but the browser bundle will only see NEXT_PUBLIC_ values at runtime.
  DISCUSSION_TITLE_MAX: parseIntWithClamp(
    process.env.NEXT_PUBLIC_DISCUSSION_TITLE_MAX ?? process.env.DISCUSSION_TITLE_MAX,
    300,
    { min: 50, max: 2_000 }
  ),
  DISCUSSION_CONTENT_MAX: parseIntWithClamp(
    process.env.NEXT_PUBLIC_DISCUSSION_CONTENT_MAX ?? process.env.DISCUSSION_CONTENT_MAX,
    2_000,
    { min: 200, max: 50_000 }
  ),
  REPLY_CONTENT_MAX: parseIntWithClamp(
    process.env.NEXT_PUBLIC_REPLY_CONTENT_MAX ?? process.env.REPLY_CONTENT_MAX,
    2_000,
    { min: 200, max: 50_000 }
  ),
} as const;

/** Subject catalog for grades 5–11 */
export const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics', description: 'Algebra, geometry, and problem solving' },
  { id: 'physics', name: 'Physics', description: 'Motion, forces, energy, and the physical world' },
  { id: 'chemistry', name: 'Chemistry', description: 'Matter, reactions, and the periodic table' },
  { id: 'biology', name: 'Biology', description: 'Living organisms, cells, and ecosystems' },
  { id: 'azerbaijani-language', name: 'Azerbaijani Language', description: 'Grammar, composition, and communication' },
  { id: 'azerbaijani-literature', name: 'Azerbaijani Literature', description: 'Classic and modern literary works' },
  { id: 'english', name: 'English', description: 'Reading, writing, and language skills' },
  { id: 'russian', name: 'Russian', description: 'Reading, writing, and conversation' },
  { id: 'history', name: 'History', description: 'World and regional history' },
  { id: 'geography', name: 'Geography', description: 'Physical and human geography' },
  { id: 'information-technology', name: 'Information Technology', description: 'Computers, programming, and digital skills' },
  { id: 'civics', name: 'Civics', description: 'Government, rights, and citizenship' },
] as const;
