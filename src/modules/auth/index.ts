/**
 * Auth Module
 * 
 * Central export point for authentication module.
 * Provides access to all auth-related components, actions, and utilities.
 */

// Components
export { RegistrationWizard } from './components/registration-wizard';
export { LoginForm } from './components/login-form';

// Actions
export { registerStudentInfo, registerParentInfo, sendParentVerificationCode, verifyParentEmail, grantParentalConsent } from './actions/registration';
export { login, logout } from './actions/login';
// Schemas
export * from './schemas/registration';

// Utilities
export { hashPassword, verifyPassword, validatePasswordStrength } from './utils/password';
export { createSession, validateSession, getCurrentSession, deleteSession, deleteAllUserSessions } from './utils/session';
export { generateVerificationCode, getCodeExpiryTime, isCodeExpired, getCodeExpiryDuration, getMaxVerificationAttempts } from './utils/verification';
export { generateCsrfToken, setCsrfToken, getCsrfToken, validateCsrfToken } from './utils/csrf';

// Services
export { sendVerificationCode } from './services/email';
