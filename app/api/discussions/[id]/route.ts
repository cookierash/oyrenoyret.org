/**
 * Single Discussion API - GET discussion with nested replies
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const discussion = await prisma.discussion.findUnique({
      where: { id, archivedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        subjectId: true,
        topicId: true,
        lastActivityAt: true,
        archivedAt: true,
        acceptedReplyId: true,
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
          where: { parentReplyId: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            childReplies: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                content: true,
                createdAt: true,
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
        votes: true,
      },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    const discussionVoteScore = discussion.votes.reduce((s, v) => s + v.value, 0);

    const allReplyIds = [
      ...discussion.replies.map((r) => r.id),
      ...discussion.replies.flatMap((r) => r.childReplies.map((c) => c.id)),
    ];
    const replyVoteScores = allReplyIds.length
      ? await prisma.replyVote.groupBy({
          by: ['replyId'],
          where: { replyId: { in: allReplyIds } },
          _sum: { value: true },
        })
      : [];
    const replyScoreMap = Object.fromEntries(
      replyVoteScores.map((v) => [v.replyId, v._sum.value ?? 0])
    );

    const formatReply = (r: (typeof discussion.replies)[0]) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      authorId: r.user.id,
      authorName:
        [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') ||
        r.user.email.split('@')[0],
      voteScore: replyScoreMap[r.id] ?? 0,
      childReplies: r.childReplies.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        authorId: c.user.id,
        authorName:
          [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') ||
          c.user.email.split('@')[0],
        voteScore: replyScoreMap[c.id] ?? 0,
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
      authorId: discussion.user.id,
      acceptedReplyId: discussion.acceptedReplyId,
      authorName:
        [discussion.user.firstName, discussion.user.lastName].filter(Boolean).join(' ') ||
        discussion.user.email.split('@')[0],
      voteScore: discussionVoteScore,
      replies: discussion.replies.map(formatReply),
    });
  } catch (error) {
    console.error('Error fetching discussion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

