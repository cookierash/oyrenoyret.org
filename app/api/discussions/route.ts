/**
 * Discussions API
 *
 * GET: List discussions (excludes archived)
 * POST: Create new discussion (requires auth)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { spendDiscussionCreate, getBalance, calcDiscussionCreateCost, roundCredits } from '@/src/modules/credits';
import { CONTENT_LIMITS } from '@/src/config/constants';
import { sanitizeInput, sanitizeHtml } from '@/src/security/validation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const topicId = searchParams.get('topicId');

    const discussions = await prisma.discussion.findMany({
      where: {
        archivedAt: null,
        ...(subjectId && { subjectId }),
        ...(topicId && { topicId }),
      },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        subjectId: true,
        topicId: true,
        lastActivityAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            replies: true,
            votes: true,
          },
        },
      },
    });

    const voteScores = await prisma.discussionVote.groupBy({
      by: ['discussionId'],
      _sum: { value: true },
    });
    const scoreMap = Object.fromEntries(
      voteScores.map((v) => [v.discussionId, v._sum.value ?? 0])
    );

    const result = discussions.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      subjectId: d.subjectId,
      topicId: d.topicId,
      lastActivityAt: d.lastActivityAt,
      createdAt: d.createdAt,
      authorId: d.user.id,
      authorName:
        [d.user.firstName, d.user.lastName].filter(Boolean).join(' ') ||
        d.user.email.split('@')[0],
      replyCount: d._count.replies,
      voteScore: scoreMap[d.id] ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, subjectId, topicId } = body;

    if (!title || typeof title !== 'string' || !content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      );
    }

    const cost = roundCredits(calcDiscussionCreateCost());
    const balance = await getBalance(userId);
    if (balance < cost) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: cost, balance },
        { status: 402 }
      );
    }

    const creditResult = await spendDiscussionCreate(userId, 'pending');
    if (!creditResult.success) {
      if (creditResult.error === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json(
          { error: 'Insufficient credits', required: cost, balance },
          { status: 402 }
        );
      }
      return NextResponse.json({ error: creditResult.error ?? 'Failed to create' }, { status: 500 });
    }

    const discussion = await prisma.discussion.create({
      data: {
        userId,
        title: sanitizeInput(String(title)).slice(0, CONTENT_LIMITS.DISCUSSION_TITLE_MAX),
        content: sanitizeHtml(String(content)).slice(0, CONTENT_LIMITS.DISCUSSION_CONTENT_MAX),
        subjectId: subjectId && String(subjectId).trim() ? subjectId : null,
        topicId: topicId && String(topicId).trim() ? topicId : null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        subjectId: true,
        topicId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...discussion,
      creditsSpent: Math.abs(creditResult.amount),
      balanceAfter: creditResult.balanceAfter,
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Internal server error' },
      { status: 500 }
    );
  }
}
