/**
 * Material Comment Vote API
 *
 * POST: Upvote/downvote/remove vote for a comment (requires purchase/unlock)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { Prisma } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
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
    const rateLimit = await checkRateLimit(`materials:comments:vote:${identifier}`, RATE_LIMITS.VOTE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { commentId } = await params;
    const body = await request.json().catch(() => ({}));
    const valueRaw = typeof body?.value === 'number' ? body.value : Number(body?.value);
    const value = valueRaw === 1 ? 1 : valueRaw === -1 ? -1 : 0;

    const comment = await prisma.materialComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: {
        id: true,
        materialId: true,
        removedAt: true,
        material: { select: { id: true, userId: true, deletedAt: true, status: true, removedAt: true } },
      },
    });

    if (!comment || comment.removedAt || comment.material.removedAt || comment.material.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const isOwn = comment.material.userId === userId;
    const unlocked = await prisma.materialAccess.findUnique({
      where: { userId_materialId: { userId, materialId: comment.materialId } },
      select: { materialId: true },
    });
    const hasAccess = Boolean(unlocked) || isOwn;
    if (comment.material.deletedAt && !hasAccess) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Purchase required' }, { status: 403 });
    }

    if (value === 0) {
      await prisma.materialCommentVote.deleteMany({
        where: { commentId, userId },
      });
      return NextResponse.json({ ok: true }, { headers: getPrivateNoStoreHeaders() });
    }

    await prisma.materialCommentVote.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, value },
      update: { value },
    });

    return NextResponse.json({ ok: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error voting on material comment:', error);
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
