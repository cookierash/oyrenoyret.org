/**
 * Discussions API
 *
 * GET: List discussions (includes archived; archived are read-only)
 * POST: Create new discussion (requires auth)
 */

import { NextResponse } from 'next/server';
// NOTE: Keep heavy dependencies inside handlers to avoid module-init crashes.

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { prisma } = await import('@/src/db/client');
    const { RATE_LIMITS } = await import('@/src/config/constants');
    const { getPrivateNoStoreHeaders } = await import('@/src/lib/http-cache');
    const { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } = await import('@/src/security/rateLimiter');
    const { getCurrentSession } = await import('@/src/modules/auth/utils/session');
    const { sanitizeInput } = await import('@/src/security/validation');
    const { Prisma } = await import('@prisma/client');

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const topicId = searchParams.get('topicId');
    const subjectsParam = searchParams.get('subjects');
    const queryRaw = searchParams.get('q');
    const includeVotes = searchParams.get('includeVotes') === '1';
    const takeParam = Number(searchParams.get('take') ?? 50);
    const skipParam = Number(searchParams.get('skip') ?? 0);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 100) : 50;
    const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : 0;

    const sessionUserId = await getCurrentSession().catch(() => null);
    const identifier = getRateLimitIdentifier(request, sessionUserId);
    const rateLimit = await checkRateLimit(`discussions:list:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const subjectIds = subjectsParam
      ? subjectsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const query = sanitizeInput(queryRaw ?? '').trim();
    const combinedSubjectIds = Array.from(
      new Set([
        ...subjectIds,
        ...(subjectId ? [subjectId] : []),
      ]),
    );

    type DiscussionBase = {
      id: string;
      title: string;
      content: string;
      subjectId: string | null;
      topicId: string | null;
      lastActivityAt: Date;
      archivedAt: Date | null;
      createdAt: Date;
      authorId: string;
      authorFirstName: string | null;
      authorLastName: string | null;
      authorEmail: string;
      authorAvatarVariant: string | null;
    };

    const discussions: DiscussionBase[] = await (async () => {
      if (query) {
        type Row = DiscussionBase & { rank: number };
        const vectorExpr = Prisma.sql`to_tsvector('simple', concat_ws(' ', d.title, d.content))`;
        const baseWhere = Prisma.sql`d."removedAt" IS NULL`;
        const subjectFilter =
          combinedSubjectIds.length > 0
            ? Prisma.sql` AND d."subjectId" IN (${Prisma.join(combinedSubjectIds)})`
            : Prisma.empty;
        const topicFilter = topicId ? Prisma.sql` AND d."topicId" = ${topicId}` : Prisma.empty;

        const runQuery = async (tsQueryFn: 'websearch_to_tsquery' | 'plainto_tsquery') => {
          const tsQuery =
            tsQueryFn === 'websearch_to_tsquery'
              ? Prisma.sql`websearch_to_tsquery('simple', ${query})`
              : Prisma.sql`plainto_tsquery('simple', ${query})`;
          return prisma.$queryRaw<Row[]>(Prisma.sql`
            SELECT
              d.id,
              d.title,
              d.content,
              d."subjectId" as "subjectId",
              d."topicId" as "topicId",
              d."lastActivityAt" as "lastActivityAt",
              d."archivedAt" as "archivedAt",
              d."createdAt" as "createdAt",
              u.id as "authorId",
              u."firstName" as "authorFirstName",
              u."lastName" as "authorLastName",
              u.email as "authorEmail",
              u."avatarVariant" as "authorAvatarVariant",
              ts_rank_cd(${vectorExpr}, ${tsQuery}) as rank
            FROM "Discussion" d
            JOIN "User" u ON u.id = d."userId"
            WHERE ${baseWhere}
              AND ${vectorExpr} @@ ${tsQuery}
              ${subjectFilter}
              ${topicFilter}
            ORDER BY rank DESC, d."lastActivityAt" DESC
            LIMIT ${take}
            OFFSET ${skip}
          `);
        };

        try {
          const rows = await runQuery('websearch_to_tsquery');
          return rows;
        } catch {
          const rows = await runQuery('plainto_tsquery');
          return rows;
        }
      }

      const rows = await prisma.discussion.findMany({
        where: {
          removedAt: null,
          ...(combinedSubjectIds.length > 0 ? { subjectId: { in: combinedSubjectIds } } : {}),
          ...(topicId && { topicId }),
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
          archivedAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarVariant: true,
            },
          },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        subjectId: row.subjectId,
        topicId: row.topicId,
        lastActivityAt: row.lastActivityAt,
        archivedAt: row.archivedAt,
        createdAt: row.createdAt,
        authorId: row.user.id,
        authorFirstName: row.user.firstName,
        authorLastName: row.user.lastName,
        authorEmail: row.user.email,
        authorAvatarVariant: row.user.avatarVariant,
      }));
    })();

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

    const replyRows = discussionIds.length
      ? await prisma.discussionReply.findMany({
        where: { discussionId: { in: discussionIds } },
        select: { id: true, discussionId: true },
      })
      : [];
    const replyCountMap = replyRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.discussionId] = (acc[row.discussionId] ?? 0) + 1;
      return acc;
    }, {});
    const replyIds = replyRows.map((r) => r.id);
    const replyVoteScores = replyIds.length
      ? await prisma.replyVote.groupBy({
        by: ['replyId'],
        where: { replyId: { in: replyIds } },
        _sum: { value: true },
      })
      : [];
    const replyScoreMap = Object.fromEntries(
      replyVoteScores.map((v) => [v.replyId, v._sum.value ?? 0])
    );
    const replyTotalsByDiscussion = replyRows.reduce<Record<string, number>>((acc, reply) => {
      const score = replyScoreMap[reply.id] ?? 0;
      acc[reply.discussionId] = (acc[reply.discussionId] ?? 0) + score;
      return acc;
    }, {});

    const currentUserId = includeVotes ? sessionUserId : null;
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
      archivedAt: d.archivedAt,
      authorId: d.authorId,
      authorAvatarVariant: d.authorAvatarVariant,
      authorName:
        [d.authorFirstName, d.authorLastName].filter(Boolean).join(' ') ||
        d.authorEmail.split('@')[0],
      replyCount: replyCountMap[d.id] ?? 0,
      voteScore: scoreMap[d.id] ?? 0,
      replyVoteScore: replyTotalsByDiscussion[d.id] ?? 0,
      totalPopularity: (scoreMap[d.id] ?? 0) + (replyTotalsByDiscussion[d.id] ?? 0),
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
    const { MAX_DISCUSSION_IMAGES } = await import('@/src/config/uploads');
    const { sanitizeDiscussionRichTextHtml, sanitizeInput } = await import('@/src/security/validation');
    const { richTextHtmlToPlainText } = await import('@/src/lib/rich-text');
    const { countDiscussionImages, discussionRichTextHasContent } = await import('@/src/lib/discussion-rich-text');
    const { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } = await import('@/src/security/rateLimiter');
    const { requireVerifiedEmailForWrite } = await import('@/src/modules/auth/utils/write-access');

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
    if (plainText.length > CONTENT_LIMITS.DISCUSSION_CONTENT_MAX) {
      return NextResponse.json(
        { error: 'content is too long', max: CONTENT_LIMITS.DISCUSSION_CONTENT_MAX },
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
        content: safeContent,
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
