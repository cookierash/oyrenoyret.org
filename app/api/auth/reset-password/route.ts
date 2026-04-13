/**
 * Reset Password API
 *
 * Exchanges a valid reset token for a new password.
 */

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { hashPassword } from '@/src/modules/auth/utils/password';
import { deleteAllUserSessions } from '@/src/modules/auth/utils/session';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

export async function POST(request: Request) {
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(`auth:reset-password:${identifier}`, RATE_LIMITS.AUTH_PASSWORD_RESET);
  if (!rateLimit.allowed) {
    const { status, body, headers } = buildRateLimitResponse(rateLimit);
    return NextResponse.json(body, { status, headers });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token || !password) {
      return NextResponse.json(
        { success: false, errorKey: 'resetTokenInvalid' },
        { status: 400, headers: getPrivateNoStoreHeaders() }
      );
    }

    const tokenHash = hashToken(token);
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, errorKey: 'resetTokenInvalid' },
        { status: 400, headers: getPrivateNoStoreHeaders() }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
    });

    await deleteAllUserSessions(resetRecord.userId);

    return NextResponse.json({ success: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { success: false, errorKey: 'resetPasswordFailed' },
      { status: 500, headers: getPrivateNoStoreHeaders() }
    );
  }
}

