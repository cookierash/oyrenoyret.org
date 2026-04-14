/**
 * Live Events API
 *
 * GET: List live events with current user's enrollment status
 * POST: Create live event (staff only)
 */

import { NextResponse } from 'next/server';
import type { LiveEventType } from '@prisma/client';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

  export async function GET(request: Request) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`live-events:list:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const takeParam = Number(searchParams.get('take') ?? 100);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 100;
    const typeParam = searchParams.get('type');
    const includePastParam = searchParams.get('includePast');
    const includePastRequested =
      includePastParam === '1' || includePastParam === 'true' || includePastParam === 'yes';
    const isLiveEventType = (value: string | null): value is LiveEventType =>
      value === 'PROBLEM_SPRINT' || value === 'EVENT';
    const type = isLiveEventType(typeParam) ? typeParam : null;

    const userId = await getCurrentSession();
    const now = new Date();

    let includePast = false;
    if (includePastRequested && userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        includePast = Boolean(user?.role && isStaff(user.role));
      } catch {
        includePast = false;
      }
    }

    let events: Array<{
      id: string;
      topic: string;
      date: Date;
      durationMinutes: number;
      difficulty: any;
      creditCost: number;
      type: string;
    }> = [];
    try {
      events = await prisma.liveEvent.findMany({
        where: {
          deletedAt: null,
          ...(type ? { type } : {}),
          ...(includePast ? {} : { date: { gte: now } }),
        },
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
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      try {
        events = await prisma.liveEvent.findMany({
          where: {
            ...(type ? { type } : {}),
            ...(includePast ? {} : { date: { gte: now } }),
          },
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
      } catch {
        events = [];
      }
    }

    const eventIds = events.map((event) => event.id);
    let enrollments: Array<{ liveEventId: string; status: string }> = [];
    if (userId && eventIds.length) {
      try {
        enrollments = await prisma.liveEventEnrollment.findMany({
          where: { userId, liveEventId: { in: eventIds } },
          select: { liveEventId: true, status: true },
        });
      } catch (error) {
        if (!isDbSchemaMismatch(error)) throw error;
        enrollments = [];
      }
    }

    const enrollmentMap = new Map(enrollments.map((item) => [item.liveEventId, item.status]));

    const payoutReferenceIds: string[] = [];
    for (const event of events) {
      if (event.type !== 'PROBLEM_SPRINT') continue;
      payoutReferenceIds.push(`${event.id}:rank:1`, `${event.id}:rank:2`, `${event.id}:rank:3`);
    }

    const paidOutSprintIds = new Set<string>();
    if (payoutReferenceIds.length) {
      try {
        const payouts = await prisma.creditTransaction.findMany({
          where: {
            type: 'SPRINT_PAYOUT',
            referenceId: { in: payoutReferenceIds },
          },
          select: { referenceId: true },
        });
        for (const payout of payouts) {
          if (!payout.referenceId) continue;
          const sprintId = payout.referenceId.split(':rank:')[0];
          if (sprintId) paidOutSprintIds.add(sprintId);
        }
      } catch (error) {
        if (!isDbSchemaMismatch(error)) throw error;
      }
    }

    const result = events.map((event) => ({
      ...event,
      enrollmentStatus: enrollmentMap.get(event.id) ?? null,
      hasPayout: event.type === 'PROBLEM_SPRINT' ? paidOutSprintIds.has(event.id) : null,
    }));

    return NextResponse.json(result, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json([], { headers: getPrivateNoStoreHeaders() });
    }
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
      `live-events:create:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json();
    const { sanitizeInput } = await import('@/src/security/validation');
    const topic = typeof body.topic === 'string' ? sanitizeInput(body.topic) : '';
    const date = body.date ? new Date(body.date) : null;
    const durationMinutes = Number(body.durationMinutes);
    const creditCost = Number(body.creditCost);
    const isLiveEventType = (value: string | null): value is LiveEventType =>
      value === 'PROBLEM_SPRINT' || value === 'EVENT';
    const type = isLiveEventType(body?.type ?? null) ? body.type : 'PROBLEM_SPRINT';
    const allowedDifficulties = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];
    const difficulty =
      typeof body.difficulty === 'string' && allowedDifficulties.includes(body.difficulty)
        ? body.difficulty
        : null;
    const maxParticipantsRaw = body?.maxParticipants;
    const maxParticipants =
      maxParticipantsRaw === null || maxParticipantsRaw === undefined || maxParticipantsRaw === ''
        ? null
        : Number(maxParticipantsRaw);
    const prompt = typeof body?.prompt === 'string' ? sanitizeInput(body.prompt).slice(0, 20_000) : null;
    const problemsRaw =
      type === 'PROBLEM_SPRINT' && Array.isArray(body?.problems) ? (body.problems as any[]) : null;

    const normalizeProblemType = (value: unknown): 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | null => {
      const raw = typeof value === 'string' ? value.trim() : '';
      if (raw === 'MULTIPLE_CHOICE' || raw === 'SHORT_ANSWER') return raw;
      return null;
    };

    const normalizedProblems =
      problemsRaw?.map((p, idx) => {
        const problemType = normalizeProblemType(p?.type) ?? 'SHORT_ANSWER';
        const problemPrompt =
          typeof p?.prompt === 'string' ? sanitizeInput(p.prompt).slice(0, 20_000) : '';
        const optionsRaw = Array.isArray(p?.options) ? (p.options as any[]) : [];
        const options =
          problemType === 'MULTIPLE_CHOICE'
            ? optionsRaw
                .map((o, j) => ({
                  order: j + 1,
                  text: typeof o?.text === 'string' ? sanitizeInput(o.text).slice(0, 2_000) : '',
                  isCorrect: Boolean(o?.isCorrect),
                }))
                .filter((o) => o.text.trim().length > 0)
            : [];

        return {
          order: idx + 1,
          type: problemType,
          prompt: problemPrompt,
          options,
        };
      }) ?? null;

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

    if (type === 'PROBLEM_SPRINT' && normalizedProblems) {
      if (normalizedProblems.length === 0) {
        return NextResponse.json({ error: 'At least one problem is required.' }, { status: 400 });
      }
      if (normalizedProblems.length > 30) {
        return NextResponse.json({ error: 'Too many problems (max 30).' }, { status: 400 });
      }
      for (const p of normalizedProblems) {
        if (!p.prompt.trim()) {
          return NextResponse.json({ error: 'Each problem must have a prompt.' }, { status: 400 });
        }
        if (p.type === 'MULTIPLE_CHOICE') {
          if (p.options.length < 2) {
            return NextResponse.json(
              { error: 'Multiple choice problems need at least 2 options.' },
              { status: 400 }
            );
          }
          if (p.options.length > 10) {
            return NextResponse.json(
              { error: 'Multiple choice problems support up to 10 options.' },
              { status: 400 }
            );
          }
          const correctCount = p.options.filter((o) => o.isCorrect).length;
          if (correctCount !== 1) {
            return NextResponse.json(
              { error: 'Multiple choice problems must have exactly 1 correct option.' },
              { status: 400 }
            );
          }
        }
      }
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
        }
      | null = null;
    try {
      if (type === 'PROBLEM_SPRINT' && normalizedProblems) {
        event = await prisma.$transaction(async (tx) => {
          const created = await tx.liveEvent.create({
            data: {
              topic,
              date,
              durationMinutes,
              difficulty,
              creditCost,
              type,
              maxParticipants,
              prompt: prompt,
              createdById: userId,
              problems: {
                create: normalizedProblems.map((p) => ({
                  order: p.order,
                  type: p.type as any,
                  prompt: p.prompt,
                  options: p.type === 'MULTIPLE_CHOICE'
                    ? {
                        create: p.options.map((o) => ({
                          order: o.order,
                          text: o.text,
                          isCorrect: o.isCorrect,
                        })),
                      }
                    : undefined,
                })),
              },
            },
            select: {
              id: true,
              topic: true,
              date: true,
              durationMinutes: true,
              difficulty: true,
              creditCost: true,
              type: true,
              maxParticipants: true,
            },
          });
          return created;
        });
      } else {
        event = await prisma.liveEvent.create({
          data: {
            topic,
            date,
            durationMinutes,
            difficulty,
            creditCost,
            type,
            maxParticipants,
            prompt: type === 'PROBLEM_SPRINT' ? prompt : null,
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
            maxParticipants: true,
          },
        });
      }
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      // Safe rollout fallback: legacy schema may not have `maxParticipants` / `prompt` / `deletedAt`.
      event = await prisma.liveEvent.create({
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
    }

    return NextResponse.json(event);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Live events are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error creating live event:', error);
    const message =
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
