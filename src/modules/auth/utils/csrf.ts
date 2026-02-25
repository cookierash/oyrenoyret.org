/**
 * CSRF Protection for Auth Module
 * 
 * Generates and validates CSRF tokens for authentication forms.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_COOKIE_MAX_AGE = 60 * 60; // 1 hour

/**
 * Generates a secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Sets CSRF token in httpOnly cookie
 */
export async function setCsrfToken(): Promise<string> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: '/',
  });

  return token;
}

/**
 * Gets CSRF token from cookie
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Validates CSRF token
 * @param providedToken Token provided in form
 * @returns True if token is valid
 */
export async function validateCsrfToken(providedToken: string): Promise<boolean> {
  const cookieToken = await getCsrfToken();
  
  if (!cookieToken || !providedToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(providedToken)
  );
}
