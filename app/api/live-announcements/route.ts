/**
 * Live Announcements API
 *
 * GET: List announcements
 * POST: Create announcement (staff only)
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
    const takeParam = Number(searchParams.get('take') ?? 20);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 20;

    const announcements = await prisma.liveAnnouncement.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });

    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      `live-announcements:create:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? sanitizeInput(body.title) : '';
    const text = typeof body.body === 'string' ? sanitizeInput(body.body) : '';

    if (!title || !text) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const announcement = await prisma.liveAnnouncement.create({
      data: {
        title,
        body: text,
        createdById: userId,
      },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });

    return NextResponse.json(announcement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
