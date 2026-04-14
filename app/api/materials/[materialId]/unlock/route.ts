/**
 * Material Unlock API
 *
 * POST: Unlock material (spend credits, grant passive to publisher)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { spendMaterialUnlock, calcMaterialUnlockCost, getBalance, roundCredits } from '@/src/modules/credits';
import { getPracticeTestQuestionCount, getTextWordCount } from '@/src/modules/materials/utils';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ materialId: string }> }
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
    if (user?.role && isStaff(user.role)) {
      return NextResponse.json(
        { error: 'Staff accounts cannot unlock materials.' },
        { status: 403 },
      );
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `materials:unlock:${identifier}`,
      RATE_LIMITS.UNLOCK
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { materialId } = await params;

    let material: any = null;
    try {
      material = await prisma.material.findFirst({
        where: { id: materialId, status: 'PUBLISHED', deletedAt: null, removedAt: null },
        select: {
          id: true,
          userId: true,
          materialType: true,
          content: true,
          questionCount: true,
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      material = await prisma.material.findFirst({
        where: { id: materialId, status: 'PUBLISHED', deletedAt: null },
        select: {
          id: true,
          userId: true,
          materialType: true,
          content: true,
          questionCount: true,
        },
      });
    }

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    if (material.userId === userId) {
      return NextResponse.json(
        { error: 'Cannot unlock your own material' },
        { status: 403 }
      );
    }

    // Already unlocked
    const existing = await prisma.materialAccess.findUnique({
      where: {
        userId_materialId: { userId, materialId },
      },
    });
    if (existing) {
      return NextResponse.json({ unlocked: true, balance: await getBalance(userId) });
    }

    let questionCount =
      material.materialType === 'PRACTICE_TEST' ? material.questionCount : 0;
    if (material.materialType === 'PRACTICE_TEST' && questionCount === 0) {
      questionCount = getPracticeTestQuestionCount(material.content);
    }
    const wordCount =
      material.materialType === 'TEXTUAL' ? getTextWordCount(material.content) : 0;

    const params_ = {
      materialType: material.materialType,
      questionCount,
      wordCount,
    };
    const cost = roundCredits(calcMaterialUnlockCost(params_));
    const balance = await getBalance(userId);
    if (balance < cost) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: cost, balance },
        { status: 402 }
      );
    }

    const result = await spendMaterialUnlock(
      userId,
      materialId,
      params_,
      material.userId
    );

    if (!result.success) {
      if (result.error === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json(
          { error: 'Insufficient credits', required: cost, balance },
          { status: 402 }
        );
      }
      return NextResponse.json({ error: result.error ?? 'Unlock failed' }, { status: 500 });
    }

    return NextResponse.json({
      unlocked: true,
      cost,
      balanceAfter: result.balanceAfter,
    });
  } catch (error) {
    console.error('Error unlocking material:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
