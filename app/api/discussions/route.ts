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
import { CONTENT_LIMITS, RATE_LIMITS } from '@/src/config/constants';
import { sanitizeInput, sanitizeHtml } from '@/src/security/validation';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const topicId = searchParams.get('topicId');
    const subjectsParam = searchParams.get('subjects');
    const query = searchParams.get('q');
    const includeVotes = searchParams.get('includeVotes') === '1';
    const takeParam = Number(searchParams.get('take') ?? 50);
    const skipParam = Number(searchParams.get('skip') ?? 0);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 100) : 50;
    const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : 0;

    const subjectIds = subjectsParam
      ? subjectsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const discussions = await prisma.discussion.findMany({
      where: {
        archivedAt: null,
        ...(subjectIds.length > 0
          ? { subjectId: { in: subjectIds } }
          : subjectId
            ? { subjectId }
            : {}),
        ...(topicId && { topicId }),
        ...(query ? { title: { contains: query, mode: 'insensitive' } } : {}),
      },
      orderBy: { lastActivityAt: 'desc' },
      take,
      skip,
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

    const discussionIds = discussions.map((d) => d.id);
    const voteScores = discussionIds.length
      ? await prisma.discussionVote.groupBy({
        by: ['discussionId'],
        where: { discussionId: { in: discussionIds } },
        _sum: { value: true },
      })
      : [];
    const scoreMap = Object.fromEntries(
      voteScores.map((v) => [v.discussionId, v._sum.value ?? 0])
    );

    const currentUserId = includeVotes ? await getCurrentSession() : null;
    const currentUserVotes =
      includeVotes && currentUserId && discussionIds.length
        ? await prisma.discussionVote.findMany({
          where: { userId: currentUserId, discussionId: { in: discussionIds } },
          select: { discussionId: true, value: true },
        })
        : [];
    const currentUserVoteMap = Object.fromEntries(
      currentUserVotes.map((v) => [v.discussionId, v.value])
    );

    const result = discussions.map((d) => ({
      id: d.id,
      title: d.title,
      contentPreview: d.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180),
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
      userVote: includeVotes ? currentUserVoteMap[d.id] ?? null : null,
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

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `discussions:create:${identifier}`,
      RATE_LIMITS.WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
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
