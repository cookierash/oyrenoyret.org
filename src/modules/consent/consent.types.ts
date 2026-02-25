/**
 * Consent Types
 * 
 * TypeScript type definitions for parental consent management.
 */

export type ConsentStatus = 'PENDING' | 'GRANTED' | 'REVOKED' | 'EXPIRED';

export interface ParentalConsent {
  id: string;
  userId: string;
  parentEmail: string;
  status: ConsentStatus;
  consentVersion: string;
  grantedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
