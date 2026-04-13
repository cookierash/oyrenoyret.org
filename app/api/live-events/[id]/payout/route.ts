/**
 * Live Event Payout API (Admin only)
 *
 * POST: Payout sprint winners for a problem sprint.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { grantSprintPayout } from '@/src/modules/credits';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

type WinnerInput = {
  rank: 1 | 2 | 3;
  value: string;
};

function normalizeValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveUserId(value: string): Promise<{ id: string; email: string | null } | null> {
  if (!value) return null;
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true },
    });
  }
  return prisma.user.findFirst({
    where: {
      OR: [{ id: value }, { publicId: value }],
    },
    select: { id: true, email: true },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const rateLimit = await checkRateLimit(`live-events:payout:${identifier}`, RATE_LIMITS.ADMIN_WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { id } = await params;
    const liveEvent = await prisma.liveEvent.findUnique({
      where: { id },
      select: { id: true, type: true, creditCost: true },
    });
    if (!liveEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (liveEvent.type !== 'PROBLEM_SPRINT') {
      return NextResponse.json({ error: 'Payouts are only for problem sprints.' }, { status: 400 });
    }

    const body = await request.json();
    const winners: WinnerInput[] = [
      { rank: 1, value: normalizeValue(body?.first) },
      { rank: 2, value: normalizeValue(body?.second) },
      { rank: 3, value: normalizeValue(body?.third) },
    ].filter((w): w is WinnerInput => Boolean(w.value));

    if (winners.length === 0) {
      return NextResponse.json({ error: 'At least one winner is required.' }, { status: 400 });
    }

    const normalizedValues = winners.map((w) => w.value.toLowerCase());
    const uniqueValues = new Set(normalizedValues);
    if (uniqueValues.size !== normalizedValues.length) {
      return NextResponse.json(
        { error: 'Winners must be unique for each rank.' },
        { status: 400 }
      );
    }

    const payouts: Array<{
      rank: 1 | 2 | 3;
      userId: string;
      email: string | null;
    }> = [];

    for (const winner of winners) {
      const resolved = await resolveUserId(winner.value);
      if (!resolved) {
        return NextResponse.json(
          { error: `User not found for rank ${winner.rank}.` },
          { status: 404 }
        );
      }
      const existing = await prisma.creditTransaction.findFirst({
        where: {
          type: 'SPRINT_PAYOUT',
          referenceId: `${liveEvent.id}:rank:${winner.rank}`,
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Rank ${winner.rank} has already been paid out.` },
          { status: 409 }
        );
      }
      payouts.push({ rank: winner.rank, userId: resolved.id, email: resolved.email });
    }

    const results = [];
    for (const payout of payouts) {
      const result = await grantSprintPayout(
        payout.userId,
        liveEvent.creditCost,
        payout.rank,
        liveEvent.id
      );
      if (!result.success) {
        return NextResponse.json(
          { error: result.error ?? 'Failed to grant payout.' },
          { status: 500 }
        );
      }
      results.push({
        rank: payout.rank,
        userId: payout.userId,
        email: payout.email,
        amount: result.amount,
        balanceAfter: result.balanceAfter,
      });
    }

    return NextResponse.json({ payouts: results });
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Sprint payouts are not available. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error granting sprint payout:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
