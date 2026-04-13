import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isAdmin } from '@/src/lib/permissions';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { z } from 'zod';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

type RemoveTargetType = 'MATERIAL' | 'DISCUSSION' | 'DISCUSSION_REPLY' | 'MATERIAL_COMMENT';

function safeReason(input: unknown): string | null {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return null;
  return text.slice(0, 2000);
}

const removeSchema = z.object({
  targetType: z.enum(['MATERIAL', 'DISCUSSION', 'DISCUSSION_REPLY', 'MATERIAL_COMMENT']),
  targetId: z.string().min(1).max(128),
  reason: z.string().trim().min(1).max(2000),
});

function labelForTarget(targetType: RemoveTargetType): string {
  switch (targetType) {
    case 'MATERIAL':
      return 'material';
    case 'DISCUSSION':
      return 'post';
    case 'DISCUSSION_REPLY':
      return 'reply';
    case 'MATERIAL_COMMENT':
      return 'comment';
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await getCurrentSession();
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (!admin?.role || !isAdmin(admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, adminId);
    const rateLimit = await checkRateLimit(`admin:moderation:remove:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = removeSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const targetType = parsed.data.targetType as RemoveTargetType;
    const targetId = parsed.data.targetId;
    const reason = safeReason(parsed.data.reason);
    if (!reason) {
      return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
    }

    const now = new Date();

    const writeNotice = async (ownerId: string, moderationActionId: string) => {
      const label = labelForTarget(targetType);
      const title = `Your ${label} was removed`;
      const bodyText =
        `Your ${label} content is removed by the moderators. ` +
        `If you think it is unfair contact support.\n\n` +
        `Message from the moderators: ${reason}`;

      await prisma.moderationNotice.create({
        data: {
          userId: ownerId,
          type: 'CONTENT_REMOVED',
          title,
          body: bodyText,
          actionId: moderationActionId,
          linkUrl: '/contact',
        },
        select: { id: true },
      });
    };

    if (targetType === 'MATERIAL') {
    const material = await prisma.material.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true, removedAt: true },
    });
    if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (material.removedAt) {
      return NextResponse.json({ error: 'This item was already removed.' }, { status: 409 });
    }

    const [updated, moderationAction] = await prisma.$transaction([
      prisma.material.update({
        where: { id: targetId },
        data: { removedAt: now, removedById: adminId, removedReason: reason },
        select: { id: true, removedAt: true },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId: material.userId,
          targetType: 'MATERIAL',
          targetId,
          actionType: 'REMOVE_CONTENT',
          reason,
        },
        select: { id: true },
      }),
    ]);

    await writeNotice(material.userId, moderationAction.id);
      return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
    }

    if (targetType === 'MATERIAL_COMMENT') {
    const comment = await prisma.materialComment.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true, removedAt: true },
    });
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (comment.removedAt) {
      return NextResponse.json({ error: 'This item was already removed.' }, { status: 409 });
    }

    const [updated, moderationAction] = await prisma.$transaction([
      prisma.materialComment.update({
        where: { id: targetId },
        data: { removedAt: now, removedById: adminId, removedReason: reason },
        select: { id: true, removedAt: true },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId: comment.userId,
          targetType: 'MATERIAL_COMMENT',
          targetId,
          actionType: 'REMOVE_CONTENT',
          reason,
        },
        select: { id: true },
      }),
    ]);

    await writeNotice(comment.userId, moderationAction.id);
      return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
    }

    if (targetType === 'DISCUSSION') {
    const discussion = await prisma.discussion.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true, removedAt: true },
    });
    if (!discussion) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (discussion.removedAt) {
      return NextResponse.json({ error: 'This item was already removed.' }, { status: 409 });
    }

    const [updated, moderationAction] = await prisma.$transaction([
      prisma.discussion.update({
        where: { id: targetId },
        data: { removedAt: now, removedById: adminId, removedReason: reason },
        select: { id: true, removedAt: true },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: adminId,
          targetUserId: discussion.userId,
          targetType: 'DISCUSSION',
          targetId,
          actionType: 'REMOVE_CONTENT',
          reason,
        },
        select: { id: true },
      }),
    ]);

    await writeNotice(discussion.userId, moderationAction.id);
      return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
    }

  // DISCUSSION_REPLY
  const reply = await prisma.discussionReply.findUnique({
    where: { id: targetId },
    select: { id: true, userId: true, discussionId: true, removedAt: true },
  });
  if (!reply) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (reply.removedAt) {
    return NextResponse.json({ error: 'This item was already removed.' }, { status: 409 });
  }

  const [updated, , moderationAction] = await prisma.$transaction([
    prisma.discussionReply.update({
      where: { id: targetId },
      data: { removedAt: now, removedById: adminId, removedReason: reason },
      select: { id: true, removedAt: true },
    }),
    prisma.discussion.updateMany({
      where: { id: reply.discussionId, acceptedReplyId: targetId },
      data: { acceptedReplyId: null },
    }),
    prisma.moderationAction.create({
      data: {
        actorId: adminId,
        targetUserId: reply.userId,
        targetType: 'DISCUSSION_REPLY',
        targetId,
        actionType: 'REMOVE_CONTENT',
        reason,
      },
      select: { id: true },
    }),
  ]);

    await writeNotice(reply.userId, moderationAction.id);
    return NextResponse.json(updated, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Content removal is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Remove content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
