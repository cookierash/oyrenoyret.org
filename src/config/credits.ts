/**
 * Credit System Constants & Formula Parameters
 *
 * See docs/credits-specification.md for full specification and engagement design.
 */

/** Default credits granted on registration */
export const DEFAULT_CREDITS = 15;

/** Session duration options (minutes) */
export const SESSION_DURATIONS = [30, 45, 60] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];

/** Participant count bounds for group sessions */
export const SESSION_PARTICIPANT_MIN = 3;
export const SESSION_PARTICIPANT_MAX = 6;

/** Sprint duration options (minutes) */
export const SPRINT_DURATIONS = [10, 12, 15] as const;
export type SprintDuration = (typeof SPRINT_DURATIONS)[number];

/** Sprint pool size */
export const SPRINT_POOL_SIZE = 20;
export const SPRINT_TOP_COUNT = 5;

// ─── Group Sessions ─────────────────────────────────────────────────────────

export const CREDITS_GROUP_SESSION = {
  /** Base cost per participant (before duration factor) */
  BASE_PARTICIPANT: 1.0,
  /** Base gain for facilitator (target range 2–4) */
  BASE_FACILITATOR: 1.2,
  /** Full session bonus (6 participants) */
  BONUS_FULL_SESSION: 0.15,
  /** Duration factors for participant cost */
  DURATION_PARTICIPANT: { 30: 1.0, 45: 1.25, 60: 1.5 } as Record<SessionDuration, number>,
  /** Duration factors for facilitator gain */
  DURATION_FACILITATOR: { 30: 1.0, 45: 1.2, 60: 1.4 } as Record<SessionDuration, number>,
  /** Rating multiplier: 0.7 + avg_rating (avg in [0,1]) */
  RATING_MIN_MULTIPLIER: 0.7,
} as const;

// ─── Materials ──────────────────────────────────────────────────────────────

export const CREDITS_MATERIAL = {
  /** Base initial publish reward (textual document) */
  BASE_PUBLISH: 0.5,
  /** Base passive earning per consumer unlock */
  BASE_PASSIVE: 0.15,
  /** Base consumer unlock cost */
  BASE_UNLOCK: 2.0,
  /** Practice test: +0.05 per question for publish, cap 20 */
  PRACTICE_QUESTION_BONUS_PUBLISH: 0.05,
  PRACTICE_QUESTION_CAP_PUBLISH: 20,
  /** Practice test: +0.02 per question for passive, cap 15 */
  PRACTICE_QUESTION_BONUS_PASSIVE: 0.02,
  PRACTICE_QUESTION_CAP_PASSIVE: 15,
  /** Practice test: +0.03 per question for unlock, cap 25 */
  PRACTICE_QUESTION_BONUS_UNLOCK: 0.03,
  PRACTICE_QUESTION_CAP_UNLOCK: 25,
} as const;

// ─── Problem-Solving Sprints ────────────────────────────────────────────────

export const CREDITS_SPRINT = {
  /** Base entry cost */
  BASE_ENTRY: 5.0,
  /** Duration factors for entry cost */
  DURATION_FACTOR: { 10: 1.0, 12: 1.1, 15: 1.2 } as Record<SprintDuration, number>,
  /** Payout multipliers by rank. Only top 5 earn. */
  RANK_MULTIPLIERS: {
    1: [2.0, 2.0],
    2: [1.75, 1.75],
    3: [1.5, 1.5],
    4: [1.25, 1.25],
    5: [1.0, 1.0],
    // 6–20: 0
  } as Record<number, [number, number]>,
} as const;

// ─── Discussions ────────────────────────────────────────────────────────────

export const CREDITS_DISCUSSION = {
  /** Cost to create a discussion */
  BASE_CREATE: 1.0,
  /** Base reward for helpful reply */
  BASE_HELP: 0.5,
  /** Validation strength multipliers */
  VALIDATION_ACCEPTED: 1.5,
  VALIDATION_UPVOTES_2: 1.2,
  VALIDATION_UPVOTES_1: 1.0,
} as const;

// ─── Special Academic Events ────────────────────────────────────────────────

export const CREDITS_EVENT = {
  /** Base event cost (100–150 range) */
  BASE_EVENT: 100.0,
  /** Tier multipliers */
  TIER_STANDARD: 1.0,
  TIER_PREMIUM: 1.25,
  TIER_ELITE: 1.5,
} as const;
