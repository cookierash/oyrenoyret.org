/**
 * Design tokens – semantic categories for UI components
 *
 * Use these constants for consistent styling across the app.
 */

/** Button variant usage */
export const BUTTON_VARIANT_USAGE = {
  primary: 'Main CTAs: submit, sign up, continue, primary actions',
  secondary: 'Secondary actions: view more, less prominent options',
  outline: 'Tertiary/cancel/back: previous, alternative choices',
  ghost: 'Minimal/inline: inside cards, subtle, no border',
  destructive: 'Dangerous actions: delete, remove',
  success: 'Success/completion: confirm, done, finish',
  link: 'Text-only links: resend, inline navigation',
} as const;

/** Badge variant usage */
export const BADGE_VARIANT_USAGE = {
  default: 'Primary accent: featured tags, highlights',
  secondary: 'Neutral/info: role labels, status',
  success: 'Success/positive: completed, verified',
  outline: 'Subtle/neutral: optional labels',
} as const;
