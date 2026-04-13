/**
 * Single Discussion API - GET discussion with nested replies
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { refundDiscussionCreate } from '@/src/modules/credits';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUserId = await getCurrentSession();
    const currentUser = currentUserId
      ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } })
      : null;
    const isAdminUser = currentUser?.role === 'ADMIN';

    const identifier = getRateLimitIdentifier(request, currentUserId);
    const rateLimit = await checkRateLimit(`discussions:detail:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        subjectId: true,
        topicId: true,
        lastActivityAt: true,
        archivedAt: true,
        acceptedReplyId: true,
        removedAt: true,
        removedReason: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        replies: {
          where: isAdminUser
            ? { parentReplyId: null }
            : {
                parentReplyId: null,
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
            childReplies: {
              where: isAdminUser
                ? {}
                : {
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
            },
          },
        },
      },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }
    if (discussion.removedAt && !(isAdminUser || (currentUserId && discussion.user.id === currentUserId))) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    const allReplyIds = [
      ...discussion.replies.map((r) => r.id),
      ...discussion.replies.flatMap((r) => r.childReplies.map((c) => c.id)),
    ];

    const [discussionVoteSum, currentUserVote, replyVoteScores, currentUserReplyVotes] = await Promise.all([
      prisma.discussionVote.aggregate({
        where: { discussionId: id },
        _sum: { value: true },
      }),
      currentUserId
        ? prisma.discussionVote.findUnique({
          where: { discussionId_userId: { discussionId: id, userId: currentUserId } },
          select: { value: true },
        })
        : Promise.resolve(null),
      allReplyIds.length
        ? prisma.replyVote.groupBy({
          by: ['replyId'],
          where: { replyId: { in: allReplyIds } },
          _sum: { value: true },
        })
        : Promise.resolve([]),
      currentUserId && allReplyIds.length
        ? prisma.replyVote.findMany({
          where: { userId: currentUserId, replyId: { in: allReplyIds } },
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

    const formatReply = (r: (typeof discussion.replies)[0]) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      removedAt: r.removedAt,
      removedReason: r.removedReason,
      authorId: r.user.id,
      authorName:
        [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') ||
        r.user.email.split('@')[0],
      voteScore: replyScoreMap[r.id] ?? 0,
      userVote: currentUserReplyVoteMap[r.id] ?? null,
      childReplies: r.childReplies.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        removedAt: c.removedAt,
        removedReason: c.removedReason,
        authorId: c.user.id,
        authorName:
          [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') ||
          c.user.email.split('@')[0],
        voteScore: replyScoreMap[c.id] ?? 0,
        userVote: currentUserReplyVoteMap[c.id] ?? null,
      })),
    });

    return NextResponse.json({
      id: discussion.id,
      title: discussion.title,
      content: discussion.content,
      subjectId: discussion.subjectId,
      topicId: discussion.topicId,
      lastActivityAt: discussion.lastActivityAt,
      createdAt: discussion.createdAt,
      archivedAt: discussion.archivedAt,
      removedAt: discussion.removedAt,
      removedReason: discussion.removedReason,
      authorId: discussion.user.id,
      acceptedReplyId: discussion.acceptedReplyId,
      authorName:
        [discussion.user.firstName, discussion.user.lastName].filter(Boolean).join(' ') ||
        discussion.user.email.split('@')[0],
      voteScore: discussionVoteSum._sum.value ?? 0,
      userVote: currentUserVote?.value ?? null,
      replies: discussion.replies.map(formatReply),
      currentUserId: currentUserId ?? null,
    }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching discussion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`discussions:delete:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id } = await params;
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { id: true, userId: true, archivedAt: true, removedAt: true },
    });

    if (!discussion || discussion.archivedAt) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    if (discussion.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (discussion.removedAt) {
      return NextResponse.json({ ok: true, alreadyDeleted: true }, { headers: getPrivateNoStoreHeaders() });
    }

    const now = new Date();
    const replyCount = await prisma.discussionReply.count({ where: { discussionId: id } });

    if (replyCount === 0) {
      const outcome = await prisma.$transaction(async (tx) => {
        const refund = await refundDiscussionCreate(userId, id, tx);
        if (!refund.success) {
          throw new Error(refund.error ?? 'Refund failed');
        }
        await tx.discussion.delete({ where: { id } });
        return { refunded: refund.amount > 0 };
      });

      return NextResponse.json(
        { ok: true, deleted: true, refunded: outcome.refunded },
        { headers: getPrivateNoStoreHeaders() },
      );
    }

    await prisma.discussion.update({
      where: { id },
      data: { removedAt: now, removedById: userId, removedReason: 'author_deleted' },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, deleted: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error deleting discussion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
