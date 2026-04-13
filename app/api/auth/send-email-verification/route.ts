/**
 * Send Email Verification API
 *
 * Sends a verification link to the currently authenticated user's email.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { hashEmailVerificationToken, issueEmailVerificationToken } from '@/src/modules/auth/utils/email-verification';
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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown };
    const providedToken = typeof body.token === 'string' ? body.token.trim() : '';
    const sessionUserId = await getCurrentSession();

    let userId = sessionUserId;
    if (!userId && providedToken) {
      const tokenHash = hashEmailVerificationToken(providedToken);
      const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { userId: true, email: true },
      });
      if (!record) {
        return NextResponse.json(
          { success: false, errorKey: 'verifyEmailTokenInvalid' },
          { status: 400, headers: getPrivateNoStoreHeaders() },
        );
      }
      userId = record.userId;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, errorKey: 'unauthorized' },
        { status: 401, headers: getPrivateNoStoreHeaders() },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`auth:send-email-verification:${identifier}`, RATE_LIMITS.AUTH_EMAIL_VERIFICATION);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, errorKey: 'unauthorized' },
        { status: 401, headers: getPrivateNoStoreHeaders() },
      );
    }
    if (!sessionUserId && providedToken) {
      const tokenHash = hashEmailVerificationToken(providedToken);
      const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { email: true },
      });
      if (!record || record.email.toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json(
          { success: false, errorKey: 'verifyEmailTokenInvalid' },
          { status: 400, headers: getPrivateNoStoreHeaders() },
        );
      }
    }
    if (user.emailVerifiedAt) {
      return NextResponse.json({ success: true, alreadyVerified: true }, { headers: getPrivateNoStoreHeaders() });
    }

    const { token: verificationToken } = await issueEmailVerificationToken(userId);
    const origin = getAppOrigin(request);
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    await sendAccountVerificationEmail(user.email, verifyUrl);
    return NextResponse.json({ success: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error sending email verification:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send verification email' },
      { status: 500, headers: getPrivateNoStoreHeaders() }
    );
  }
}
