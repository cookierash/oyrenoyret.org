/**
 * Settings: Email API
 *
 * Changes the current user's email and sends a verification email to the new address.
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { RATE_LIMITS } from '@/src/config/constants';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { verifyPassword } from '@/src/modules/auth/utils/password';
import { issueEmailVerificationToken } from '@/src/modules/auth/utils/email-verification';
import { sendAccountVerificationEmail } from '@/src/modules/auth/services/email';

function getAppOrigin(request: Request): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // ignore
    }
  }
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    request.headers.get('host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

const schema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
  currentPassword: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ success: false, errorKey: 'unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`settings:email:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid email payload' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        parentEmail: true,
        passwordHash: true,
      },
    });
    if (!user) {
      return NextResponse.json({ success: false, errorKey: 'unauthorized' }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Password not set' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const passwordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, errorKey: 'invalidCredentials' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const nextEmail = parsed.data.email;
    if (nextEmail.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json(
        { success: true, unchanged: true },
        { headers: getPrivateNoStoreHeaders() },
      );
    }

    if (user.parentEmail && user.parentEmail.trim().toLowerCase() === nextEmail.toLowerCase()) {
      return NextResponse.json(
        { success: false, errorKey: 'parentEmailSame' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: nextEmail,
          emailVerifiedAt: null,
        },
        select: { id: true },
      });
    } catch (error) {
      const isUnique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (isUnique) {
        return NextResponse.json(
          { success: false, errorKey: 'emailExists' },
          { status: 409, headers: getPrivateNoStoreHeaders() },
        );
      }
      throw error;
    }

    const { token } = await issueEmailVerificationToken(userId);
    const origin = getAppOrigin(request);
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

    if (isDev) {
      console.log(`[SETTINGS] Email verification link for ${nextEmail}: ${verifyUrl}`);
    }

    await sendAccountVerificationEmail(nextEmail, verifyUrl);

    return NextResponse.json(
      {
        success: true,
        verificationSent: true,
      },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    console.error('Error updating email:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update email' },
      { status: 500, headers: getPrivateNoStoreHeaders() },
    );
  }
}
