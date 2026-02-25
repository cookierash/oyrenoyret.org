/**
 * User Types
 * 
 * TypeScript type definitions for the users domain module.
 * All user-related types are centralized here for maintainability.
 */

export type UserRole = 'STUDENT' | 'PARENT' | 'ADMIN' | 'TEACHER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
