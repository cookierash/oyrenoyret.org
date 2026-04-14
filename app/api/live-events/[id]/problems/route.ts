/**
 * Live Event Problems API
 *
 * GET: List problems for a live event (auth required; locked until start for non-staff)
 * PUT: Replace all problems for an event (staff only)
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

type ProblemType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';

type ProblemPayload = {
  type?: unknown;
  prompt?: unknown;
  options?: unknown;
};

function normalizeProblemType(value: unknown): ProblemType | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === 'MULTIPLE_CHOICE' || raw === 'SHORT_ANSWER') return raw;
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: rawId } = await params;
    const liveEventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!liveEventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const staff = Boolean(user?.role && isStaff(user.role));

    const event = await prisma.liveEvent.findFirst({
      where: { id: liveEventId, deletedAt: null },
      select: { id: true, type: true, date: true, durationMinutes: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.type !== 'PROBLEM_SPRINT') {
      return NextResponse.json({ error: 'Problems are only available for problem sprints.' }, { status: 400 });
    }

    if (!staff) {
      const enrollment = await prisma.liveEventEnrollment.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { status: true },
      });
      if (!enrollment || enrollment.status !== 'CONFIRMED') {
        return NextResponse.json({ error: 'Registration not confirmed' }, { status: 403 });
      }

      // Lock problems until the sprint starts (consistent with the prompt lock).
      if (!isWithinWindow(Date.now(), event.date, event.durationMinutes) && Date.now() < event.date.getTime()) {
        return NextResponse.json({ locked: true, problems: [] }, { status: 200 });
      }
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`live-events:problems:get:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let problems: any[] = [];
    try {
      problems = await prisma.liveEventProblem.findMany({
        where: { liveEventId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          type: true,
          prompt: true,
          options: {
            orderBy: { order: 'asc' },
            select: { id: true, order: true, text: true, ...(staff ? { isCorrect: true } : {}) },
          },
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      return NextResponse.json(
        { error: 'Problems are not available yet. Apply database migrations first.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ locked: false, problems });
  } catch (error) {
    console.error('Error listing live event problems:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json({ error: message, errorKey: verified.errorKey }, { status: verified.status });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !isStaff(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: rawId } = await params;
    const liveEventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!liveEventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`live-events:problems:put:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const event = await prisma.liveEvent.findFirst({
      where: { id: liveEventId, deletedAt: null },
      select: { id: true, type: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.type !== 'PROBLEM_SPRINT') {
      return NextResponse.json({ error: 'Only problem sprints can have problems.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const rawProblems = Array.isArray(body?.problems) ? (body.problems as ProblemPayload[]) : null;
    if (!rawProblems) return NextResponse.json({ error: 'problems[] is required' }, { status: 400 });
    if (rawProblems.length > 30) return NextResponse.json({ error: 'Too many problems (max 30).' }, { status: 400 });

    const normalized = rawProblems.map((p, idx) => {
      const type = normalizeProblemType(p?.type);
      const prompt = typeof p?.prompt === 'string' ? sanitizeInput(p.prompt).slice(0, 20_000) : '';
      const optionsRaw = Array.isArray(p?.options) ? (p.options as any[]) : [];
      const options =
        type === 'MULTIPLE_CHOICE'
          ? optionsRaw
              .map((o, j) => ({
                order: j + 1,
                text: typeof o?.text === 'string' ? sanitizeInput(o.text).slice(0, 2_000) : '',
                isCorrect: Boolean(o?.isCorrect),
              }))
              .filter((o) => o.text.trim().length > 0)
          : [];

      return { order: idx + 1, type, prompt, options };
    });

    if (normalized.some((p) => !p.type)) {
      return NextResponse.json({ error: 'Invalid problem type.' }, { status: 400 });
    }
    if (normalized.some((p) => !p.prompt.trim())) {
      return NextResponse.json({ error: 'Each problem must have a prompt.' }, { status: 400 });
    }
    for (const p of normalized) {
      if (p.type === 'MULTIPLE_CHOICE' && p.options.length < 2) {
        return NextResponse.json(
          { error: 'Multiple choice problems need at least 2 options.' },
          { status: 400 }
        );
      }
      if (p.type === 'MULTIPLE_CHOICE' && p.options.length > 10) {
        return NextResponse.json(
          { error: 'Multiple choice problems support up to 10 options.' },
          { status: 400 }
        );
      }
      if (p.type === 'MULTIPLE_CHOICE') {
        const correctCount = p.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          return NextResponse.json(
            { error: 'Multiple choice problems must have exactly 1 correct option.' },
            { status: 400 }
          );
        }
      }
    }

    let saved: any[] = [];
    try {
      saved = await prisma.$transaction(async (tx) => {
        await tx.liveEventProblem.deleteMany({ where: { liveEventId } });
        const created: any[] = [];
        for (const problem of normalized) {
          const row = await tx.liveEventProblem.create({
            data: {
              liveEventId,
              order: problem.order,
              type: problem.type as any,
              prompt: problem.prompt,
              options: problem.options.length
                ? {
                    create: problem.options.map((o) => ({
                      order: o.order,
                      text: o.text,
                      isCorrect: o.isCorrect,
                    })),
                  }
                : undefined,
            },
            select: {
              id: true,
              order: true,
              type: true,
              prompt: true,
              options: {
                orderBy: { order: 'asc' },
                select: { id: true, order: true, text: true, isCorrect: true },
              },
            },
          });
          created.push(row);
        }
        return created;
      });
    } catch (error) {
      if (isDbSchemaMismatch(error)) {
        return NextResponse.json(
          { error: 'Problems cannot be saved yet. Apply database migrations first.' },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({ problems: saved });
  } catch (error) {
    console.error('Error saving live event problems:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
