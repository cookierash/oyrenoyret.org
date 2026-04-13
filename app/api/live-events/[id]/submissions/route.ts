/**
 * Live Event Submissions API
 *
 * POST: Submit a single sprint solution (confirmed participant only)
 * GET:  List sprint submissions (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

function isWithinWindow(now: number, start: Date, durationMinutes: number) {
  const startMs = start.getTime();
  const endMs = startMs + durationMinutes * 60_000;
  return now >= startMs && now <= endMs;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const liveEventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!liveEventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
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

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:submit:${identifier}`,
      RATE_LIMITS.LIVE_EVENT
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const staff = Boolean(user?.role && isStaff(user.role));

    const event = await prisma.liveEvent.findFirst({
      where: { id: liveEventId, deletedAt: null },
      select: { id: true, type: true, date: true, durationMinutes: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.type !== 'PROBLEM_SPRINT') {
      return NextResponse.json(
        { error: 'Submissions are only allowed for problem sprints.' },
        { status: 400 }
      );
    }

    if (!staff) {
      const enrollment = await prisma.liveEventEnrollment.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { status: true },
      });
      if (!enrollment || enrollment.status !== 'CONFIRMED') {
        return NextResponse.json({ error: 'Registration not confirmed' }, { status: 403 });
      }

      const now = Date.now();
      if (!isWithinWindow(now, event.date, event.durationMinutes)) {
        return NextResponse.json(
          { error: 'Submission window is closed.' },
          { status: 409 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const answer = typeof body?.answer === 'string' ? sanitizeInput(body.answer) : '';
    if (!answer || answer.length < 10) {
      return NextResponse.json(
        { error: 'Answer is required (min 10 characters).' },
        { status: 400 }
      );
    }
    if (answer.length > 20_000) {
      return NextResponse.json({ error: 'Answer is too long.' }, { status: 400 });
    }

    const existing = await prisma.liveEventSubmission.findUnique({
      where: { liveEventId_userId: { liveEventId: event.id, userId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'You already submitted.' }, { status: 409 });
    }

    const submission = await prisma.liveEventSubmission.create({
      data: {
        liveEventId: event.id,
        userId,
        answer,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(submission);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Submissions are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error submitting sprint answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const liveEventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!liveEventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      `live-events:submissions:list:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let submissions: any[] = [];
    try {
      submissions = await prisma.liveEventSubmission.findMany({
        where: { liveEventId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          answer: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              publicId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      submissions = await prisma.liveEventSubmission.findMany({
        where: { liveEventId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          answer: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              publicId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }

    return NextResponse.json(submissions);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Submissions are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error listing sprint submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
