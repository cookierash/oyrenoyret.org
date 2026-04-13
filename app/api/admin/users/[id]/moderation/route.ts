import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isAdmin } from '@/src/lib/permissions';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { z } from 'zod';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

type ModerationAction =
  | { action: 'SUSPEND'; duration: '24H' | '1W' | '1M'; reason: string }
  | { action: 'UNSUSPEND'; reason: string }
  | { action: 'BAN'; reason: string }
  | { action: 'UNBAN'; reason: string };

const moderationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('SUSPEND'),
    duration: z.enum(['24H', '1W', '1M']),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal('UNSUSPEND'),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal('BAN'),
    reason: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal('UNBAN'),
    reason: z.string().trim().min(1).max(2000),
  }),
]);

function durationToSeconds(duration: '24H' | '1W' | '1M'): number {
  switch (duration) {
    case '24H':
      return 24 * 60 * 60;
    case '1W':
      return 7 * 24 * 60 * 60;
    case '1M':
      // 30-day month for moderation windows.
      return 30 * 24 * 60 * 60;
  }
}

function safeReason(input: unknown): string | null {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return null;
  return text.slice(0, 2000);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const adminId = await getCurrentSession();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true },
  });
  if (!admin?.role || !isAdmin(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const identifier = getRateLimitIdentifier(request, adminId);
  const rateLimit = await checkRateLimit(`admin:users:moderation:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
  if (!rateLimit.allowed) {
    const { status, body, headers } = buildRateLimitResponse(rateLimit);
    return NextResponse.json(body, { status, headers });
  }

  const { id: targetUserId } = await params;
  if (!targetUserId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  if (targetUserId === adminId) {
    return NextResponse.json({ error: 'You cannot moderate your own account.' }, { status: 400 });
  }

  const raw = (await request.json().catch(() => null)) as unknown;
  const parsed = moderationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const action = parsed.data.action as ModerationAction['action'];
  const reason = safeReason(parsed.data.reason);
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      role: true,
      status: true,
      suspensionUntil: true,
      bannedAt: true,
    },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.role === 'ADMIN') {
    return NextResponse.json({ error: 'Admins cannot be moderated via UI.' }, { status: 403 });
  }

  const now = new Date();

  if (action === 'SUSPEND') {
    const duration = parsed.data.action === 'SUSPEND' ? parsed.data.duration : '24H';
    const seconds = durationToSeconds(duration);
    const until = new Date(now.getTime() + seconds * 1000);

    const [updated, moderationAction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          status: 'SUSPENDED',
          suspensionUntil: until,
          suspensionReason: reason,
          bannedAt: null,
          banReason: null,
        },
        select: {
          id: true,
          status: true,
          suspensionUntil: true,
          suspensionReason: true,
          bannedAt: true,
          banReason: true,
        },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId,
          targetType: 'USER',
          targetId: targetUserId,
          actionType: 'SUSPEND',
          reason,
          durationSeconds: seconds,
          metadata: { duration },
        },
        select: { id: true },
      }),
    ]);

    await prisma.moderationNotice.create({
      data: {
        userId: targetUserId,
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account suspended',
        body: `Your account has been suspended by the moderators.\n\nIf you think it is unfair, contact support.\n\nMessage from the moderators: ${reason}`,
        actionId: moderationAction.id,
        linkUrl: '/contact',
      },
      select: { id: true },
    });

    return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
  }

  if (action === 'UNSUSPEND') {
    const [updated, moderationAction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          status: 'ACTIVE',
          suspensionUntil: null,
          suspensionReason: null,
        },
        select: {
          id: true,
          status: true,
          suspensionUntil: true,
          suspensionReason: true,
          bannedAt: true,
          banReason: true,
        },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId,
          targetType: 'USER',
          targetId: targetUserId,
          actionType: 'UNSUSPEND',
          reason,
        },
        select: { id: true },
      }),
    ]);

    await prisma.moderationNotice.create({
      data: {
        userId: targetUserId,
        type: 'ACCOUNT_UNSUSPENDED',
        title: 'Account unsuspended',
        body: `Your account has been unsuspended by the moderators.\n\nMessage from the moderators: ${reason}`,
        actionId: moderationAction.id,
      },
      select: { id: true },
    });

    return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
  }

  if (action === 'BAN') {
    const [updated, moderationAction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          status: 'BANNED',
          bannedAt: now,
          banReason: reason,
          suspensionUntil: null,
          suspensionReason: null,
        },
        select: {
          id: true,
          status: true,
          suspensionUntil: true,
          suspensionReason: true,
          bannedAt: true,
          banReason: true,
        },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId,
          targetType: 'USER',
          targetId: targetUserId,
          actionType: 'BAN',
          reason,
        },
        select: { id: true },
      }),
    ]);

    await prisma.moderationNotice.create({
      data: {
        userId: targetUserId,
        type: 'ACCOUNT_BANNED',
        title: 'Account banned',
        body: `Your account has been banned by the moderators.\n\nIf you think it is unfair, contact support.\n\nMessage from the moderators: ${reason}`,
        actionId: moderationAction.id,
        linkUrl: '/contact',
      },
      select: { id: true },
    });

    return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
  }

  if (action === 'UNBAN') {
    const [updated, moderationAction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          status: 'ACTIVE',
          bannedAt: null,
          banReason: null,
        },
        select: {
          id: true,
          status: true,
          suspensionUntil: true,
          suspensionReason: true,
          bannedAt: true,
          banReason: true,
        },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId,
          targetType: 'USER',
          targetId: targetUserId,
          actionType: 'UNBAN',
          reason,
        },
        select: { id: true },
      }),
    ]);

    await prisma.moderationNotice.create({
      data: {
        userId: targetUserId,
        type: 'ACCOUNT_UNBANNED',
        title: 'Account unbanned',
        body: `Your account has been unbanned by the moderators.\n\nMessage from the moderators: ${reason}`,
        actionId: moderationAction.id,
      },
      select: { id: true },
    });

    return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Moderation is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Moderation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
