import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
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
    const rateLimit = await checkRateLimit(`materials:purchases:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const accesses = await prisma.materialAccess.findMany({
      where: { userId, material: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        material: {
          select: {
            id: true,
            title: true,
            subjectId: true,
            topicId: true,
            materialType: true,
            difficulty: true,
          },
        },
      },
    });

    const result = accesses.map((a) => ({
      purchasedAt: a.createdAt,
      material: {
        id: a.material.id,
        title: a.material.title,
        subjectId: a.material.subjectId,
        topicId: a.material.topicId,
        materialType: a.material.materialType,
        difficulty: a.material.difficulty,
      },
    }));

    return NextResponse.json(result, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
