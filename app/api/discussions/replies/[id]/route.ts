/**
 * Single Reply API - GET reply with its thread path
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: replyId } = await params;
    const { searchParams } = new URL(request.url);
    const expectedDiscussionId = searchParams.get('discussionId');
    const currentUserId = await getCurrentSession();

    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        discussionId: true,
        parentReplyId: true,
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
      reply: {
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        discussionId: reply.discussionId,
        parentReplyId: reply.parentReplyId,
        authorId: reply.user.id,
        authorName:
          [reply.user.firstName, reply.user.lastName].filter(Boolean).join(' ') ||
          reply.user.email.split('@')[0],
        voteScore: voteScore._sum.value ?? 0,
        userVote: userVote?.value ?? null,
      },
      threadPath,
    });
  } catch (error) {
    console.error('Error fetching reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
