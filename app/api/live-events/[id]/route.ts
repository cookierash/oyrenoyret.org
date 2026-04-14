/**
 * Live Event API
 *
 * GET: Fetch single live event (auth required)
 * PATCH: Update sprint/event fields (staff only)
 * DELETE: Soft delete event (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const eventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!eventId) {
      return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let event:
      | {
          id: string;
          topic: string;
          date: Date;
          durationMinutes: number;
          difficulty: any;
          creditCost: number;
          type: string;
          maxParticipants?: number | null;
          prompt?: string | null;
        }
      | null = null;
    try {
      event = await prisma.liveEvent.findFirst({
        where: { id: eventId, deletedAt: null },
        select: {
          id: true,
          topic: true,
          date: true,
          durationMinutes: true,
          difficulty: true,
          creditCost: true,
          type: true,
          maxParticipants: true,
          prompt: true,
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      try {
        event = (await prisma.liveEvent.findFirst({
          where: { id: eventId },
          select: {
            id: true,
            topic: true,
            date: true,
            durationMinutes: true,
            difficulty: true,
            creditCost: true,
            type: true,
          },
        })) as any;
        if (event) {
          (event as any).maxParticipants = null;
          (event as any).prompt = null;
        }
      } catch {
        event = null;
      }
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let enrollment: { status: string } | null = null;
    let mySubmission: { id: string; createdAt: Date } | null = null;
    try {
      [enrollment, mySubmission] = await Promise.all([
        prisma.liveEventEnrollment.findUnique({
          where: { liveEventId_userId: { liveEventId: event.id, userId } },
          select: { status: true },
        }),
        prisma.liveEventSubmission.findUnique({
          where: { liveEventId_userId: { liveEventId: event.id, userId } },
          select: { id: true, createdAt: true },
        }),
      ]);
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      enrollment = null;
      mySubmission = null;
    }

    let confirmedCount = 0;
    try {
      confirmedCount = await prisma.liveEventEnrollment.count({
        where: { liveEventId: event.id, status: 'CONFIRMED' },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      confirmedCount = 0;
    }

    return NextResponse.json({
      ...event,
      enrollmentStatus: enrollment?.status ?? null,
      confirmedCount,
      hasSubmitted: Boolean(mySubmission),
      submittedAt: mySubmission?.createdAt ?? null,
    });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Live events are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error fetching live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const eventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!eventId) {
      return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
    }

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:update:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json().catch(() => ({}));
    const maxParticipantsRaw = body?.maxParticipants;
    const maxParticipants =
      maxParticipantsRaw === null || maxParticipantsRaw === undefined || maxParticipantsRaw === ''
        ? null
        : Number(maxParticipantsRaw);

    if (maxParticipants !== null) {
      if (!Number.isFinite(maxParticipants) || !Number.isInteger(maxParticipants)) {
        return NextResponse.json(
          { error: 'maxParticipants must be a whole number' },
          { status: 400 }
        );
      }
      if (maxParticipants <= 0 || maxParticipants > 500) {
        return NextResponse.json(
          { error: 'maxParticipants must be between 1 and 500' },
          { status: 400 }
        );
      }
    }

    const prompt =
      typeof body?.prompt === 'string'
        ? sanitizeInput(body.prompt).slice(0, 20_000)
        : body?.prompt === null
          ? null
          : undefined;

    const topic =
      typeof body?.topic === 'string'
        ? sanitizeInput(body.topic).slice(0, 200)
        : undefined;

    if (topic !== undefined && !topic.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    let updated:
      | {
          id: string;
          topic?: string;
          maxParticipants?: number | null;
          prompt?: string | null;
          updatedAt: Date;
        }
      | null = null;
    try {
      updated = await prisma.liveEvent.update({
        where: { id: eventId },
        data: {
          ...(topic !== undefined ? { topic: topic.trim() } : {}),
          ...(maxParticipants !== undefined ? { maxParticipants } : {}),
          ...(prompt !== undefined ? { prompt } : {}),
        },
        select: {
          id: true,
          topic: true,
          maxParticipants: true,
          prompt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      return NextResponse.json(
        { error: 'This event cannot be edited yet. Apply database migrations first.' },
        { status: 503 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramIdRaw } = await params;
    const body = await request.json().catch(() => ({} as { id?: string; eventId?: string }));
    const paramId = typeof paramIdRaw === 'string' ? paramIdRaw.trim() : '';
    const bodyId =
      typeof body?.id === 'string'
        ? body.id.trim()
        : typeof body?.eventId === 'string'
          ? body.eventId.trim()
          : '';
    const eventId = paramId || bodyId;

    if (!eventId) {
      return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
    }

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:delete:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const existing = await prisma.liveEvent.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    try {
      await prisma.liveEvent.update({
        where: { id: eventId },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      // Safe rollout fallback: legacy schema may not have `deletedAt`.
      await prisma.liveEvent.delete({ where: { id: eventId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Live events are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error deleting live event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
