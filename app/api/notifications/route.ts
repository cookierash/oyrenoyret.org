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
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { cookies } from 'next/headers';
import {
  NOTIFY_CREDITS_DISABLED_AT_COOKIE,
  NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE,
  NOTIFY_REPLIES_DISABLED_AT_COOKIE,
  NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE,
  NOTIFY_SPRINTS_DISABLED_AT_COOKIE,
  NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE,
  buildMutedCreatedAtNotFilters,
  buildMutedDateNotFilters,
  parseIsoOrNull,
  parseMutedWindows,
} from '@/src/modules/notifications/mute-windows';

async function getCookieValue(key: string): Promise<string | undefined> {
  const store = cookies();
  const cookieStore =
    typeof (store as { then?: unknown })?.then === 'function' ? await store : store;
  const getCookie =
    typeof (cookieStore as { get?: (key: string) => { value?: string } | undefined }).get ===
    'function'
      ? (cookieStore as { get: (key: string) => { value?: string } | undefined }).get.bind(
          cookieStore,
        )
      : undefined;
  return getCookie?.(key)?.value;
}

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

    // Note: notification toggles are treated as "mute new items" (not "hide all").
    // Past items remain visible; items created during muted windows are excluded.
    const [
      repliesMutedWindowsRaw,
      creditsMutedWindowsRaw,
      sprintsMutedWindowsRaw,
      repliesDisabledAtRaw,
      creditsDisabledAtRaw,
      sprintsDisabledAtRaw,
    ] = await Promise.all([
      getCookieValue(NOTIFY_REPLIES_MUTED_WINDOWS_COOKIE),
      getCookieValue(NOTIFY_CREDITS_MUTED_WINDOWS_COOKIE),
      getCookieValue(NOTIFY_SPRINTS_MUTED_WINDOWS_COOKIE),
      getCookieValue(NOTIFY_REPLIES_DISABLED_AT_COOKIE),
      getCookieValue(NOTIFY_CREDITS_DISABLED_AT_COOKIE),
      getCookieValue(NOTIFY_SPRINTS_DISABLED_AT_COOKIE),
    ]);

    const repliesNotFilters = buildMutedCreatedAtNotFilters(
      parseMutedWindows(repliesMutedWindowsRaw),
      parseIsoOrNull(repliesDisabledAtRaw),
    );
    const creditsNotFilters = buildMutedCreatedAtNotFilters(
      parseMutedWindows(creditsMutedWindowsRaw),
      parseIsoOrNull(creditsDisabledAtRaw),
    );
    const sprintsNotFilters = buildMutedDateNotFilters(
      parseMutedWindows(sprintsMutedWindowsRaw),
      parseIsoOrNull(sprintsDisabledAtRaw),
      'updatedAt',
    );

    const now = new Date();

    const [replyNotifications, transactions, sprintEnrollments, moderationNotices] = await Promise.all([
      prisma.discussionReply.findMany({
        where: {
          ...(repliesNotFilters.length ? { AND: repliesNotFilters } : {}),
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
      }),
      prisma.creditTransaction.findMany({
        where: {
          ...(creditsNotFilters.length ? { AND: creditsNotFilters } : {}),
          userId,
        },
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
      (async () => {
        try {
          return await prisma.liveEventEnrollment.findMany({
            where: {
              ...(sprintsNotFilters.length ? { AND: sprintsNotFilters } : {}),
              userId,
              status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED'] },
              liveEvent: {
                deletedAt: null,
                type: 'PROBLEM_SPRINT',
                date: { gte: now },
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
            select: {
              id: true,
              updatedAt: true,
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
      })(),
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
      ...sprintEnrollments.map((enrollment) => ({
        type: 'sprint' as const,
        id: enrollment.id,
        liveEventId: enrollment.liveEvent.id,
        topic: enrollment.liveEvent.topic,
        date: enrollment.liveEvent.date.toISOString(),
        creditCost: roundCredits(enrollment.liveEvent.creditCost),
        durationMinutes: enrollment.liveEvent.durationMinutes,
        status: enrollment.status,
        createdAt: enrollment.updatedAt.toISOString(),
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
