/**
 * Verification Code Utilities
 * 
 * Generates and validates 6-digit numeric verification codes
 * for parent email verification.
 */

import crypto from 'crypto';

const CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generates a 6-digit numeric verification code
 */
export function generateVerificationCode(): string {
  // Generate random number between 100000 and 999999
  const min = 100000;
  const max = 999999;
  const code = crypto.randomInt(min, max + 1);
  return code.toString();
}

/**
 * Calculates expiration time for verification code
 */
export function getCodeExpiryTime(): Date {
  return new Date(Date.now() + CODE_EXPIRY_MS);
}

/**
 * Checks if a verification code is expired
 */
export function isCodeExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}

/**
 * Gets the code expiry duration in milliseconds
 */
export function getCodeExpiryDuration(): number {
  return CODE_EXPIRY_MS;
}

/**
 * Gets the maximum number of verification attempts
 */
export function getMaxVerificationAttempts(): number {
  return MAX_ATTEMPTS;
}
