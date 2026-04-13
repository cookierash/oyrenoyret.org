/**
 * Discussion Replies API - POST add reply
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { CONTENT_LIMITS, RATE_LIMITS } from '@/src/config/constants';
import { MAX_DISCUSSION_IMAGES } from '@/src/config/uploads';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { sanitizeDiscussionRichTextHtml } from '@/src/security/validation';
import { richTextHtmlToPlainText } from '@/src/lib/rich-text';
import { countDiscussionImages, discussionRichTextHasContent } from '@/src/lib/discussion-rich-text';
import { grantDiscussionReply } from '@/src/modules/credits';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`discussions:replies:list:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: discussionId } = await params;
    const { searchParams } = new URL(request.url);
    const parentReplyId = searchParams.get('parentReplyId');
    if (!parentReplyId) {
      return NextResponse.json({ error: 'parentReplyId is required' }, { status: 400 });
    }

    const currentUserId = await getCurrentSession();
    const currentUser = currentUserId
      ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } })
      : null;
    const isAdminUser = currentUser?.role === 'ADMIN';

    const discussion = await prisma.discussion.findFirst({
      where: { id: discussionId, archivedAt: null },
      select: { id: true, userId: true, removedAt: true },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found or archived' }, { status: 404 });
    }
    if (discussion.removedAt && !(isAdminUser || (currentUserId && discussion.userId === currentUserId))) {
      return NextResponse.json({ error: 'Discussion not found or archived' }, { status: 404 });
    }

    const replies = await prisma.discussionReply.findMany({
      where: isAdminUser
        ? { discussionId, parentReplyId }
        : {
            discussionId,
            parentReplyId,
            OR: [
              { removedAt: null },
              ...(currentUserId ? [{ userId: currentUserId }] : []),
            ],
          },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        removedAt: true,
        removedReason: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const replyIds = replies.map((reply) => reply.id);

    const [replyVoteScores, currentUserReplyVotes] = await Promise.all([
      replyIds.length
        ? prisma.replyVote.groupBy({
          by: ['replyId'],
          where: { replyId: { in: replyIds } },
          _sum: { value: true },
        })
        : Promise.resolve([]),
      currentUserId && replyIds.length
        ? prisma.replyVote.findMany({
          where: { userId: currentUserId, replyId: { in: replyIds } },
          select: { replyId: true, value: true },
        })
        : Promise.resolve([]),
    ]);

    const replyScoreMap = Object.fromEntries(
      replyVoteScores.map((v) => [v.replyId, v._sum.value ?? 0])
    );
    const currentUserReplyVoteMap = Object.fromEntries(
      currentUserReplyVotes.map((v) => [v.replyId, v.value])
    );

    const formatted = replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      removedAt: (reply as any).removedAt ?? null,
      removedReason: (reply as any).removedReason ?? null,
      authorId: reply.user.id,
      authorName:
        [reply.user.firstName, reply.user.lastName].filter(Boolean).join(' ') ||
        reply.user.email.split('@')[0],
      voteScore: replyScoreMap[reply.id] ?? 0,
      userVote: currentUserReplyVoteMap[reply.id] ?? null,
      parentReplyId,
    }));

    return NextResponse.json({ replies: formatted }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching replies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
      `discussions:reply:${identifier}`,
      RATE_LIMITS.WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: discussionId } = await params;
    const body = await request.json();
    const { content, parentReplyId } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    const safeContent = sanitizeDiscussionRichTextHtml(String(content));
    const plainText = richTextHtmlToPlainText(safeContent);
    if (!discussionRichTextHasContent(safeContent)) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }
    if (countDiscussionImages(safeContent) > MAX_DISCUSSION_IMAGES) {
      return NextResponse.json({ error: 'Too many images', max: MAX_DISCUSSION_IMAGES }, { status: 400 });
    }
    if (plainText.length > CONTENT_LIMITS.REPLY_CONTENT_MAX) {
      return NextResponse.json(
        { error: 'content is too long', max: CONTENT_LIMITS.REPLY_CONTENT_MAX },
        { status: 400 }
      );
    }

    const discussion = await prisma.discussion.findFirst({
      where: { id: discussionId, archivedAt: null, removedAt: null },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found or archived' }, { status: 404 });
    }

    if (parentReplyId) {
      const parent = await prisma.discussionReply.findFirst({
        where: { id: parentReplyId, discussionId, removedAt: null },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent reply not found' }, { status: 404 });
      }
    }

    const reply = await prisma.discussionReply.create({
      data: {
        discussionId,
        parentReplyId: parentReplyId || null,
        userId,
        content: safeContent,
      },
    });

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { lastActivityAt: new Date() },
    });

    const isDiscussionAuthor = discussion.userId === userId;
    if (!isDiscussionAuthor) {
      await grantDiscussionReply(userId, discussionId, reply.id);
    }

    return NextResponse.json({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      parentReplyId: reply.parentReplyId,
    });
  } catch (error) {
    console.error('Error creating reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
