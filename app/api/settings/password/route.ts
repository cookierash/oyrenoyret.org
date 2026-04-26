/**
 * Settings: Password API
 *
 * Changes the current user's password (requires verified email for write actions).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { RATE_LIMITS } from '@/src/config/constants';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/src/modules/auth/utils/password';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { sendPasswordChangedEmail } from '@/src/modules/auth/services/email';
import { getPublicErrorMessage } from '@/src/security/public-error';

const schema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ success: false, errorKey: 'unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`settings:password:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      return NextResponse.json(
        { success: false, errorKey: verified.errorKey },
        { status: verified.status, headers: getPrivateNoStoreHeaders() },
      );
    }

    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid password payload' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
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

    const strength = validatePasswordStrength(parsed.data.newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, error: strength.errors[0] ?? 'Invalid password' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const nextHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextHash },
      select: { id: true },
    });

    try {
      await sendPasswordChangedEmail(user.email);
    } catch (error) {
      // Best-effort: do not block the password change if outbound email fails.
      console.warn('[SETTINGS] Failed to send password changed email:', error);
      if (isDev) {
        console.warn('[SETTINGS] Password changed email fallback (dev):', user.email);
      }
    }

    return NextResponse.json({ success: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { success: false, error: getPublicErrorMessage(error, 'Failed to update password') },
      { status: 500, headers: getPrivateNoStoreHeaders() },
    );
  }
}
