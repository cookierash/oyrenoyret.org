/**
 * Accept Reply API
 *
 * POST: Mark a reply as accepted (discussion author only). Grants credits to helper.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { grantDiscussionHelp, hasGrantedHelpForReply } from '@/src/modules/credits';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status }
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `discussions:accept:${identifier}`,
      RATE_LIMITS.WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: discussionId } = await params;
    const body = await request.json();
    const { replyId } = body;

    if (!replyId || typeof replyId !== 'string') {
      return NextResponse.json(
        { error: 'replyId is required' },
        { status: 400 }
      );
    }

    const discussion = await prisma.discussion.findFirst({
      where: { id: discussionId, userId, archivedAt: null, removedAt: null },
      select: { id: true },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found or not authorized' }, { status: 404 });
    }

    const reply = await prisma.discussionReply.findFirst({
      where: { id: replyId, discussionId, removedAt: null },
      select: { id: true, userId: true },
    });

    if (!reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    if (reply.userId === userId) {
      return NextResponse.json({ error: 'Cannot accept your own reply' }, { status: 400 });
    }

    const alreadyGranted = await hasGrantedHelpForReply(replyId);
    if (alreadyGranted) {
      await prisma.discussion.update({
        where: { id: discussionId },
        data: { acceptedReplyId: replyId },
      });
      return NextResponse.json({ accepted: true, alreadyCredited: true });
    }

    const result = await grantDiscussionHelp(
      reply.userId,
      discussionId,
      replyId,
      'accepted'
    );

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { acceptedReplyId: replyId },
    });

    return NextResponse.json({
      accepted: true,
      creditsGranted: result.success ? result.amount : 0,
    });
  } catch (error) {
    console.error('Error accepting reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
