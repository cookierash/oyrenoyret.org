/**
 * Archive Discussions Cron
 *
 * Archives discussions with no interaction for 24 hours
 * (override with DISCUSSION_INACTIVITY_HOURS env var).
 * Removes discussions with zero replies and refunds the creation credit.
 * Call via: GET /api/cron/archive-discussions
 * SECURITY: In production, CRON_SECRET must be set and passed as Bearer token.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { refundDiscussionCreate } from '@/src/modules/credits';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

const DEFAULT_INACTIVITY_HOURS = 24;
const parsedHours = Number(process.env.DISCUSSION_INACTIVITY_HOURS);
const inactivityHours =
  Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : DEFAULT_INACTIVITY_HOURS;
const ARCHIVE_THRESHOLD_MS = inactivityHours * 60 * 60 * 1000;
const REMOVE_THRESHOLD_MS = ARCHIVE_THRESHOLD_MS;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      if (!cronSecret) {
        return NextResponse.json(
          { error: 'Cron endpoint not configured. Set CRON_SECRET in production.' },
          { status: 503 }
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In dev/test: if CRON_SECRET is set, require it
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(
      `cron:archive-discussions:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const archiveCutoff = new Date(Date.now() - ARCHIVE_THRESHOLD_MS);
    const removeCutoff = new Date(Date.now() - REMOVE_THRESHOLD_MS);
    const candidateCutoff = new Date(
      Math.max(archiveCutoff.getTime(), removeCutoff.getTime())
    );
    const now = new Date();

    const candidates = await prisma.discussion.findMany({
      where: {
        archivedAt: null,
        lastActivityAt: { lt: candidateCutoff },
      },
      select: { id: true },
    });

    let archivedCount = 0;
    let removedCount = 0;
    let refundedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      try {
        const outcome = await prisma.$transaction(async (tx) => {
          const discussion = await tx.discussion.findUnique({
            where: { id: candidate.id },
            select: {
              id: true,
              userId: true,
              archivedAt: true,
              lastActivityAt: true,
            },
          });

          if (!discussion || discussion.archivedAt) {
            return { status: 'skipped' as const };
          }

          const replyCount = await tx.discussionReply.count({
            where: { discussionId: discussion.id },
          });

          if (replyCount === 0 && discussion.lastActivityAt < removeCutoff) {
            const refund = await refundDiscussionCreate(discussion.userId, discussion.id, tx);
            if (!refund.success) {
              throw new Error(refund.error ?? 'Refund failed');
            }
            await tx.discussion.delete({ where: { id: discussion.id } });
            return {
              status: 'removed' as const,
              refunded: refund.success && refund.amount > 0,
            };
          }

          if (discussion.lastActivityAt < archiveCutoff) {
            await tx.discussion.update({
              where: { id: discussion.id },
              data: { archivedAt: now },
            });
            return { status: 'archived' as const };
          }

          return { status: 'skipped' as const };
        });

        if (outcome.status === 'archived') {
          archivedCount += 1;
        } else if (outcome.status === 'removed') {
          removedCount += 1;
          if (outcome.refunded) {
            refundedCount += 1;
          }
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        skippedCount += 1;
        console.error('Error archiving/removing discussion:', error);
      }
    }

    return NextResponse.json({
      archived: archivedCount,
      removed: removedCount,
      refunded: refundedCount,
      skipped: skippedCount,
      message: `Archived ${archivedCount}, removed ${removedCount} (refunded ${refundedCount}).`,
    });
  } catch (error) {
    console.error('Error archiving discussions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
