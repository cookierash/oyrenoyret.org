/**
 * Notifications API
 *
 * GET: Combined notifications + credit activity for the current user.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { roundCredits } from '@/src/modules/credits';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function GET(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`notifications:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { notifications } = await getSettingsPreferences();
    const now = new Date();

    const [replyNotifications, transactions, pendingEnrollments, moderationNotices] = await Promise.all([
      notifications.replies
        ? prisma.discussionReply.findMany({
            where: {
              userId: { not: userId },
              OR: [{ discussion: { userId } }, { parentReply: { userId } }],
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              content: true,
              createdAt: true,
              discussionId: true,
              parentReplyId: true,
              discussion: {
                select: {
                  title: true,
                  userId: true,
                },
              },
              parentReply: {
                select: {
                  userId: true,
                },
              },
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      notifications.credits
        ? prisma.creditTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              amount: true,
              balanceAfter: true,
              type: true,
              createdAt: true,
              metadata: true,
            },
          })
        : Promise.resolve([]),
      notifications.sprints
        ? (async () => {
            try {
              return await prisma.liveEventEnrollment.findMany({
                where: {
                  userId,
                  status: { in: ['PENDING', 'CANCELLED'] },
                  liveEvent: {
                    deletedAt: null,
                    type: 'PROBLEM_SPRINT',
                    date: { gte: now },
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                select: {
                  id: true,
                  createdAt: true,
                  status: true,
                  liveEvent: {
                    select: {
                      id: true,
                      topic: true,
                      date: true,
                      creditCost: true,
                      durationMinutes: true,
                    },
                  },
                },
              });
            } catch (error) {
              if (isDbSchemaMismatch(error)) return [];
              throw error;
            }
          })()
        : Promise.resolve([]),
      prisma.moderationNotice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          linkUrl: true,
          createdAt: true,
        },
      }),
    ]);

    const items = [
      ...replyNotifications.map((reply) => {
        const firstName = reply.user.firstName?.trim() ?? '';
        const lastName = reply.user.lastName?.trim() ?? '';
        const authorName = `${firstName} ${lastName}`.trim() || reply.user.email;
        const isReplyToReply = !!reply.parentReplyId;
        return {
          type: 'reply' as const,
          id: reply.id,
          discussionId: reply.discussionId,
          replyId: reply.id,
          createdAt: reply.createdAt.toISOString(),
          authorName,
          discussionTitle: reply.discussion.title,
          contextType: isReplyToReply ? 'reply' : 'discussion',
          contentPreview: reply.content,
        };
      }),
      ...transactions.map((tx) => ({
        type: 'credit' as const,
        id: tx.id,
        amount: roundCredits(tx.amount),
        balanceAfter: roundCredits(tx.balanceAfter),
        createdAt: tx.createdAt.toISOString(),
        label: tx.type,
      })),
      ...pendingEnrollments.map((enrollment) => ({
        type: 'sprint' as const,
        id: enrollment.id,
        liveEventId: enrollment.liveEvent.id,
        topic: enrollment.liveEvent.topic,
        date: enrollment.liveEvent.date.toISOString(),
        creditCost: roundCredits(enrollment.liveEvent.creditCost),
        durationMinutes: enrollment.liveEvent.durationMinutes,
        status: enrollment.status,
        createdAt: enrollment.createdAt.toISOString(),
      })),
      ...moderationNotices.map((notice) => ({
        type: 'moderation' as const,
        id: notice.id,
        noticeType: notice.type,
        title: notice.title,
        body: notice.body,
        linkUrl: notice.linkUrl,
        createdAt: notice.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const headers = getPrivateNoStoreHeaders();
    return NextResponse.json({ items }, { headers });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json({ items: [] }, { headers: getPrivateNoStoreHeaders() });
    }
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
