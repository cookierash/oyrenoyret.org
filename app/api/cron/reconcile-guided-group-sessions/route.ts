/**
 * Reconcile Guided Group Sessions Cron
 *
 * - Auto-cancels sessions at start if <2 approved learners (no credit exchange).
 * - Marks facilitator no-show if session window passed without being started (1-credit penalty).
 *
 * Call via: GET /api/cron/reconcile-guided-group-sessions
 * SECURITY: In production, CRON_SECRET must be set and passed as Bearer token.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import {
  calcGroupSessionFacilitatorPayout,
  calcGroupSessionParticipantCost,
  grantGroupSessionFacilitation,
  spendGroupSessionNoShowPenalty,
  spendGroupSessionParticipation,
} from '@/src/modules/credits';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const runtime = 'nodejs';

const NO_SHOW_GRACE_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      if (!cronSecret) {
        return NextResponse.json(
          { error: 'Cron endpoint not configured. Set CRON_SECRET in production.' },
          { status: 503 },
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(
      `cron:reconcile-guided-group-sessions:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const now = new Date();
    const nowMs = now.getTime();
    const recentWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Notify participants when the scheduled start time arrives.
    // This is idempotent via `startingNotifiedAt`.
    try {
      const notifyCandidates = await prisma.guidedGroupSession.findMany({
        where: {
          deletedAt: null,
          startingNotifiedAt: null,
          status: { in: ['SCHEDULED', 'LIVE'] },
          scheduledAt: { lte: now, gte: recentWindowStart },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 200,
        select: {
          id: true,
          title: true,
          facilitatorId: true,
          scheduledAt: true,
          durationMinutes: true,
        },
      });

      for (const session of notifyCandidates) {
        try {
          const approvedCount = await prisma.guidedGroupSessionEnrollment.count({
            where: { sessionId: session.id, status: 'APPROVED' },
          });
          if (approvedCount < 2) continue;

          const acquired = await prisma.guidedGroupSession.updateMany({
            where: { id: session.id, startingNotifiedAt: null },
            data: { startingNotifiedAt: now },
          });
          if (!acquired.count) continue;

          const enrollments = await prisma.guidedGroupSessionEnrollment.findMany({
            where: { sessionId: session.id, status: 'APPROVED' },
            select: { userId: true },
          });

          const linkUrl = `/my-library/guided-group-sessions/${session.id}/live`;
          await prisma.moderationNotice.createMany({
            data: [
              {
                userId: session.facilitatorId,
                type: 'GUIDED_GROUP_SESSION_STARTING' as const,
                title: 'Guided group session starting',
                body: `"${session.title}" is starting now.`,
                linkUrl,
              },
              ...enrollments.map((e) => ({
                userId: e.userId,
                type: 'GUIDED_GROUP_SESSION_STARTING' as const,
                title: 'Guided group session starting',
                body: `"${session.title}" is starting now.`,
                linkUrl,
              })),
            ],
          });
        } catch (error) {
          if (!isDbSchemaMismatch(error)) {
            console.error('Error notifying guided group session start:', error);
          }
        }
      }
    } catch (error) {
      if (!isDbSchemaMismatch(error)) {
        console.error('Error fetching guided group session start notifications:', error);
      }
    }

    const candidates = await prisma.guidedGroupSession.findMany({
      where: {
        deletedAt: null,
        status: 'SCHEDULED',
        startedAt: null,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
      select: {
        id: true,
        title: true,
        facilitatorId: true,
        scheduledAt: true,
        durationMinutes: true,
      },
    });

    let autoCancelled = 0;
    let noShow = 0;
    let skipped = 0;
    let completed = 0;
    let settledEnrollments = 0;

    for (const session of candidates) {
      try {
        const approvedCount = await prisma.guidedGroupSessionEnrollment.count({
          where: { sessionId: session.id, status: 'APPROVED' },
        });

        if (approvedCount < 2) {
          const enrollments = await prisma.guidedGroupSessionEnrollment.findMany({
            where: { sessionId: session.id, status: { in: ['PENDING', 'APPROVED'] } },
            select: { userId: true },
          });

          const hasAnyRegistrations = enrollments.length > 0;
          const facilitatorNotice = hasAnyRegistrations
            ? {
                userId: session.facilitatorId,
                type: 'GUIDED_GROUP_SESSION_AUTO_CANCELLED' as const,
                title: 'Guided group session auto-cancelled',
                body: `"${session.title}" was auto-cancelled because fewer than 2 learners were approved by the start time.`,
                linkUrl: '/my-library/guided-group-sessions',
              }
            : {
                userId: session.facilitatorId,
                type: 'GUIDED_GROUP_SESSION_AUTO_CANCELLED' as const,
                title: 'Guided group session removed',
                body: `"${session.title}" was removed because no learners registered by the start time.`,
                linkUrl: '/my-library/guided-group-sessions',
              };

          await prisma.$transaction(async (tx) => {
            await tx.guidedGroupSession.update({
              where: { id: session.id },
              data: {
                status: 'AUTO_CANCELLED',
                cancelledAt: now,
                endedAt: now,
                cancelReason: hasAnyRegistrations ? 'auto_cancel_min_learners' : 'auto_cancel_no_registrations',
              },
              select: { id: true },
            });

            await tx.guidedGroupSessionEnrollment.updateMany({
              where: { sessionId: session.id, status: { in: ['PENDING', 'APPROVED'] } },
              data: { status: 'CANCELLED', cancelledAt: now },
            });

            const notices = [
              facilitatorNotice,
              ...enrollments.map((e) => ({
                userId: e.userId,
                type: 'GUIDED_GROUP_SESSION_AUTO_CANCELLED' as const,
                title: 'Guided group session auto-cancelled',
                body: `"${session.title}" was auto-cancelled because fewer than 2 learners were approved by the start time.`,
                linkUrl: '/my-library/guided-group-sessions',
              })),
            ];

            await tx.moderationNotice.createMany({ data: notices });
          });

          autoCancelled += 1;
          continue;
        }

        const endMs = session.scheduledAt.getTime() + session.durationMinutes * 60_000;
        if (nowMs <= endMs + NO_SHOW_GRACE_MS) {
          skipped += 1;
          continue;
        }

        const enrollments = await prisma.guidedGroupSessionEnrollment.findMany({
          where: { sessionId: session.id, status: { in: ['PENDING', 'APPROVED'] } },
          select: { userId: true },
        });

        await prisma.$transaction(async (tx) => {
          await tx.guidedGroupSession.update({
            where: { id: session.id },
            data: {
              status: 'NO_SHOW',
              endedAt: now,
              cancelReason: 'no_show',
            },
            select: { id: true },
          });

          await tx.guidedGroupSessionEnrollment.updateMany({
            where: { sessionId: session.id, status: { in: ['PENDING', 'APPROVED'] } },
            data: { status: 'CANCELLED', cancelledAt: now },
          });

          const notices = [
            {
              userId: session.facilitatorId,
              type: 'GUIDED_GROUP_SESSION_NO_SHOW' as const,
              title: 'Guided group session no-show',
              body: `You did not start "${session.title}". A 1-credit no-show penalty applies.`,
              linkUrl: '/my-library/guided-group-sessions',
            },
            ...enrollments.map((e) => ({
              userId: e.userId,
              type: 'GUIDED_GROUP_SESSION_NO_SHOW' as const,
              title: 'Guided group session no-show',
              body: `"${session.title}" did not start because the facilitator did not show up.`,
              linkUrl: '/my-library/guided-group-sessions',
            })),
          ];
          await tx.moderationNotice.createMany({ data: notices });
        });

        await spendGroupSessionNoShowPenalty(session.facilitatorId, session.id);
        noShow += 1;
      } catch (error) {
        skipped += 1;
        if (!isDbSchemaMismatch(error)) {
          console.error('Error reconciling guided group session:', error);
        }
      }
    }

    const liveCandidates = await prisma.guidedGroupSession.findMany({
      where: {
        deletedAt: null,
        status: 'LIVE',
        settledAt: null,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
      select: {
        id: true,
        title: true,
        facilitatorId: true,
        scheduledAt: true,
        durationMinutes: true,
        learnerCapacity: true,
      },
    });

    for (const session of liveCandidates) {
      try {
        const endMs = session.scheduledAt.getTime() + session.durationMinutes * 60_000;
        if (nowMs < endMs) continue;

        const enrollments = await prisma.guidedGroupSessionEnrollment.findMany({
          where: { sessionId: session.id, status: 'APPROVED' },
          select: { id: true, userId: true, chargeTransactionId: true },
        });

        const participantCost = calcGroupSessionParticipantCost(session.durationMinutes);
        let chargedCount = 0;

        for (const enrollment of enrollments) {
          if (enrollment.chargeTransactionId) {
            chargedCount += 1;
            continue;
          }
          const result = await spendGroupSessionParticipation(
            enrollment.userId,
            session.id,
            participantCost,
            enrollment.id,
          );
          if (!result.success || !result.transactionId) {
            console.warn(
              'Failed to charge guided-group-session enrollment:',
              enrollment.id,
              result.error ?? '(unknown)',
            );
            continue;
          }
          chargedCount += 1;
          settledEnrollments += 1;
          await prisma.guidedGroupSessionEnrollment.update({
            where: { id: enrollment.id },
            data: { chargedAt: now, chargeTransactionId: result.transactionId },
            select: { id: true },
          });
        }

        const payout = calcGroupSessionFacilitatorPayout(
          session.durationMinutes,
          chargedCount,
          session.learnerCapacity,
        );
        let payoutTxId: string | null = null;
        if (payout > 0) {
          const payoutResult = await grantGroupSessionFacilitation(
            session.facilitatorId,
            session.id,
            payout,
            {
              durationMinutes: session.durationMinutes,
              learnerCapacity: session.learnerCapacity,
              chargedLearners: chargedCount,
            },
          );
          payoutTxId = payoutResult.success ? payoutResult.transactionId ?? null : null;
        }

        await prisma.guidedGroupSession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            endedAt: now,
            settledAt: now,
            facilitatorPayoutTxId: payoutTxId,
          },
          select: { id: true },
        });

        completed += 1;
      } catch (error) {
        if (!isDbSchemaMismatch(error)) {
          console.error('Error settling guided group session:', error);
        }
      }
    }

    return NextResponse.json({
      autoCancelled,
      noShow,
      skipped,
      completed,
      settledEnrollments,
      processed: candidates.length,
    });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error reconciling guided group sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
