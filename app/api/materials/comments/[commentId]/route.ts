/**
 * Material Comment API (single)
 *
 * DELETE: Soft-delete a comment/reply owned by the current user.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`materials:comments:delete:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { commentId } = await params;
    const comment = await prisma.materialComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        materialId: true,
        parentCommentId: true,
        rating: true,
        deletedAt: true,
      },
    });

    if (!comment || comment.deletedAt) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.materialComment.update({
        where: { id: commentId },
        data: { deletedAt: now },
        select: { id: true },
      });

      await tx.materialComment.updateMany({
        where: { parentCommentId: commentId, deletedAt: null },
        data: { deletedAt: now },
      });

      // Only top-level reviews affect rating aggregates.
      if (comment.parentCommentId === null && typeof comment.rating === 'number') {
        await tx.$executeRaw`
          UPDATE "Material"
          SET
            "ratingAvg" = CASE
              WHEN "ratingCount" <= 1 THEN 0
              ELSE (("ratingAvg" * "ratingCount") - ${comment.rating}) / ("ratingCount" - 1)
            END,
            "ratingCount" = CASE
              WHEN "ratingCount" <= 1 THEN 0
              ELSE "ratingCount" - 1
            END
          WHERE "id" = ${comment.materialId}
        `;
      }
    });

    return NextResponse.json({ ok: true, deleted: true }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error deleting material comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

