/**
 * Input Validation Utilities
 *
 * Provides validation helpers using Zod for type-safe input validation.
 * All user inputs should be validated before processing.
 *
 * Security Best Practices:
 * - Validate all inputs server-side
 * - Sanitize inputs to prevent XSS
 * - Use strict schemas for all user data
 * - Never trust client-side validation alone
 */

import { z } from 'zod';

/**
 * Validates email format
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * Validates password strength
 * Requirements: minimum 8 characters, at least one uppercase, one lowercase, one number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Validates UUID format
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Validates date of birth (ensures user is a minor if needed)
 */
export const dateOfBirthSchema = z.date().refine(
  (date) => {
    const age = new Date().getFullYear() - date.getFullYear();
    return age >= 0 && age <= 18; // Adjust based on requirements
  },
  { message: 'Invalid date of birth' }
);

/**
 * Sanitizes plain text input to prevent XSS.
 * Strips all HTML tags. Use for titles, names, and other plain-text fields.
 *
 * @param input Raw string input
 * @returns Sanitized string (trimmed, no HTML)
 */
export function sanitizeInput(input: string): string {
  const trimmed = input.trim();
  return trimmed.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitizes HTML content to prevent XSS while preserving safe formatting.
 * Use for rich text (e.g. material content, discussion content from TipTap).
 * Links are stripped by default for safety (anchor tags are forbidden).
 *
 * @param input Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(input: string): string {
  const trimmed = input.trim();
  const withBreaks = trimmed
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n');
  const stripped = withBreaks.replace(/<[^>]*>/g, '');
  const normalized = stripped.replace(/\n{3,}/g, '\n\n').trim();
  return normalized.replace(/\n/g, '<br>');
}
