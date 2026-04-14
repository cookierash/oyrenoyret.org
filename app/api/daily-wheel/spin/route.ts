/**
 * Daily Wheel Spin API
 *
 * POST: Spin once per day (per user). Awards credits based on weighted selection.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { toDayNumber } from '@/src/lib/streak';
import { pickDailyWheelReward } from '@/src/lib/daily-wheel';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  const headers = getPrivateNoStoreHeaders();

  try {
    // If Prisma Client wasn't regenerated/reloaded after adding the model, the delegate can be missing.
    const dailyWheelDelegate = (prisma as unknown as { dailyWheelSpin?: unknown }).dailyWheelSpin;
    if (!dailyWheelDelegate) {
      return NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          errorKey: 'prismaClientOutdated',
          hint:
            process.env.NODE_ENV === 'production'
              ? undefined
              : 'Prisma Client is missing DailyWheelSpin. Run `npm run db:generate` and restart the dev server.',
        },
        { status: 503, headers },
      );
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`dailyWheel:spin:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers: rlHeaders } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers: { ...headers, ...rlHeaders } });
    }

    const writeAccess = await requireVerifiedEmailForWrite(userId);
    if (!writeAccess.ok) {
      const errorMessage = 'error' in writeAccess ? writeAccess.error : 'Unauthorized';
      return NextResponse.json(
        { error: errorMessage, errorKey: writeAccess.errorKey },
        { status: writeAccess.status, headers },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    }
    if (user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    }

    const now = new Date();
    const dayNumber = toDayNumber(now);

    const existing = await prisma.dailyWheelSpin.findUnique({
      where: { userId_dayNumber: { userId, dayNumber } },
      select: { reward: true, spunAt: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          alreadySpun: true,
          dayNumber,
          reward: existing.reward,
          spunAt: existing.spunAt.toISOString(),
        },
        { headers },
      );
    }

    const reward = pickDailyWheelReward();

    let result: { spin: { reward: number; spunAt: Date }; balanceAfter: number };
    try {
      result = await prisma.$transaction(async (tx) => {
        const spin = await tx.dailyWheelSpin.create({
          data: { userId, dayNumber, reward },
          select: { id: true, reward: true, spunAt: true },
        });

        const updated = await tx.user.update({
          where: { id: userId },
          data: { credits: { increment: reward } },
          select: { credits: true },
        });

        const referenceId = `${userId}:${dayNumber}`;
        const metadata = { dayNumber, reward, dailyWheelSpinId: spin.id } as object;
        const creditTx = await (async () => {
          try {
            return await tx.creditTransaction.create({
              data: {
                userId,
                amount: reward,
                balanceAfter: updated.credits,
                type: 'DAILY_WHEEL',
                referenceId,
                metadata,
              },
              select: { id: true },
            });
          } catch (e) {
            // If the DB hasn't had the enum value migrated yet, still log it under SPECIAL_EVENT
            // so the wheel remains functional while migrations catch up.
            if (!isDbSchemaMismatch(e)) throw e;
            return await tx.creditTransaction.create({
              data: {
                userId,
                amount: reward,
                balanceAfter: updated.credits,
                type: 'SPECIAL_EVENT',
                referenceId: `dailyWheel:${referenceId}`,
                metadata: { ...((metadata as unknown as Record<string, unknown>) ?? {}), kind: 'dailyWheel' } as object,
              },
              select: { id: true },
            });
          }
        })();

        await tx.dailyWheelSpin.update({
          where: { id: spin.id },
          data: { creditTransactionId: creditTx.id },
          select: { id: true },
        });

        return { spin: { reward: spin.reward, spunAt: spin.spunAt }, balanceAfter: updated.credits };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const already = await prisma.dailyWheelSpin.findUnique({
          where: { userId_dayNumber: { userId, dayNumber } },
          select: { reward: true, spunAt: true },
        });
        if (already) {
          return NextResponse.json(
            {
              alreadySpun: true,
              dayNumber,
              reward: already.reward,
              spunAt: already.spunAt.toISOString(),
            },
            { headers },
          );
        }
      }
      throw e;
    }

    return NextResponse.json(
      {
        alreadySpun: false,
        dayNumber,
        reward: result.spin.reward,
        spunAt: result.spin.spunAt.toISOString(),
        balanceAfter: Math.round(result.balanceAfter),
      },
      { headers },
    );
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        {
          error: 'Service temporarily unavailable',
          degraded: true,
          errorKey: 'dbSchemaMismatch',
          hint:
            process.env.NODE_ENV === 'production'
              ? undefined
              : 'Run migrations for the DailyWheelSpin table (e.g. `npx prisma migrate dev` locally, or `npx prisma migrate deploy` in deploy).',
        },
        { status: 503, headers },
      );
    }
    console.error('Error spinning daily wheel:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}
