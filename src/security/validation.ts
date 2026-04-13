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
import DOMPurify from 'isomorphic-dompurify';
import { PRACTICE_TEST_LIMITS } from '@/src/config/practice-test';
import { maybeDecodeEscapedHtml } from '@/src/lib/html';

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
  // Strip real HTML tags only (avoid eating plain text like "Use <, >, =").
  return trimmed.replace(/<\/?[a-z][^>]*>/gi, '').trim();
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
  const stripped = withBreaks.replace(/<\/?[a-z][^>]*>/gi, '');
  const normalized = stripped.replace(/\n{3,}/g, '\n\n').trim();
  return normalized.replace(/\n/g, '<br>');
}

let richTextHooksInstalled = false;

function installRichTextHooksOnce() {
  if (richTextHooksInstalled) return;
  richTextHooksInstalled = true;

  // Restrict inline styles to a tiny allow-list to preserve editor color/highlight
  // while preventing layout-breaking or unsafe CSS from being persisted.
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'style' || typeof data.attrValue !== 'string') return;

    const raw = data.attrValue;
    const kept: string[] = [];
    for (const part of raw.split(';')) {
      const [propRaw, valueRaw] = part.split(':');
      if (!propRaw || !valueRaw) continue;
      const prop = propRaw.trim().toLowerCase();
      const value = valueRaw.trim();

      const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
      const isRgb = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value);
      const isHsl =
        /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(
          value,
        );
      if (!isHex && !isRgb && !isHsl) continue;

      if (prop === 'color' || prop === 'background-color') {
        kept.push(`${prop}: ${value}`);
      }
    }

    data.attrValue = kept.join('; ');
    if (!data.attrValue) {
      data.keepAttr = false;
    }
  });
}

/**
 * Sanitizes rich HTML content (TipTap) while preserving safe formatting.
 * Intended for materials and practice tests.
 */
export function sanitizeRichTextHtml(input: string): string {
  installRichTextHooksOnce();
  const dirty = maybeDecodeEscapedHtml(String(input ?? '').trim());
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    KEEP_CONTENT: true,
    FORBID_TAGS: ['a', 'img', 'svg', 'math', 'iframe', 'script', 'style'],
    ALLOWED_TAGS: [
      'p',
      'br',
      'div',
      'span',
      'strong',
      'em',
      'u',
      's',
      'code',
      'pre',
      'blockquote',
      'hr',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'sup',
      'sub',
      'mark',
    ],
    ALLOWED_ATTR: ['style', 'start'],
  });
}

/**
 * Sanitizes discussion rich HTML content while allowing uploaded images.
 */
export function sanitizeDiscussionRichTextHtml(input: string): string {
  installRichTextHooksOnce();
  const dirty = maybeDecodeEscapedHtml(String(input ?? '').trim());
  if (!dirty) return '';

  const discussionsPrefixBase = String(process.env.R2_DISCUSSIONS_PREFIX ?? 'discussions').replace(
    /^\/+|\/+$/g,
    '',
  );

  const sanitized = DOMPurify.sanitize(dirty, {
    KEEP_CONTENT: true,
    FORBID_TAGS: ['a', 'svg', 'math', 'iframe', 'script', 'style'],
    ALLOWED_TAGS: [
      'p',
      'br',
      'div',
      'span',
      'strong',
      'em',
      'u',
      's',
      'code',
      'pre',
      'blockquote',
      'hr',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'sup',
      'sub',
      'mark',
      'img',
    ],
    ALLOWED_ATTR: [
      'style',
      'start',
      'src',
      'alt',
      'title',
      'width',
      'height',
      'loading',
      'decoding',
    ],
  });

  const isAllowedDiscussionImageSrc = (src: string) => {
    if (!src || src.includes('..')) return false;

    // Preferred: proxy through the app (works in localhost + locked-down buckets).
    if (src.startsWith('/api/uploads/discussions/file?key=')) {
      try {
        const parsed = new URL(src, 'http://local.test');
        const key = parsed.searchParams.get('key') ?? '';
        const decoded = decodeURIComponent(key);
        return decoded.startsWith(`${discussionsPrefixBase}/`) && !decoded.includes('..');
      } catch {
        return false;
      }
    }

    // Direct CDN/R2 URL: allow if the path looks like a discussions object key.
    if (src.startsWith('https://')) {
      try {
        const url = new URL(src);
        const key = url.pathname.replace(/^\/+/, '');
        return key.startsWith(`${discussionsPrefixBase}/`) && !key.includes('..');
      } catch {
        return false;
      }
    }

    return false;
  };

  // Remove any <img> that doesn't have an allowed src.
  return String(sanitized).replace(/<img\b[^>]*>/gi, (tag) => {
    const match = tag.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
    return isAllowedDiscussionImageSrc(src) ? tag : '';
  });
}

export function sanitizePracticeTestContent(content: string): string {
  const parsed = JSON.parse(String(content ?? ''));
  const rawQuestions = Array.isArray((parsed as any)?.questions) ? (parsed as any).questions : [];
  if (rawQuestions.length > PRACTICE_TEST_LIMITS.QUESTIONS_MAX) {
    throw new Error('Too many practice test questions');
  }

  const questions = rawQuestions.slice(0, PRACTICE_TEST_LIMITS.QUESTIONS_MAX).map((q: any, idx: number) => {
    const id = typeof q?.id === 'string' ? q.id : `q-${idx}`;
    const type = q?.type === 'short_answer' ? 'short_answer' : 'multiple_choice';
    const question = sanitizeRichTextHtml(String(q?.question ?? ''));
    const rawOptions = Array.isArray(q?.options) ? q.options : [];
    const options: { id: string; text: string }[] = rawOptions
      .slice(0, PRACTICE_TEST_LIMITS.OPTIONS_MAX)
      .map((opt: any, optIdx: number) => ({
      id: typeof opt?.id === 'string' ? opt.id : `${id}-opt-${optIdx}`,
      text: sanitizeRichTextHtml(String(opt?.text ?? '')),
    }));

    // Keep server-side content compatible with the editor constraints:
    // multiple choice questions must have 3-5 options (variants).
    if (type === 'multiple_choice') {
      while (options.length < PRACTICE_TEST_LIMITS.OPTIONS_MIN) {
        options.push({ id: `${id}-opt-${options.length}`, text: '' });
      }
    }

    let correctOptionId = typeof q?.correctOptionId === 'string' ? q.correctOptionId : undefined;
    if (type === 'multiple_choice' && (!correctOptionId || !options.some((o) => o.id === correctOptionId))) {
      correctOptionId = options[0]?.id;
    }

    return { id, type, question, options, correctOptionId };
  });

  return JSON.stringify({ questions });
}
