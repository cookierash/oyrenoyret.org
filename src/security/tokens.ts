/**
 * Secure Token Generation
 * 
 * Provides cryptographically secure token generation for various purposes:
 * - Session tokens
 * - Password reset tokens
 * - Email verification tokens
 * - API tokens
 * 
 * Security Requirements:
 * - Use cryptographically secure random number generators
 * - Tokens should be sufficiently long and random
 * - Tokens should be hashed before storage
 */

import { randomBytes } from 'crypto';

/**
 * Generates a secure random token
 * @param length Token length in bytes (default: 32)
 * @returns Hex-encoded token string
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generates a URL-safe token
 * @param length Token length in bytes (default: 32)
 * @returns Base64 URL-safe encoded token
 */
export function generateUrlSafeToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Hashes a token using SHA-256 (for storage)
 * @param token Plain token
 * @returns Hashed token
 */
export async function hashToken(token: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(token).digest('hex');
}
