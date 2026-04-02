/**
 * My Drafts API
 *
 * List current user's draft materials. Requires auth.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`materials:drafts:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const materials = await prisma.material.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        subjectId: true,
        topicId: true,
        title: true,
        status: true,
        materialType: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(materials, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
