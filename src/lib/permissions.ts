/**
 * Permission Utilities
 * 
 * Provides role-based access control (RBAC) helpers.
 * All permission checks should go through this module for consistency.
 */

import { USER_ROLES } from '../config/constants';

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Checks if a user has a specific role
 * @param userRole The user's role
 * @param requiredRole The required role
 * @returns True if user has the required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return userRole === requiredRole;
}

/**
 * Checks if a user has admin privileges
 * @param userRole The user's role
 * @returns True if user is an admin
 */
export function isAdmin(userRole: UserRole): boolean {
  return userRole === USER_ROLES.ADMIN;
}

/**
 * Checks if a user is a student
 * @param userRole The user's role
 * @returns True if user is a student
 */
export function isStudent(userRole: UserRole): boolean {
  return userRole === USER_ROLES.STUDENT;
}

/**
 * Checks if a user is a parent
 * @param userRole The user's role
 * @returns True if user is a parent
 */
export function isParent(userRole: UserRole): boolean {
  return userRole === USER_ROLES.PARENT;
}
