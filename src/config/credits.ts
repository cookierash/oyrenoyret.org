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
export const SPRINT_TOP_COUNT = 3;

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
  /** Base credit value for textual materials (used for unlock cost + publish reward) */
  TEXTUAL_BASE_VALUE: 1,
  /** Minimum textual content (words) */
  TEXTUAL_MIN_WORDS: 500,
  /** Words per +1 credit */
  TEXTUAL_STEP_WORDS: 1000,
  /** Minimum practice test questions */
  PRACTICE_MIN_QUESTIONS: 5,
  /** Base credit value for practice tests */
  PRACTICE_BASE_VALUE: 1,
  /** Questions per +1 credit */
  PRACTICE_STEP_QUESTIONS: 10,
  /** Passive reward amount (integer credits) */
  PASSIVE_REWARD: 1,
  /** Passive reward granted every N purchases */
  PASSIVE_EVERY_N_PURCHASES: 10,
} as const;

// ─── Problem-Solving Sprints ────────────────────────────────────────────────

export const CREDITS_SPRINT = {
  /** Base entry cost */
  BASE_ENTRY: 3,
  /** Duration factors (kept at 1 to preserve integer entry cost) */
  DURATION_FACTOR: { 10: 1, 12: 1, 15: 1 } as Record<SprintDuration, number>,
  /** Payout bonus over entry cost (credits). Only top 3 earn. */
  RANK_BONUS: {
    1: 3,
    2: 2,
    3: 1,
    // 4+ : 0
  } as Record<number, number>,
} as const;

// ─── Discussions ────────────────────────────────────────────────────────────

export const CREDITS_DISCUSSION = {
  /** Cost to create a discussion */
  BASE_CREATE: 1,
  /** Reward for posting a reply */
  BASE_REPLY: 1,
  /** Base reward for helpful reply */
  BASE_HELP: 1,
  /** Validation strength multipliers */
  VALIDATION_ACCEPTED: 3,
  VALIDATION_UPVOTES_2: 2,
  VALIDATION_UPVOTES_1: 1,
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
