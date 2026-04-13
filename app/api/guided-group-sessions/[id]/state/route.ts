/**
 * Guided Group Session State API
 *
 * GET: Fetch live session state (active material + whiteboard).
 * PATCH: Update state (append whiteboard strokes; facilitator can set active material).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export const runtime = 'nodejs';

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const strokeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(32),
  width: z.number().min(1).max(16),
  points: z.array(pointSchema).min(2).max(800),
  createdAt: z.number().int().optional(),
  createdBy: z.string().trim().min(1).max(80).optional(),
});

const patchSchema = z.object({
  activeMaterialId: z.string().trim().max(64).optional().nullable(),
  appendStrokes: z.array(strokeSchema).max(10).optional(),
  clearWhiteboard: z.boolean().optional(),
});

function normalizeWhiteboardData(raw: unknown): { version: number; strokes: any[] } {
  if (!raw || typeof raw !== 'object') return { version: 1, strokes: [] };
  const obj = raw as { version?: unknown; strokes?: unknown };
  const version = typeof obj.version === 'number' ? obj.version : 1;
  const strokes = Array.isArray(obj.strokes) ? obj.strokes : [];
  return { version, strokes };
}

function mergeStrokes(existing: any[], append: any[]): any[] {
  const map = new Map<string, any>();
  for (const stroke of existing) {
    if (stroke && typeof stroke.id === 'string') map.set(stroke.id, stroke);
  }
  for (const stroke of append) {
    if (stroke && typeof stroke.id === 'string' && !map.has(stroke.id)) {
      map.set(stroke.id, stroke);
    }
  }
  return Array.from(map.values());
}

async function assertSessionAccess(sessionId: string, userId: string) {
  const session = await prisma.guidedGroupSession.findFirst({
    where: { id: sessionId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      facilitatorId: true,
      activeMaterialId: true,
      whiteboardData: true,
    },
  });
  if (!session) return { ok: false as const, error: 'Session not found.', status: 404 as const };

  if (session.facilitatorId === userId) {
    return { ok: true as const, session, role: 'FACILITATOR' as const };
  }

  const enrollment = await prisma.guidedGroupSessionEnrollment.findFirst({
    where: { sessionId: session.id, userId, status: 'APPROVED' },
    select: { id: true },
  });
  if (!enrollment) return { ok: false as const, error: 'Forbidden', status: 403 as const };

  return { ok: true as const, session, role: 'LEARNER' as const };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionIdRaw } = await params;
    const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'Session id is required.' }, { status: 400 });
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `guided-group-sessions:state:read:${identifier}`,
      RATE_LIMITS.GENERAL,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const access = await assertSessionAccess(sessionId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const session = access.session;
    const activeMaterialId = session.activeMaterialId ?? null;
    const whiteboardData = session.whiteboardData ?? null;

    const activeMaterial = activeMaterialId
      ? await prisma.material.findFirst({
          where: { id: activeMaterialId, userId: session.facilitatorId, deletedAt: null },
          select: {
            id: true,
            title: true,
            objectives: true,
            content: true,
            materialType: true,
            subjectId: true,
            topicId: true,
            difficulty: true,
          },
        })
      : null;

    return NextResponse.json(
      {
        ok: true,
        role: access.role,
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
          activeMaterialId,
          whiteboardData,
        },
        activeMaterial,
      },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error fetching guided group session state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionIdRaw } = await params;
    const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'Session id is required.' }, { status: 400 });
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
        { status: verified.status },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `guided-group-sessions:state:write:${identifier}`,
      RATE_LIMITS.WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const access = await assertSessionAccess(sessionId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const session = access.session;
    const wantsMaterialChange = Object.prototype.hasOwnProperty.call(parsed.data, 'activeMaterialId');
    if (wantsMaterialChange && access.role !== 'FACILITATOR') {
      return NextResponse.json({ error: 'Only the facilitator can change materials.' }, { status: 403 });
    }

    const canWriteWhiteboard =
      session.status === 'LIVE' || (access.role === 'FACILITATOR' && session.status === 'COMPLETED');
    if ((parsed.data.appendStrokes || parsed.data.clearWhiteboard) && !canWriteWhiteboard) {
      return NextResponse.json({ error: 'Whiteboard is read-only right now.' }, { status: 409 });
    }

    const activeMaterialId =
      wantsMaterialChange ? (parsed.data.activeMaterialId ? parsed.data.activeMaterialId.trim() : null) : undefined;
    const appendStrokes = parsed.data.appendStrokes ?? [];

    const existing = normalizeWhiteboardData(session.whiteboardData);
    const nextStrokes = parsed.data.clearWhiteboard ? [] : mergeStrokes(existing.strokes, appendStrokes);
    const nextWhiteboardData =
      parsed.data.clearWhiteboard || appendStrokes.length > 0
        ? { version: existing.version ?? 1, strokes: nextStrokes }
        : session.whiteboardData;

    const updated = await prisma.guidedGroupSession.update({
      where: { id: session.id },
      data: {
        ...(activeMaterialId !== undefined ? { activeMaterialId } : {}),
        ...(nextWhiteboardData !== session.whiteboardData ? { whiteboardData: nextWhiteboardData as any } : {}),
      },
      select: { id: true, activeMaterialId: true, whiteboardData: true },
    });

    return NextResponse.json(
      { ok: true, activeMaterialId: updated.activeMaterialId ?? null, whiteboardData: updated.whiteboardData ?? null },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'This feature is temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error updating guided group session state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
