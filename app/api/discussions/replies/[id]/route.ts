/**
 * Single Reply API - GET reply with its thread path
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`discussions:reply:detail:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: replyId } = await params;
    const { searchParams } = new URL(request.url);
    const expectedDiscussionId = searchParams.get('discussionId');
    const currentUserId = await getCurrentSession();
    const currentUser = currentUserId
      ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } })
      : null;
    const isAdminUser = currentUser?.role === 'ADMIN';

    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        discussionId: true,
        parentReplyId: true,
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

    if (!reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    if (expectedDiscussionId && reply.discussionId !== expectedDiscussionId) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }
    if (reply.removedAt && !(isAdminUser || (currentUserId && reply.user.id === currentUserId))) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    const [voteScore, userVote] = await Promise.all([
      prisma.replyVote.aggregate({
        where: { replyId },
        _sum: { value: true },
      }),
      currentUserId
        ? prisma.replyVote.findUnique({
          where: { replyId_userId: { replyId, userId: currentUserId } },
          select: { value: true },
        })
        : Promise.resolve(null),
    ]);

    let parentReply: any = null;
    if (reply.parentReplyId) {
      parentReply = await prisma.discussionReply.findUnique({
        where: { id: reply.parentReplyId },
        select: {
          id: true,
          content: true,
          createdAt: true,
          discussionId: true,
          parentReplyId: true,
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
      if (
        parentReply?.removedAt &&
        !(isAdminUser || (currentUserId && parentReply.user.id === currentUserId))
      ) {
        parentReply = null;
      }
    }

    const parentVoteScore = parentReply
      ? await prisma.replyVote.aggregate({
        where: { replyId: parentReply.id },
        _sum: { value: true },
      })
      : null;

    const discussion = await prisma.discussion.findUnique({
      where: { id: reply.discussionId },
      select: {
        id: true,
        title: true,
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
    if (
      discussion?.removedAt &&
      !(isAdminUser || (currentUserId && discussion.user.id === currentUserId))
    ) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    const ancestors: { id: string; parentReplyId: string | null }[] = [];
    let cursor = reply.parentReplyId;

    while (cursor) {
      const parent = await prisma.discussionReply.findUnique({
        where: { id: cursor },
        select: { id: true, parentReplyId: true },
      });
      if (!parent) break;
      ancestors.push(parent);
      cursor = parent.parentReplyId;
    }

    ancestors.reverse();
    const threadPath = [...ancestors.map((item) => item.id), reply.id];

    return NextResponse.json({
      discussion: discussion
        ? {
          id: discussion.id,
          title: discussion.title,
          content: discussion.content,
          createdAt: discussion.createdAt,
          authorId: discussion.user.id,
          authorName:
              [discussion.user.firstName, discussion.user.lastName].filter(Boolean).join(' ') ||
              discussion.user.email.split('@')[0],
        }
        : null,
      parentReply: parentReply
        ? {
          id: parentReply.id,
          content: parentReply.content,
          createdAt: parentReply.createdAt,
          discussionId: parentReply.discussionId,
          parentReplyId: parentReply.parentReplyId,
          authorId: parentReply.user.id,
          authorName:
              [parentReply.user.firstName, parentReply.user.lastName].filter(Boolean).join(' ') ||
              parentReply.user.email.split('@')[0],
          voteScore: parentVoteScore?._sum.value ?? 0,
        }
        : null,
      reply: {
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        discussionId: reply.discussionId,
        parentReplyId: reply.parentReplyId,
        removedAt: reply.removedAt,
        removedReason: reply.removedReason,
        authorId: reply.user.id,
        authorName:
          [reply.user.firstName, reply.user.lastName].filter(Boolean).join(' ') ||
          reply.user.email.split('@')[0],
        voteScore: voteScore._sum.value ?? 0,
        userVote: userVote?.value ?? null,
      },
      threadPath,
    }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching reply:', error);
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
    const rateLimit = await checkRateLimit(`discussions:reply:delete:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id: replyId } = await params;
    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      select: { id: true, userId: true, parentReplyId: true },
    });

    if (!reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    if (reply.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const lifted = await tx.discussionReply.updateMany({
        where: { parentReplyId: replyId },
        data: { parentReplyId: reply.parentReplyId },
      });

      await tx.discussionReply.delete({ where: { id: replyId } });

      return { liftedReplies: lifted.count };
    });

    return NextResponse.json(
      { ok: true, deleted: true, liftedReplies: result.liftedReplies },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    console.error('Error deleting reply:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
