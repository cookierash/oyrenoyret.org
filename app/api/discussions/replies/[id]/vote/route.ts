/**
 * Reply Vote API
 *
 * POST: Upvote (value=1) or downvote (value=-1)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { grantDiscussionHelp, hasGrantedHelpForReply } from '@/src/modules/credits';
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
      `replies:vote:${identifier}`,
      RATE_LIMITS.VOTE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: replyId } = await params;
    const body = await request.json();
    const value = body.value === -1 ? -1 : 1;

    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        userId: true,
        discussionId: true,
        discussion: {
          select: {
            id: true,
            archivedAt: true,
            userId: true,
          },
        },
      },
    });

    if (!reply || reply.discussion.archivedAt) {
      return NextResponse.json({ error: 'Reply not found or discussion archived' }, { status: 404 });
    }

    await prisma.replyVote.upsert({
      where: {
        replyId_userId: { replyId, userId },
      },
      create: { replyId, userId, value },
      update: { value },
    });

    await prisma.discussion.update({
      where: { id: reply.discussionId },
      data: { lastActivityAt: new Date() },
    });

    const scoreResult = await prisma.replyVote.aggregate({
      where: { replyId },
      _sum: { value: true },
    });
    const score = scoreResult._sum.value ?? 0;

    // Grant help credits to reply author when upvoted (once per reply)
    if (reply.userId !== reply.discussion.userId && score >= 1) {
      const alreadyGranted = await hasGrantedHelpForReply(replyId);
      if (!alreadyGranted) {
        const validation: 'upvotes_2' | 'upvotes_1' = score >= 2 ? 'upvotes_2' : 'upvotes_1';
        await grantDiscussionHelp(reply.userId, reply.discussionId, replyId, validation);
      }
    }

    return NextResponse.json({ voteScore: score });
  } catch (error) {
    console.error('Error voting on reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
