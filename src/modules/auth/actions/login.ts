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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

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
    const passwordValid = await verifyPassword(validated.password, user.passwordHash);

    if (!passwordValid) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Check if registration is complete
    if (user.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Registration incomplete. Please complete your registration.',
      };
    }

    // Check if parent email is verified
    if (user.parentEmail) {
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

    // Check if consent is granted
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

    // Create session
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;
    const userAgent = headersList.get('user-agent') || undefined;

    await createSession(user.id, ipAddress, userAgent);

    // Redirect handled by client component
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
