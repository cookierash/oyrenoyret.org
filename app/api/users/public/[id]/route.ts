/**
 * Public User Info API
 *
 * Returns minimal, non-sensitive user info for authenticated users (used for avatar hover cards).
 * Does NOT expose email or other private fields.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { RATE_LIMITS } from '@/src/config/constants';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

const idSchema = z.string().min(1).max(64);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUserId = await getCurrentSession();
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, errorKey: 'unauthorized' },
        { status: 401, headers: getPrivateNoStoreHeaders() },
      );
    }

    const identifier = getRateLimitIdentifier(request, sessionUserId);
    const rateLimit = await checkRateLimit(`users:public:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errorKey: 'invalidUserId' },
        { status: 400, headers: getPrivateNoStoreHeaders() },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: parsed.data }, { publicId: parsed.data }],
      },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        lastName: true,
        avatarVariant: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, errorKey: 'notFound' },
        { status: 404, headers: getPrivateNoStoreHeaders() },
      );
    }

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    console.error('Error fetching public user info:', error);
    return NextResponse.json(
      { success: false, errorKey: 'serverError' },
      { status: 500, headers: getPrivateNoStoreHeaders() },
    );
  }
}

