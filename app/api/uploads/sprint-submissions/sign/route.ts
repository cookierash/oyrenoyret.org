/**
 * Sprint Submission Image Upload (Signed, R2)
 *
 * POST: returns an R2 presigned PUT URL so the client can upload directly.
 *
 * Requires a confirmed enrollment (or staff) and an active sprint window.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

import { MAX_IMAGE_UPLOAD_BYTES, MAX_SPRINT_SUBMISSION_IMAGES_TOTAL } from '@/src/config/uploads';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function isWithinWindow(now: number, start: Date, durationMinutes: number) {
  const startMs = start.getTime();
  const endMs = startMs + durationMinutes * 60_000;
  return now >= startMs && now <= endMs;
}

export async function POST(request: Request) {
  try {
    const { getCurrentSession } = await import('@/src/modules/auth/utils/session');
    const { requireVerifiedEmailForWrite } = await import('@/src/modules/auth/utils/write-access');
    const { RATE_LIMITS } = await import('@/src/config/constants');
    const { getPrivateNoStoreHeaders } = await import('@/src/lib/http-cache');
    const { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } = await import(
      '@/src/security/rateLimiter'
    );
    const { getR2Config } = await import('@/src/services/r2');
    const { isStaff } = await import('@/src/lib/permissions');
    const { prisma } = await import('@/src/db/client');

    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json({ error: message, errorKey: verified.errorKey }, { status: verified.status });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`uploads:sprint-submissions:sign:${identifier}`, RATE_LIMITS.LIVE_EVENT);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let body: { size?: unknown; type?: unknown; liveEventId?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const liveEventId =
      typeof body.liveEventId === 'string' ? body.liveEventId.trim() : String(body.liveEventId ?? '').trim();
    if (!liveEventId) return NextResponse.json({ error: 'liveEventId is required' }, { status: 400 });

    const size = typeof body.size === 'number' ? body.size : Number(body.size);
    const type = typeof body.type === 'string' ? body.type : String(body.type ?? '');

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 });
    }
    if (size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }
    if (!ALLOWED_MIME.has(type)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const staff = Boolean(user?.role && isStaff(user.role));

    const event = await prisma.liveEvent.findFirst({
      where: { id: liveEventId, deletedAt: null },
      select: { id: true, type: true, date: true, durationMinutes: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.type !== 'PROBLEM_SPRINT') {
      return NextResponse.json({ error: 'Uploads are only available for problem sprints.' }, { status: 400 });
    }

    if (!staff) {
      const enrollment = await prisma.liveEventEnrollment.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { status: true },
      });
      if (!enrollment || enrollment.status !== 'CONFIRMED') {
        return NextResponse.json({ error: 'Registration not confirmed' }, { status: 403 });
      }

      if (!isWithinWindow(Date.now(), event.date, event.durationMinutes)) {
        return NextResponse.json({ error: 'Upload window is closed.' }, { status: 409 });
      }
    }

    const r2Cfg = getR2Config();
    if (!r2Cfg) return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });

    // Soft protection against abuse: require a small client-side guard too.
    // This does not enforce totals across sessions; it only advertises a limit for the UI.
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const ext = EXT_BY_MIME[type] ?? 'bin';

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { createR2Client } = await import('@/src/services/r2');

    const prefixBase = String(process.env.R2_SPRINT_SUBMISSIONS_PREFIX ?? 'sprint-submissions').replace(
      /^\/+|\/+$/g,
      ''
    );
    const key = `${prefixBase}/${event.id}/${userId}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
    const publicUrl = `${r2Cfg.publicBaseUrl}/${key}`;
    const proxyUrl = `/api/uploads/sprint-submissions/file?key=${encodeURIComponent(key)}`;

    const client = createR2Client(r2Cfg);
    const cacheControl = 'private, max-age=31536000, immutable';
    const command = new PutObjectCommand({
      Bucket: r2Cfg.bucket,
      Key: key,
      ContentType: type,
      CacheControl: cacheControl,
    });
    const ttlRaw = Number(process.env.R2_PRESIGN_TTL_SECONDS ?? 300);
    const ttl = Number.isFinite(ttlRaw) ? Math.min(900, Math.max(30, Math.floor(ttlRaw))) : 300;
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: ttl });

    const headers = getPrivateNoStoreHeaders();
    return NextResponse.json(
      {
        provider: 'r2',
        method: 'PUT',
        uploadUrl,
        headers: { 'Content-Type': type, 'Cache-Control': cacheControl },
        publicUrl,
        proxyUrl,
        key,
        maxBytes: MAX_IMAGE_UPLOAD_BYTES,
        maxImagesTotal: MAX_SPRINT_SUBMISSION_IMAGES_TOTAL,
      },
      { headers }
    );
  } catch (error) {
    console.error('Error signing sprint submission image upload:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

