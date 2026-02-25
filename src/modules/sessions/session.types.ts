/**
 * Session Types
 * 
 * TypeScript type definitions for the sessions domain module.
 */

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export interface Session {
  id: string;
  userId: string;
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
