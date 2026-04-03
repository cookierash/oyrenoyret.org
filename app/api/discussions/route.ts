/**
 * Discussions API
 *
 * GET: List discussions (excludes archived)
 * POST: Create new discussion (requires auth)
 */

import { NextResponse } from 'next/server';
// NOTE: Keep heavy dependencies inside handlers to avoid module-init crashes.

export async function GET(request: Request) {
  try {
    const { prisma } = await import('@/src/db/client');
    const { RATE_LIMITS } = await import('@/src/config/constants');
    const { getPrivateNoStoreHeaders } = await import('@/src/lib/http-cache');
    const { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } = await import('@/src/security/rateLimiter');
    const { getCurrentSession } = await import('@/src/modules/auth/utils/session');

    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`discussions:list:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

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

    const headers = getPrivateNoStoreHeaders();
    return NextResponse.json(result, { headers });
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
    const { prisma } = await import('@/src/db/client');
    const { getCurrentSession } = await import('@/src/modules/auth/utils/session');
    const { spendDiscussionCreate, getBalance, calcDiscussionCreateCost, roundCredits } = await import('@/src/modules/credits');
    const { CONTENT_LIMITS, RATE_LIMITS } = await import('@/src/config/constants');
    const { sanitizeInput, sanitizeHtml } = await import('@/src/security/validation');
    const { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } = await import('@/src/security/rateLimiter');

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

    let body: { title?: unknown; content?: unknown; subjectId?: unknown; topicId?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
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

    const safeSubjectId = subjectId && String(subjectId).trim()
      ? String(subjectId).trim()
      : null;
    const safeTopicId = topicId && String(topicId).trim()
      ? String(topicId).trim()
      : null;

    const discussion = await prisma.discussion.create({
      data: {
        userId,
        title: sanitizeInput(String(title)).slice(0, CONTENT_LIMITS.DISCUSSION_TITLE_MAX),
        content: sanitizeHtml(String(content)).slice(0, CONTENT_LIMITS.DISCUSSION_CONTENT_MAX),
        subjectId: safeSubjectId,
        topicId: safeTopicId,
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

    if (creditResult.transactionId) {
      await prisma.creditTransaction.updateMany({
        where: { id: creditResult.transactionId },
        data: {
          referenceId: discussion.id,
          metadata: { discussionId: discussion.id },
        },
      });
    }

    return NextResponse.json({
      ...discussion,
      creditsSpent: Math.abs(creditResult.amount),
      balanceAfter: creditResult.balanceAfter,
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        error: message || 'Internal server error',
        code: 'DISCUSSION_CREATE_FAILED',
      },
      { status: 500 }
    );
  }
}
