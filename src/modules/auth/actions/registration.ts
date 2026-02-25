/**
 * Registration Server Actions
 * 
 * Server-side actions for handling multi-step registration.
 * All actions validate input, check permissions, and update database.
 */

'use server';

import { prisma } from '@/src/db/client';
import { hashPassword } from '../utils/password';
import {
  studentInfoSchema,
  parentInfoSchema,
  verificationCodeSchema,
  consentSchema,
  type StudentInfoInput,
  type ParentInfoInput,
  type VerificationCodeInput,
  type ConsentInput,
} from '../schemas/registration';
import {
  generateVerificationCode,
  getCodeExpiryTime,
  isCodeExpired,
  getMaxVerificationAttempts,
} from '../utils/verification';
import { sendVerificationCode } from '../services/email';
import { createSession } from '../utils/session';
import { ensureDefaultCredits } from '@/src/modules/credits';
import { CONSENT_VERSION } from '@/src/config/constants';
import { headers } from 'next/headers';

/**
 * Step 1: Create student account with basic information
 */
export async function registerStudentInfo(data: StudentInfoInput) {
  try {
    // Validate input
    const validated = studentInfoSchema.parse(data);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists',
      };
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password);

    // Create user with INACTIVE status (will be activated after registration completes)
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        passwordHash,
        firstName: validated.firstName,
        lastName: validated.lastName,
        grade: validated.grade,
        role: 'STUDENT',
        status: 'INACTIVE',
        registrationStep: 2, // Move to step 2
      },
    });

    return {
      success: true,
      userId: user.id,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Step 2: Add parent/guardian information
 */
export async function registerParentInfo(userId: string, data: ParentInfoInput) {
  try {
    // Validate input
    const validated = parentInfoSchema.parse(data);

    // Get user to check student email
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Check if parent email is different from student email
    if (validated.parentEmail === user.email) {
      return {
        success: false,
        error: 'Parent email must be different from student email',
      };
    }

    // Update user with parent information
    await prisma.user.update({
      where: { id: userId },
      data: {
        parentEmail: validated.parentEmail,
        parentFirstName: validated.parentFirstName,
        parentLastName: validated.parentLastName,
        registrationStep: 3, // Move to step 3
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Step 3: Send verification code to parent email
 */
export async function sendParentVerificationCode(userId: string) {
  try {
    // Check rate limit (server-side)
    const { checkVerificationResendRateLimit } = await import('./rate-limit');
    const rateLimit = await checkVerificationResendRateLimit();

    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many verification requests. Please wait ${Math.ceil(
          (rateLimit.resetAt.getTime() - Date.now()) / 1000 / 60
        )} minutes.`,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.parentEmail) {
      return {
        success: false,
        error: 'Parent email not found',
      };
    }

    // Invalidate any existing unverified codes
    await prisma.guardianVerification.updateMany({
      where: {
        userId,
        verifiedAt: null,
        used: false,
      },
      data: {
        used: true, // Mark as used to invalidate
      },
    });

    // Generate new verification code
    const code = generateVerificationCode();
    const expiresAt = getCodeExpiryTime();

    // Store verification code
    await prisma.guardianVerification.create({
      data: {
        userId,
        parentEmail: user.parentEmail,
        code,
        expiresAt,
      },
    });

    // Send email
    await sendVerificationCode(user.parentEmail, code);

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Failed to send verification code',
    };
  }
}

/**
 * Step 3: Verify parent email with code
 */
export async function verifyParentEmail(userId: string, data: VerificationCodeInput) {
  try {
    // Validate input
    const validated = verificationCodeSchema.parse(data);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.parentEmail) {
      return {
        success: false,
        error: 'User or parent email not found',
      };
    }

    // Find verification code
    const verification = await prisma.guardianVerification.findFirst({
      where: {
        userId,
        parentEmail: user.parentEmail,
        code: validated.code,
        used: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verification) {
      // Increment attempts on any existing verification
      await prisma.guardianVerification.updateMany({
        where: {
          userId,
          parentEmail: user.parentEmail,
          used: false,
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      return {
        success: false,
        error: 'Invalid verification code',
      };
    }

    // Check if code is expired
    if (isCodeExpired(verification.expiresAt)) {
      return {
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      };
    }

    // Check attempts
    if (verification.attempts >= getMaxVerificationAttempts()) {
      return {
        success: false,
        error: 'Too many verification attempts. Please request a new code.',
      };
    }

    // Mark verification as used and verified
    await prisma.guardianVerification.update({
      where: { id: verification.id },
      data: {
        used: true,
        verifiedAt: new Date(),
      },
    });

    // Update user registration step
    await prisma.user.update({
      where: { id: userId },
      data: {
        registrationStep: 4, // Move to step 4
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Verification failed',
    };
  }
}

/**
 * Step 4: Grant parental consent
 */
export async function grantParentalConsent(userId: string, data: ConsentInput) {
  try {
    // Validate input
    const validated = consentSchema.parse(data);

    if (!validated.consentGranted) {
      return {
        success: false,
        error: 'Consent must be granted to proceed',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.parentEmail) {
      return {
        success: false,
        error: 'User or parent email not found',
      };
    }

    // Check if parent email is verified
    const verified = await prisma.guardianVerification.findFirst({
      where: {
        userId,
        parentEmail: user.parentEmail,
        verifiedAt: { not: null },
        used: true,
      },
    });

    if (!verified) {
      return {
        success: false,
        error: 'Parent email must be verified before granting consent',
      };
    }

    // Create consent record
    await prisma.parentalConsent.create({
      data: {
        userId,
        parentEmail: user.parentEmail,
        status: 'GRANTED',
        consentVersion: CONSENT_VERSION,
        grantedAt: new Date(),
      },
    });

    // Activate user account and complete registration
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        registrationStep: 5, // Registration complete
      },
    });

    // Ensure default credits (15) for new users
    await ensureDefaultCredits(userId);

    // Create session and redirect
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;
    const userAgent = headersList.get('user-agent') || undefined;

    await createSession(userId, ipAddress, userAgent);

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Failed to grant consent',
    };
  }
}
