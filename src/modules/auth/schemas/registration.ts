/**
 * Registration Validation Schemas
 * 
 * Zod schemas for validating registration form data at each step.
 * All schemas include client and server-side validation.
 */

import { z } from 'zod';

export interface AuthValidationMessages {
  firstNameRequired: string;
  firstNameMax: string;
  lastNameRequired: string;
  lastNameMax: string;
  emailRequired: string;
  emailInvalid: string;
  emailMax: string;
  passwordMin: string;
  passwordMax: string;
  passwordUpper: string;
  passwordLower: string;
  passwordNumber: string;
  passwordSpecial: string;
  confirmPasswordRequired: string;
  gradeRequired: string;
  passwordsMismatch: string;
  parentFirstNameRequired: string;
  parentLastNameRequired: string;
  parentEmailRequired: string;
  verificationLength: string;
  verificationDigits: string;
  consentRequired: string;
  loginPasswordRequired: string;
}

export const DEFAULT_VALIDATION_MESSAGES: AuthValidationMessages = {
  firstNameRequired: 'First name is required',
  firstNameMax: 'First name must be less than 50 characters',
  lastNameRequired: 'Last name is required',
  lastNameMax: 'Last name must be less than 50 characters',
  emailRequired: 'Email is required',
  emailInvalid: 'Invalid email address',
  emailMax: 'Email must be less than 254 characters',
  passwordMin: 'Password must be at least 8 characters',
  passwordMax: 'Password must be at most 72 characters',
  passwordUpper: 'Password must contain at least one uppercase letter',
  passwordLower: 'Password must contain at least one lowercase letter',
  passwordNumber: 'Password must contain at least one number',
  passwordSpecial: 'Password must contain at least one special character',
  confirmPasswordRequired: 'Please confirm your password',
  gradeRequired: 'Please select a grade',
  passwordsMismatch: 'Passwords do not match',
  parentFirstNameRequired: 'Parent/guardian first name is required',
  parentLastNameRequired: 'Parent/guardian last name is required',
  parentEmailRequired: 'Parent/guardian email is required',
  verificationLength: 'Verification code must be 6 digits',
  verificationDigits: 'Verification code must contain only numbers',
  consentRequired: 'You must grant consent to proceed',
  loginPasswordRequired: 'Password is required',
};

/**
 * Step 1: Student Information
 */
export const studentInfoSchema = createStudentInfoSchema(DEFAULT_VALIDATION_MESSAGES);

export function createStudentInfoSchema(messages: AuthValidationMessages) {
  return z
    .object({
      firstName: z
        .string()
        .min(1, messages.firstNameRequired)
        .max(50, messages.firstNameMax)
        .trim(),
      lastName: z
        .string()
        .min(1, messages.lastNameRequired)
        .max(50, messages.lastNameMax)
        .trim(),
      email: z
        .string()
        .min(1, messages.emailRequired)
        .email(messages.emailInvalid)
        .max(254, messages.emailMax)
        .toLowerCase()
        .trim(),
      password: z
        .string()
        .min(8, messages.passwordMin)
        .max(72, messages.passwordMax)
        .regex(/[A-Z]/, messages.passwordUpper)
        .regex(/[a-z]/, messages.passwordLower)
        .regex(/[0-9]/, messages.passwordNumber)
        .regex(/[^A-Za-z0-9]/, messages.passwordSpecial),
      confirmPassword: z
        .string()
        .min(1, messages.confirmPasswordRequired)
        .max(72, messages.passwordMax),
      grade: z.enum(['5', '6', '7', '8', '9', '10', '11', '12'], {
        message: messages.gradeRequired,
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordsMismatch,
      path: ['confirmPassword'],
    });
}

export type StudentInfoInput = z.infer<typeof studentInfoSchema>;

/**
 * Step 2: Parent/Guardian Information
 */
export const parentInfoSchema = createParentInfoSchema(DEFAULT_VALIDATION_MESSAGES);

export function createParentInfoSchema(messages: AuthValidationMessages) {
  return z.object({
    parentFirstName: z
      .string()
      .min(1, messages.parentFirstNameRequired)
      .max(50, messages.firstNameMax)
      .trim(),
    parentLastName: z
      .string()
      .min(1, messages.parentLastNameRequired)
      .max(50, messages.lastNameMax)
      .trim(),
    parentEmail: z
      .string()
      .min(1, messages.parentEmailRequired)
      .email(messages.emailInvalid)
      .max(254, messages.emailMax)
      .toLowerCase()
      .trim(),
  });
}

export type ParentInfoInput = z.infer<typeof parentInfoSchema>;

/**
 * Step 3: Parent Email Verification
 */
export const verificationCodeSchema = createVerificationCodeSchema(DEFAULT_VALIDATION_MESSAGES);

export function createVerificationCodeSchema(messages: AuthValidationMessages) {
  return z.object({
    code: z
      .string()
      .length(6, messages.verificationLength)
      .regex(/^\d+$/, messages.verificationDigits),
  });
}

export type VerificationCodeInput = z.infer<typeof verificationCodeSchema>;

/**
 * Step 4: Parental Consent
 */
export const consentSchema = createConsentSchema(DEFAULT_VALIDATION_MESSAGES);

export function createConsentSchema(messages: AuthValidationMessages) {
  return z.object({
    consentGranted: z.boolean().refine((val) => val === true, {
      message: messages.consentRequired,
    }),
  });
}

export type ConsentInput = z.infer<typeof consentSchema>;

/**
 * Login Schema
 */
export const loginSchema = createLoginSchema(DEFAULT_VALIDATION_MESSAGES);

export function createLoginSchema(messages: AuthValidationMessages) {
  return z.object({
    email: z
      .string()
      .min(1, messages.emailRequired)
      .email(messages.emailInvalid)
      .max(254, messages.emailMax)
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(1, messages.loginPasswordRequired)
      .max(72, messages.passwordMax),
  });
}

export type LoginInput = z.infer<typeof loginSchema>;
