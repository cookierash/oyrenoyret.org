/**
 * Discussion Vote API - POST upvote/downvote
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `discussions:vote:${identifier}`,
      RATE_LIMITS.VOTE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: discussionId } = await params;
    const body = await request.json();
    const value = body.value === -1 ? -1 : 1;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.discussion.update({
          where: { id: discussionId, archivedAt: null },
          data: { lastActivityAt: new Date() },
        });
        await tx.discussionVote.upsert({
          where: {
            discussionId_userId: { discussionId, userId },
          },
          create: { discussionId, userId, value },
          update: { value },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Discussion not found or archived' }, { status: 404 });
      }
      throw error;
    }

    const scoreResult = await prisma.discussionVote.aggregate({
      where: { discussionId },
      _sum: { value: true },
    });
    const score = scoreResult._sum.value ?? 0;

    return NextResponse.json({ voteScore: score });
  } catch (error) {
    console.error('Error voting on discussion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
