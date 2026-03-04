/**
 * Material Unlock API
 *
 * POST: Unlock material (spend credits, grant passive to publisher)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { spendMaterialUnlock, calcMaterialUnlockCost, getBalance, roundCredits } from '@/src/modules/credits';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { materialId } = await params;

    const material = await prisma.material.findFirst({
      where: { id: materialId, status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        userId: true,
        materialType: true,
        content: true,
      },
    });

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

    let questionCount = 0;
    if (material.materialType === 'PRACTICE_TEST' && material.content) {
      try {
        const parsed = JSON.parse(material.content) as { questions?: unknown[] };
        questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
      } catch {
        /* ignore */
      }
    }

    const params_ = {
      materialType: material.materialType,
      questionCount,
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
