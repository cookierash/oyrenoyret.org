/**
 * Recent Activities API
 *
 * GET: Combined notifications + credit activity for the current user.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { roundCredits } from '@/src/modules/credits';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`recent-activities:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const [replyNotifications, transactions, pendingEnrollments] = await Promise.all([
      prisma.discussionReply.findMany({
        where: {
          userId: { not: userId },
          OR: [
            { discussion: { userId } },
            { parentReply: { userId } },
          ],
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
      }),
      prisma.creditTransaction.findMany({
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
      }),
      prisma.liveEventEnrollment.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'CANCELLED'] },
          liveEvent: {
            deletedAt: null,
            type: 'PROBLEM_SPRINT',
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
      }),
    ]);

    const items = [
      ...replyNotifications.map((reply) => {
        const authorName =
          [reply.user.firstName, reply.user.lastName].filter(Boolean).join(' ') ||
          reply.user.email.split('@')[0] ||
          'Student';
        const isReplyToUserReply =
          Boolean(reply.parentReplyId) && reply.parentReply?.userId === userId;
        const contextLabel = isReplyToUserReply
          ? 'replied to your reply'
          : 'replied to your discussion';
        const contentPreview = reply.content
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);

        return {
          type: 'reply' as const,
          id: reply.id,
          discussionId: reply.discussionId,
          replyId: reply.id,
          createdAt: reply.createdAt.toISOString(),
          authorName,
          discussionTitle: reply.discussion.title,
          contextLabel,
          contentPreview: contentPreview || '(No content)',
        };
      }),
      ...transactions.map((tx) => ({
        type: 'credit' as const,
        id: tx.id,
        amount: roundCredits(tx.amount),
        balanceAfter: roundCredits(tx.balanceAfter),
        label: tx.type,
        createdAt: tx.createdAt.toISOString(),
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
    ];

    return NextResponse.json({ items }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
