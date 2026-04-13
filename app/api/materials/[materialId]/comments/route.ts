/**
 * Material Comments API
 *
 * GET: List comments (top-level + in-page replies) for a material
 * POST: Create a comment or reply
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { CONTENT_LIMITS, RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { sanitizeRichTextHtml } from '@/src/security/validation';
import { richTextHasContent, richTextHtmlToPlainText } from '@/src/lib/rich-text';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { Prisma } from '@prisma/client';

type MaterialCommentRow = {
  id: string;
  content: string;
  rating: number | null;
  createdAt: Date;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  childComments: Array<{
    id: string;
    content: string;
    rating: number | null;
    createdAt: Date;
    user: { id: string; firstName: string | null; lastName: string | null; email: string };
  }>;
};

const normalizeVoteValue = (value: unknown): 1 | -1 | null => {
  if (value === 1) return 1;
  if (value === -1) return -1;
  return null;
};

async function getMaterialWithAccess(
  materialId: string,
  currentUserId: string | null,
  isAdminUser: boolean,
) {
  let material: any = null;
  try {
    material = await prisma.material.findFirst({
      where: {
        id: materialId,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        removedAt: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
    material = await prisma.material.findFirst({
      where: {
        id: materialId,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });
    if (material) {
      material = { ...material, removedAt: null };
    }
  }

  if (!material) return { material: null, hasAccess: false } as const;

  const isOwn = currentUserId !== null && material.userId === currentUserId;
  const unlocked = currentUserId
    ? await prisma.materialAccess.findUnique({
        where: { userId_materialId: { userId: currentUserId, materialId } },
        select: { materialId: true },
      })
    : null;
  const hasAccess = Boolean(unlocked) || isOwn;

  if (material.removedAt && !(isOwn || isAdminUser)) {
    return { material: null, hasAccess: false } as const;
  }

  if (material.deletedAt && !hasAccess && !isAdminUser) {
    return { material: null, hasAccess: false } as const;
  }

  return { material, hasAccess };
}

export async function GET(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(
      `materials:comments:list:${identifier}`,
      RATE_LIMITS.GENERAL,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { materialId } = await params;
    const currentUserId = await getCurrentSession();
    const currentUser = currentUserId
      ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } })
      : null;
    const isAdminUser = currentUser?.role === 'ADMIN';

    const { material, hasAccess } = await getMaterialWithAccess(materialId, currentUserId, isAdminUser);
    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const commentVisibility =
      isAdminUser
        ? {}
        : currentUserId
          ? {
              OR: [{ removedAt: null }, { userId: currentUserId }],
            }
          : { removedAt: null };

    const comments = await prisma.materialComment.findMany({
      where: {
        materialId,
        parentCommentId: null,
        deletedAt: null,
        ...(commentVisibility as any),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        rating: true,
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
        childComments: {
          where: {
            deletedAt: null,
            userId: material.userId,
            ...(isAdminUser || currentUserId === material.userId ? {} : { removedAt: null }),
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            rating: true,
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
    });

    const allCommentIds = [
      ...comments.map((c) => c.id),
      ...comments.flatMap((c) => c.childComments.map((r) => r.id)),
    ];

    const [voteScores, currentUserVotes] = await Promise.all([
      allCommentIds.length
        ? prisma.materialCommentVote.groupBy({
            by: ['commentId'],
            where: { commentId: { in: allCommentIds } },
            _sum: { value: true },
          })
        : Promise.resolve([]),
      currentUserId && allCommentIds.length
        ? prisma.materialCommentVote.findMany({
            where: { userId: currentUserId, commentId: { in: allCommentIds } },
            select: { commentId: true, value: true },
          })
        : Promise.resolve([]),
    ]);

    const scoreMap = Object.fromEntries(voteScores.map((v) => [v.commentId, v._sum.value ?? 0]));
    const currentUserVoteMap = Object.fromEntries(currentUserVotes.map((v) => [v.commentId, v.value]));

    const formatAuthorName = (user: MaterialCommentRow['user']) =>
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];

    const formatted = (comments as MaterialCommentRow[]).map((c) => ({
      id: c.id,
      content: c.content,
      rating: c.rating,
      createdAt: c.createdAt,
      removedAt: (c as any).removedAt ?? null,
      removedReason: (c as any).removedReason ?? null,
      authorId: c.user.id,
      authorName: formatAuthorName(c.user),
      voteScore: scoreMap[c.id] ?? 0,
      userVote: normalizeVoteValue(currentUserVoteMap[c.id] ?? null),
      replies: c.childComments.map((r) => ({
        id: r.id,
        content: r.content,
        rating: r.rating,
        createdAt: r.createdAt,
        removedAt: (r as any).removedAt ?? null,
        removedReason: (r as any).removedReason ?? null,
        authorId: r.user.id,
        authorName: formatAuthorName(r.user),
        voteScore: scoreMap[r.id] ?? 0,
        userVote: normalizeVoteValue(currentUserVoteMap[r.id] ?? null),
      })),
    }));

    return NextResponse.json(
      {
        comments: formatted,
        ratingAvg: material.ratingAvg,
        ratingCount: material.ratingCount,
        currentUserId: currentUserId ?? null,
        materialAuthorId: material.userId,
        canComment: !material.removedAt,
        canReview: hasAccess && !material.removedAt,
      },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    console.error('Error fetching material comments:', error);
    const message = error instanceof Error ? error.message : '';
    const looksLikeMissingMigration =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') ||
      isDbSchemaMismatch(error) ||
      /column .* does not exist/i.test(message) ||
      /relation .* does not exist/i.test(message);
    if (looksLikeMissingMigration) {
      return NextResponse.json(
        { error: 'Database schema out of date', code: 'DB_MIGRATION_REQUIRED' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
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
        { status: verified.status },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `materials:comments:create:${identifier}`,
      RATE_LIMITS.WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { materialId } = await params;
    const body = await request.json().catch(() => ({}));
    const { content, parentCommentId, rating } = body as {
      content?: unknown;
      parentCommentId?: unknown;
      rating?: unknown;
    };

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isAdminUser = currentUser?.role === 'ADMIN';

    const { material, hasAccess } = await getMaterialWithAccess(materialId, userId, isAdminUser);
    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }
    if (material.removedAt) {
      return NextResponse.json({ error: 'Material was removed by moderators' }, { status: 403 });
    }

    const safeContent = sanitizeRichTextHtml(String(content));
    const plainText = richTextHtmlToPlainText(safeContent);
    if (!plainText || !richTextHasContent(safeContent)) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (plainText.length > CONTENT_LIMITS.REPLY_CONTENT_MAX) {
      return NextResponse.json(
        { error: 'content is too long', max: CONTENT_LIMITS.REPLY_CONTENT_MAX },
        { status: 400 }
      );
    }

    const parentId = typeof parentCommentId === 'string' && parentCommentId.trim()
      ? parentCommentId.trim()
      : null;

    if (parentId) {
      if (material.userId !== userId) {
        return NextResponse.json({ error: 'Only the material author can reply' }, { status: 403 });
      }
      const parent = await prisma.materialComment.findFirst({
        where: {
          id: parentId,
          materialId,
          parentCommentId: null,
          deletedAt: null,
          removedAt: null,
        },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }

      const reply = await prisma.materialComment.create({
        data: {
          materialId,
          parentCommentId: parentId,
          userId,
          content: safeContent,
          rating: null,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentCommentId: true,
        },
      });

      return NextResponse.json(reply, { headers: getPrivateNoStoreHeaders() });
    }

    const parsedRating =
      rating === undefined || rating === null || rating === ''
        ? null
        : Number(rating);
    if (parsedRating !== null) {
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 });
      }
      if (!hasAccess) {
        return NextResponse.json({ error: 'Purchase required to rate' }, { status: 403 });
      }
    }

    const existing = await prisma.materialComment.findFirst({
      where: {
        materialId,
        userId,
        parentCommentId: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'You already commented on this material' }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const comment = await tx.materialComment.create({
        data: {
          materialId,
          parentCommentId: null,
          userId,
          content: safeContent,
          rating: parsedRating,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          parentCommentId: true,
          rating: true,
        },
      });

      if (parsedRating !== null) {
        await tx.$executeRaw`
          UPDATE "Material"
          SET
            "ratingAvg" = CASE
              WHEN "ratingCount" = 0 THEN ${parsedRating}
              ELSE (("ratingAvg" * "ratingCount") + ${parsedRating}) / ("ratingCount" + 1)
            END,
            "ratingCount" = "ratingCount" + 1
          WHERE "id" = ${materialId}
        `;
      }

      return comment;
    });

    return NextResponse.json(created, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error creating material comment:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const looksLikeMissingMigration =
      isDbSchemaMismatch(error) ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') ||
      /column .* does not exist/i.test(message) ||
      /relation .* does not exist/i.test(message);
    if (looksLikeMissingMigration) {
      return NextResponse.json(
        { error: 'Database schema out of date', code: 'DB_MIGRATION_REQUIRED' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Internal server error' },
      { status: 500 },
    );
  }
}
