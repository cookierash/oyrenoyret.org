/**
 * Settings: Profile API
 *
 * Updates basic profile fields for the current user.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { RATE_LIMITS } from '@/src/config/constants';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { AVATAR_VARIANTS } from '@/src/lib/avatar';
import { getPublicErrorMessage } from '@/src/security/public-error';

const schema = z.object({
  firstName: z
    .string()
    .max(50)
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim() : value))
    .refine((value) => value == null || value.length > 0, { message: 'firstName cannot be empty' }),
  lastName: z
    .string()
    .max(50)
    .optional()
    .transform((value) => (typeof value === 'string' ? value.trim() : value))
    .refine((value) => value == null || value.length > 0, { message: 'lastName cannot be empty' }),
  avatarVariant: z.enum(AVATAR_VARIANTS).optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ success: false, errorKey: 'unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`settings:profile:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid profile payload' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const updateData: { firstName?: string | null; lastName?: string | null; avatarVariant?: string } = {};
    if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName ?? null;
    if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName ?? null;
    if (parsed.data.avatarVariant !== undefined) updateData.avatarVariant = parsed.data.avatarVariant;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, unchanged: true }, { headers: getPrivateNoStoreHeaders() });
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true },
    });

    return NextResponse.json({ success: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, error: getPublicErrorMessage(error, 'Failed to update profile') },
      { status: 500, headers: getPrivateNoStoreHeaders() },
    );
  }
}
