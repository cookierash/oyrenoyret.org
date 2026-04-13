/**
 * Login Server Actions
 * 
 * Server-side actions for user authentication.
 */

'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/src/db/client';
import type { UserRole, UserStatus } from '@prisma/client';
import { verifyPassword } from '../utils/password';
import { loginSchema, type LoginInput } from '../schemas/registration';
import { createSession } from '../utils/session';
import { headers } from 'next/headers';
import { recordDailyVisit } from '@/src/modules/visits';
import { getRandomAvatarVariant } from '@/src/lib/avatar';

/**
 * Authenticates a user and creates a session
 */
export async function login(data: LoginInput) {
  try {
    // Rate limit: prevent brute-force attacks
    const { checkLoginRateLimit } = await import('./rate-limit');
    const rateLimit = await checkLoginRateLimit();
    if (!rateLimit.allowed) {
      const minutes = Math.ceil(
        (rateLimit.resetAt.getTime() - Date.now()) / 1000 / 60
      );
      return {
        success: false,
        errorKey: 'loginRateLimit',
        errorVars: { minutes },
      };
    }

    // Validate input
    const validated = loginSchema.parse(data);

    const isDev = process.env.NODE_ENV === 'development';
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

    let user = null as null | {
      id: string;
      email: string;
      passwordHash: string | null;
      role: UserRole;
      status: UserStatus;
    };

    // Admin bootstrap (env-configured account).
    // Ensures an admin record exists and the configured password works even if DB seeding wasn't run.
    if (adminEmail && validated.email === adminEmail) {
      const existing = await prisma.user.findUnique({
        where: { email: validated.email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          status: true,
        },
      });

      if (!adminPasswordHash) {
        // If env is missing, fall back to DB admin account (if present) so dev/prod doesn't hard-fail.
        if (!existing || existing.role !== 'ADMIN' || !existing.passwordHash) {
          return {
            success: false,
            errorKey: 'adminMisconfigured',
          };
        }

        user =
          existing.status === 'ACTIVE'
            ? existing
            : await prisma.user.update({
                where: { id: existing.id },
                data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
                select: {
                  id: true,
                  email: true,
                  passwordHash: true,
                  role: true,
                  status: true,
                },
              });
      } else {
        // Validate against the configured admin password first.
        const adminPasswordValid = await verifyPassword(validated.password, adminPasswordHash);
        if (!adminPasswordValid) {
          // Dev fallback: allow DB-managed admin passwords if env hash is stale.
          if (isDev && existing && existing.role === 'ADMIN' && existing.passwordHash) {
            const dbPasswordValid = await verifyPassword(validated.password, existing.passwordHash);
            if (dbPasswordValid) {
              user =
                existing.status === 'ACTIVE'
                  ? existing
                  : await prisma.user.update({
                      where: { id: existing.id },
                      data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
                      select: {
                        id: true,
                        email: true,
                        passwordHash: true,
                        role: true,
                        status: true,
                      },
                    });
            } else {
              return {
                success: false,
                errorKey: 'invalidCredentials',
              };
            }
          } else {
            return {
              success: false,
              errorKey: 'invalidCredentials',
            };
          }
        }

        // If we didn't take the dev fallback, ensure the DB user exists and is set as admin.
        if (!user) {
          user = existing
            ? await prisma.user.update({
                where: { id: existing.id },
                data: {
                  passwordHash: adminPasswordHash,
                  role: 'ADMIN',
                  status: 'ACTIVE',
                  emailVerifiedAt: new Date(),
                },
                select: {
                  id: true,
                  email: true,
                  passwordHash: true,
                  role: true,
                  status: true,
                },
              })
            : await prisma.user.create({
                data: {
                  email: validated.email,
                  passwordHash: adminPasswordHash,
                  role: 'ADMIN',
                  status: 'ACTIVE',
                  emailVerifiedAt: new Date(),
                  avatarVariant: getRandomAvatarVariant(),
                },
                select: {
                  id: true,
                  email: true,
                  passwordHash: true,
                  role: true,
                  status: true,
                },
              });
        }
      }
    } else {
      user = await prisma.user.findUnique({
        where: { email: validated.email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          status: true,
        },
      });
    }

    if (!user) {
      return {
        success: false,
        errorKey: 'invalidCredentials',
      };
    }

    // Check if user has password (not OAuth-only)
    if (!user.passwordHash) {
      return {
        success: false,
        errorKey: 'invalidCredentials',
      };
    }

    // Verify password
    const passwordValid = await verifyPassword(validated.password, user.passwordHash);

    if (!passwordValid) {
      return {
        success: false,
        errorKey: 'invalidCredentials',
      };
    }

    // Check if registration is complete.
    // SUSPENDED/BANNED users can still sign in (visitor/restricted access).
    if (user.status === 'INACTIVE') {
      return {
        success: false,
        errorKey: 'registrationIncomplete',
      };
    }

    const requiresGuardianChecks = user.role === 'STUDENT';

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
          errorKey: 'parentalConsentRequired',
        };
      }
    }

    // Create session
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;
    const userAgent = headersList.get('user-agent') || undefined;

    await createSession(user.id, ipAddress, userAgent);
    await recordDailyVisit(user.id);

    // Redirect handled by client component
    return {
      success: true,
      userId: user.id,
      role: user.role,
    };
  } catch (error) {
    return {
      success: false,
      errorKey: 'loginFailed',
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
