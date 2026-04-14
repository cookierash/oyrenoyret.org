/**
 * Guided Group Sessions API
 *
 * GET: List upcoming guided group sessions (public) + current user's enrollment status.
 * POST: Create a guided group session (verified facilitator only).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { SESSION_DURATIONS } from '@/src/config/credits';

export const runtime = 'nodejs';

const subjectIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/i);

const topicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/i);

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subjectId: subjectIdSchema,
  topicId: topicIdSchema,
  scheduledAt: z.string().trim().min(10),
  durationMinutes: z.number().int(),
  learnerCapacity: z.number().int(),
  objectives: z.string().trim().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`guided-group-sessions:list:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const takeParam = Number(searchParams.get('take') ?? 100);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 100;

    const userId = await getCurrentSession();
    const now = new Date();
    const nowMs = now.getTime();
    const recentWindowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    let sessions: any[] = [];
    try {
      sessions = await prisma.guidedGroupSession.findMany({
        where: {
          deletedAt: null,
          OR: [
            // Include upcoming sessions + sessions that have started by time but may not be marked LIVE yet.
            { status: 'SCHEDULED', scheduledAt: { gte: recentWindowStart } },
            { status: 'LIVE', scheduledAt: { gte: recentWindowStart } },
          ],
        },
        orderBy: { scheduledAt: 'asc' },
        take,
        select: {
          id: true,
          title: true,
          subjectId: true,
          topicId: true,
          scheduledAt: true,
          durationMinutes: true,
          learnerCapacity: true,
          status: true,
          createdAt: true,
          ratingAvg: true,
          ratingCount: true,
          facilitatorId: true,
          facilitator: {
            select: { firstName: true, lastName: true, email: true, avatarVariant: true },
          },
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      sessions = [];
    }

    sessions = sessions.filter((s) => {
      const startMs = s?.scheduledAt instanceof Date ? s.scheduledAt.getTime() : NaN;
      const durationMinutes = typeof s?.durationMinutes === 'number' ? s.durationMinutes : 0;
      if (!Number.isFinite(startMs)) return false;
      const endMs = startMs + durationMinutes * 60_000;

      if (s.status === 'SCHEDULED') return nowMs < endMs;
      if (s.status === 'LIVE') return nowMs < endMs;
      return false;
    });

    const sessionIds = sessions.map((s) => s.id);
    const [enrollments, approvedCounts] = await Promise.all([
      userId && sessionIds.length
        ? (async () => {
            try {
              return await prisma.guidedGroupSessionEnrollment.findMany({
                where: { userId, sessionId: { in: sessionIds } },
                select: { sessionId: true, status: true },
              });
            } catch (error) {
              if (isDbSchemaMismatch(error)) return [];
              throw error;
            }
          })()
        : Promise.resolve([]),
      sessionIds.length
        ? (async () => {
            try {
              const rows = await prisma.guidedGroupSessionEnrollment.groupBy({
                by: ['sessionId'],
                where: { sessionId: { in: sessionIds }, status: 'APPROVED' },
                _count: { _all: true },
              });
              return rows.reduce<Record<string, number>>((acc, row) => {
                acc[row.sessionId] = row._count._all ?? 0;
                return acc;
              }, {});
            } catch (error) {
              if (isDbSchemaMismatch(error)) return {};
              throw error;
            }
          })()
        : Promise.resolve({} as Record<string, number>),
    ]);

    const statusBySessionId = new Map<string, string>();
    for (const e of enrollments) statusBySessionId.set(e.sessionId, e.status);

    const payload = sessions.map((s) => {
      const facilitatorName =
        [s.facilitator?.firstName, s.facilitator?.lastName].filter(Boolean).join(' ') ||
        (s.facilitator?.email ? s.facilitator.email.split('@')[0] : '');
      const startMs = s?.scheduledAt instanceof Date ? s.scheduledAt.getTime() : NaN;
      const durationMinutes = typeof s?.durationMinutes === 'number' ? s.durationMinutes : 0;
      const endMs = startMs + durationMinutes * 60_000;
      const isOngoing = Number.isFinite(startMs) && nowMs >= startMs && nowMs < endMs;
      return {
        id: s.id,
        title: s.title,
        subjectId: s.subjectId,
        topicId: s.topicId,
        scheduledAt: s.scheduledAt.toISOString(),
        durationMinutes: s.durationMinutes,
        learnerCapacity: s.learnerCapacity,
        status: s.status,
        isOngoing,
        createdAt: s.createdAt ? s.createdAt.toISOString() : null,
        ratingAvg: typeof s.ratingAvg === 'number' ? s.ratingAvg : 0,
        ratingCount: typeof s.ratingCount === 'number' ? s.ratingCount : 0,
        facilitator: {
          id: s.facilitatorId,
          name: facilitatorName,
          avatarVariant: s.facilitator?.avatarVariant ?? null,
        },
        enrollmentStatus: statusBySessionId.get(s.id) ?? null,
        approvedCount: approvedCounts[s.id] ?? 0,
      };
    });

    return NextResponse.json(payload, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error listing guided group sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`guided-group-sessions:create:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const writeAccess = await requireVerifiedEmailForWrite(userId);
    if (!writeAccess.ok) {
      const message = 'error' in writeAccess ? writeAccess.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: writeAccess.errorKey },
        { status: writeAccess.status },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt.' }, { status: 400 });
    }
    if (scheduledAt.getTime() <= Date.now() + 60_000) {
      return NextResponse.json({ error: 'Scheduled time must be in the future.' }, { status: 400 });
    }

    const durationMinutes = parsed.data.durationMinutes;
    const allowedDurations = new Set<number>(SESSION_DURATIONS as unknown as number[]);
    if (!allowedDurations.has(durationMinutes)) {
      return NextResponse.json({ error: 'Invalid duration.' }, { status: 400 });
    }

    const learnerCapacity = parsed.data.learnerCapacity;
    if (![2, 3, 4].includes(learnerCapacity)) {
      return NextResponse.json({ error: 'Invalid learnerCapacity.' }, { status: 400 });
    }

    const subjectId = sanitizeInput(parsed.data.subjectId);
    const topicId = sanitizeInput(parsed.data.topicId);
    const title = sanitizeInput(parsed.data.title);
    const objectives = parsed.data.objectives ? sanitizeInput(parsed.data.objectives) : null;

    const isVerifiedForSubject = await (async () => {
      try {
        const count = await prisma.facilitatorSubjectVerification.count({
          where: { userId, subjectId, revokedAt: null },
        });
        return count > 0;
      } catch (error) {
        if (isDbSchemaMismatch(error)) return false;
        throw error;
      }
    })();

    if (!isVerifiedForSubject) {
      return NextResponse.json(
        { error: 'You are not verified to facilitate this subject.' },
        { status: 403 },
      );
    }

    const session = await (async () => {
      try {
        return await prisma.guidedGroupSession.create({
          data: {
            facilitatorId: userId,
            title,
            subjectId,
            topicId,
            scheduledAt,
            durationMinutes,
            learnerCapacity,
            objectives,
            status: 'SCHEDULED',
          },
          select: { id: true },
        });
      } catch (error) {
        if (isDbSchemaMismatch(error)) return null;
        throw error;
      }
    })();

    if (!session) {
      return NextResponse.json(
        { error: 'Feature is not available yet. Please try again later.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ id: session.id }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error creating guided group session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
