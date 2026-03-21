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
  GENERAL: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
} as const;

/** Content length limits for user-generated content (chars) */
export const CONTENT_LIMITS = {
  MATERIAL_TITLE_MAX: 200,
  MATERIAL_CONTENT_MAX: 50_000,
  DISCUSSION_TITLE_MAX: 300,
  DISCUSSION_CONTENT_MAX: 2_000,
  REPLY_CONTENT_MAX: 2_000,
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
