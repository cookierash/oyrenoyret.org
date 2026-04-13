/**
 * Verify Email API
 *
 * Verifies a user's email address using a token from email.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { hashEmailVerificationToken } from '@/src/modules/auth/utils/email-verification';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function POST(request: Request) {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`auth:verify-email:${identifier}`, RATE_LIMITS.AUTH_EMAIL_VERIFICATION);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers: { ...headers, ...getPrivateNoStoreHeaders() } });
    }

    const body = (await request.json().catch(() => ({}))) as { token?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return NextResponse.json(
        { success: false, errorKey: 'verifyEmailTokenInvalid' },
        { status: 400, headers: getPrivateNoStoreHeaders() }
      );
    }

    const tokenHash = hashEmailVerificationToken(token);
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, email: true, expiresAt: true, usedAt: true },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, errorKey: 'verifyEmailTokenInvalid' },
        { status: 400, headers: getPrivateNoStoreHeaders() }
      );
    }

    if (record.usedAt || record.expiresAt < new Date()) {
      const user = await prisma.user.findUnique({
        where: { id: record.userId },
        select: { id: true, email: true, emailVerifiedAt: true },
      });
      const isAlreadyVerified =
        user != null &&
        user.email.toLowerCase() === record.email.toLowerCase() &&
        Boolean(user.emailVerifiedAt);

      if (isAlreadyVerified) {
        return NextResponse.json(
          { success: true, alreadyVerified: true },
          { headers: getPrivateNoStoreHeaders() },
        );
      }

      return NextResponse.json(
        { success: false, errorKey: 'verifyEmailTokenInvalid' },
        { status: 400, headers: getPrivateNoStoreHeaders() }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, email: true },
    });
    if (!user || user.email.toLowerCase() !== record.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, errorKey: 'verifyEmailTokenInvalid' },
        { status: 400, headers: getPrivateNoStoreHeaders() }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error verifying email:', error);
    if (isDev) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to verify email' },
        { status: 500, headers: getPrivateNoStoreHeaders() }
      );
    }
    return NextResponse.json({ success: false, errorKey: 'verifyEmailFailed' }, { status: 500, headers: getPrivateNoStoreHeaders() });
  }
}
