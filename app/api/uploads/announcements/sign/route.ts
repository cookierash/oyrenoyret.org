/**
 * Announcement Banner Upload (Signed)
 *
 * POST: returns signed upload params so the client can upload directly.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

import { prisma } from '@/src/db/client';
import { MAX_IMAGE_UPLOAD_BYTES } from '@/src/config/uploads';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { isStaff } from '@/src/lib/permissions';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(request: Request) {
  try {
    const { getR2Config } = await import('@/src/services/r2');

    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json({ error: message, errorKey: verified.errorKey }, { status: verified.status });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`uploads:announcements:sign:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let body: { size?: unknown; type?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

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

    const r2Cfg = getR2Config();
    if (!r2Cfg) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
    }

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { createR2Client } = await import('@/src/services/r2');

    const ext = EXT_BY_MIME[type] ?? 'bin';
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');

    const prefixBase = String(process.env.R2_ANNOUNCEMENTS_PREFIX ?? 'announcements').replace(/^\/+|\/+$/g, '');
    const key = `${prefixBase}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
    const proxyUrl = `/api/uploads/announcements/file?key=${encodeURIComponent(key)}`;
    // Prefer serving from the configured public base URL (ideally a custom domain like `https://cdn.oyrenoyret.org`).
    // Proxy URL is included as a fallback.
    const publicUrl = `${r2Cfg.publicBaseUrl}/${key}`;

    const client = createR2Client(r2Cfg);
    const cacheControl = 'public, max-age=31536000, immutable';
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
      },
      { headers },
    );
  } catch (error) {
    console.error('Error signing announcement banner upload:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
