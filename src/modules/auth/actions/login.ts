/**
 * Login Server Actions
 * 
 * Server-side actions for user authentication.
 */

'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/src/db/client';
import { verifyPassword } from '../utils/password';
import { loginSchema, type LoginInput } from '../schemas/registration';
import { createSession } from '../utils/session';
import { headers } from 'next/headers';

/**
 * Authenticates a user and creates a session
 */
export async function login(data: LoginInput) {
  try {
    // Rate limit: prevent brute-force attacks
    const { checkLoginRateLimit } = await import('./rate-limit');
    const rateLimit = await checkLoginRateLimit();
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many login attempts. Please try again in ${Math.ceil(
          (rateLimit.resetAt.getTime() - Date.now()) / 1000 / 60
        )} minutes.`,
      };
    }

    // Validate input
    const validated = loginSchema.parse(data);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
    const isAdminLoginAttempt =
      Boolean(adminEmail) && validated.email.toLowerCase() === adminEmail;

    let user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    let isAdminCredentials = false;

    if (isAdminLoginAttempt && adminEmail) {
      if (!adminPasswordHash) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      let adminPasswordValid = false;
      try {
        adminPasswordValid = await verifyPassword(validated.password, adminPasswordHash);
      } catch {
        adminPasswordValid = false;
      }

      if (!adminPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      isAdminCredentials = true;

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            registrationStep: 5,
          },
        });
      } else if (user.role !== 'ADMIN') {
        return {
          success: false,
          error: 'Admin account misconfigured. Contact support.',
        };
      } else if (
        user.passwordHash !== adminPasswordHash ||
        user.status !== 'ACTIVE' ||
        user.registrationStep !== 5
      ) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: adminPasswordHash,
            status: 'ACTIVE',
            registrationStep: 5,
          },
        });
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Check if user has password (not OAuth-only)
    if (!user.passwordHash) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Verify password
    const passwordValid = isAdminCredentials
      ? true
      : await verifyPassword(validated.password, user.passwordHash);

    if (!passwordValid) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Check if registration is complete
    if (!isAdminCredentials && user.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Registration incomplete. Please complete your registration.',
      };
    }

    const requiresGuardianChecks = !isAdminCredentials && user.role === 'STUDENT';

    // Check if parent email is verified (students only)
    if (requiresGuardianChecks && user.parentEmail) {
      const verified = await prisma.guardianVerification.findFirst({
        where: {
          userId: user.id,
          parentEmail: user.parentEmail,
          verifiedAt: { not: null },
          used: true,
        },
      });

      if (!verified) {
        return {
          success: false,
          error: 'Parent email verification required. Please complete your registration.',
        };
      }
    }

    // Check if consent is granted (students only)
    if (requiresGuardianChecks) {
      const consent = await prisma.parentalConsent.findFirst({
        where: {
          userId: user.id,
          status: 'GRANTED',
        },
      });

      if (!consent) {
        return {
          success: false,
          error: 'Parental consent required. Please complete your registration.',
        };
      }
    }

    // Create session
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;
    const userAgent = headersList.get('user-agent') || undefined;

    await createSession(user.id, ipAddress, userAgent);

    // Redirect handled by client component
    return {
      success: true,
      userId: user.id,
      role: user.role,
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
      error: 'Login failed',
    };
  }
}

/**
 * Logs out the current user
 */
export async function logout() {
  const { deleteSession } = await import('../utils/session');
  const { cookies } = await import('next/headers');
  
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  
  if (token) {
    await deleteSession(token);
  }
  
  redirect('/');
}
