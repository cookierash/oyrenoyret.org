/**
 * Registration Validation Schemas
 * 
 * Zod schemas for validating registration form data at each step.
 * All schemas include client and server-side validation.
 */

import { z } from 'zod';

/**
 * Step 1: Student Information
 */
export const studentInfoSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  grade: z.enum(['5', '6', '7', '8', '9', '10', '11'], {
    message: 'Please select a grade',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type StudentInfoInput = z.infer<typeof studentInfoSchema>;

/**
 * Step 2: Parent/Guardian Information
 */
export const parentInfoSchema = z.object({
  parentFirstName: z
    .string()
    .min(1, 'Parent/guardian first name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim(),
  parentLastName: z
    .string()
    .min(1, 'Parent/guardian last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),
  parentEmail: z
    .string()
    .min(1, 'Parent/guardian email is required')
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
});

export type ParentInfoInput = z.infer<typeof parentInfoSchema>;

/**
 * Step 3: Parent Email Verification
 */
export const verificationCodeSchema = z.object({
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Verification code must contain only numbers'),
});

export type VerificationCodeInput = z.infer<typeof verificationCodeSchema>;

/**
 * Step 4: Parental Consent
 */
export const consentSchema = z.object({
  consentGranted: z.boolean().refine((val) => val === true, {
    message: 'You must grant consent to proceed',
  }),
});

export type ConsentInput = z.infer<typeof consentSchema>;

/**
 * Login Schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
