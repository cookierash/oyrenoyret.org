/**
 * Live Events API
 *
 * GET: List live events with current user's enrollment status
 * POST: Create live event (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const takeParam = Number(searchParams.get('take') ?? 100);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 100;
    const typeParam = searchParams.get('type');
    const allowedTypes = ['PROBLEM_SPRINT', 'EVENT'];
    const type = typeParam && allowedTypes.includes(typeParam) ? typeParam : null;

    const events = await prisma.liveEvent.findMany({
      where: { deletedAt: null, ...(type ? { type } : {}) },
      orderBy: { date: 'asc' },
      take,
      select: {
        id: true,
        topic: true,
        date: true,
        durationMinutes: true,
        difficulty: true,
        creditCost: true,
        type: true,
      },
    });

    const userId = await getCurrentSession();
    const eventIds = events.map((event) => event.id);
    const enrollments = userId && eventIds.length
      ? await prisma.liveEventEnrollment.findMany({
        where: { userId, liveEventId: { in: eventIds } },
        select: { liveEventId: true, status: true },
      })
      : [];

    const enrollmentMap = new Map(enrollments.map((item) => [item.liveEventId, item.status]));

    const result = events.map((event) => ({
      ...event,
      enrollmentStatus: enrollmentMap.get(event.id) ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching live events:', error);
    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
      `live-events:create:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json();
    const topic = typeof body.topic === 'string' ? sanitizeInput(body.topic) : '';
    const date = body.date ? new Date(body.date) : null;
    const durationMinutes = Number(body.durationMinutes);
    const creditCost = Number(body.creditCost);
    const allowedTypes = ['PROBLEM_SPRINT', 'EVENT'];
    const type =
      typeof body.type === 'string' && allowedTypes.includes(body.type)
        ? body.type
        : 'PROBLEM_SPRINT';
    const allowedDifficulties = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];
    const difficulty =
      typeof body.difficulty === 'string' && allowedDifficulties.includes(body.difficulty)
        ? body.difficulty
        : null;

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }
    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    if (date.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Date must be in the future' }, { status: 400 });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }
    if (!Number.isInteger(durationMinutes)) {
      return NextResponse.json(
        { error: 'Duration must be a whole number of minutes' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(creditCost) || creditCost < 0 || !Number.isInteger(creditCost)) {
      return NextResponse.json({ error: 'Invalid credit cost' }, { status: 400 });
    }

    const event = await prisma.liveEvent.create({
      data: {
        topic,
        date,
        durationMinutes,
        difficulty,
        creditCost,
        type,
        createdById: userId,
      },
      select: {
        id: true,
        topic: true,
        date: true,
        durationMinutes: true,
        difficulty: true,
        creditCost: true,
        type: true,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error creating live event:', error);
    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
