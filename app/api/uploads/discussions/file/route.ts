/**
 * Discussion Image Proxy
 *
 * Streams an image from R2 through the app server.
 * Works in localhost and avoids relying on bucket public access settings.
 *
 * GET /api/uploads/discussions/file?key=<r2-key>
 */

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`uploads:discussions:file:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const keyRaw = String(searchParams.get('key') ?? '').trim();
    if (!keyRaw) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    if (keyRaw.includes('..')) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

    const prefixBase = String(process.env.R2_DISCUSSIONS_PREFIX ?? 'discussions').replace(/^\/+|\/+$/g, '');
    if (!keyRaw.startsWith(`${prefixBase}/`)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const { getR2Config, createR2Client } = await import('@/src/services/r2');
    const cfg = getR2Config();
    if (!cfg) return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = createR2Client(cfg);
    const data = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: keyRaw }));

    const contentType = String(data.ContentType ?? 'application/octet-stream');
    const cacheControl = String(data.CacheControl ?? 'private, max-age=31536000, immutable');

    const body = data.Body as unknown;
    const stream =
      body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === 'function'
        ? (body as { transformToWebStream: () => ReadableStream }).transformToWebStream()
        : body && typeof body === 'object' && typeof (body as any).pipe === 'function'
          ? (await import('node:stream')).Readable.toWeb(body as any)
          : null;

    if (!stream) return NextResponse.json({ error: 'Unable to read file' }, { status: 500 });

    return new Response(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } catch (error: any) {
    const status = typeof error?.$metadata?.httpStatusCode === 'number' ? error.$metadata.httpStatusCode : 500;
    if (status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('Error proxying discussion image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

