/**
 * Material API
 *
 * GET: Fetch single material for editing (owner only)
 * PATCH: Update and publish materials (owner only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { grantMaterialPublish } from '@/src/modules/credits';
import { CREDITS_MATERIAL } from '@/src/config/credits';
import { recordUserActivity } from '@/src/modules/activity-stats';
import { CONTENT_LIMITS, RATE_LIMITS } from '@/src/config/constants';
import { sanitizeInput, sanitizeHtml } from '@/src/security/validation';
import { getPracticeTestQuestionCount, getTextWordCount } from '@/src/modules/materials/utils';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';

export async function GET(
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
      where: { id: materialId, userId, deletedAt: null },
      select: {
        id: true,
        subjectId: true,
        topicId: true,
        title: true,
        objectives: true,
        content: true,
        status: true,
        materialType: true,
        questionCount: true,
        publishedAt: true,
        difficulty: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error fetching material:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `materials:update:${identifier}`,
      RATE_LIMITS.WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { materialId } = await params;
    const body = await request.json();

    const material = await prisma.material.findFirst({
      where: { id: materialId, userId, deletedAt: null },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const updates: {
      title?: string;
      objectives?: string | null;
      content?: string;
      status?: 'DRAFT' | 'PUBLISHED';
      publishedAt?: Date | null;
      difficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
      questionCount?: number;
    } = {};

    if (body.title !== undefined) {
      updates.title = sanitizeInput(String(body.title)).slice(0, CONTENT_LIMITS.MATERIAL_TITLE_MAX);
    }
    if (body.objectives !== undefined) {
      updates.objectives = body.objectives == null ? null : sanitizeInput(String(body.objectives)).slice(0, 2000);
    }
    if (body.content !== undefined) {
      const sanitized = sanitizeHtml(String(body.content)).slice(0, CONTENT_LIMITS.MATERIAL_CONTENT_MAX);
      updates.content = sanitized;
      updates.questionCount =
        material.materialType === 'PRACTICE_TEST'
          ? getPracticeTestQuestionCount(sanitized)
          : 0;
    }
    const isPublishing = body.status === 'PUBLISHED' && material.status !== 'PUBLISHED';
    if (isPublishing) {
      const effectiveObjectives =
        body.objectives !== undefined
          ? (body.objectives == null ? null : sanitizeInput(String(body.objectives)).trim())
          : (material.objectives?.trim() ?? null);
      if (!effectiveObjectives) {
        return NextResponse.json(
          { error: 'Lesson objectives are required to publish' },
          { status: 400 }
        );
      }
    }
    if (body.status === 'PUBLISHED') {
      updates.status = 'PUBLISHED';
      updates.publishedAt = new Date();
      const diff = body.difficulty;
      if (diff === 'BASIC' || diff === 'INTERMEDIATE' || diff === 'ADVANCED') {
        updates.difficulty = diff;
      } else {
        updates.difficulty = 'BASIC';
      }
    }
    if (body.status === 'DRAFT') {
      updates.status = 'DRAFT';
      updates.publishedAt = null;
    }

    const updated = await prisma.material.update({
      where: { id: materialId },
      data: updates,
      select: {
        id: true,
        subjectId: true,
        topicId: true,
        title: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    let balanceAfter: number | undefined;
    let creditsGranted: number | undefined;
    if (isPublishing) {
      const effectiveContent = updates.content ?? material.content;
      let questionCount =
        material.materialType === 'PRACTICE_TEST'
          ? updates.questionCount ?? material.questionCount
          : 0;
      if (material.materialType === 'PRACTICE_TEST' && questionCount === 0) {
        questionCount = getPracticeTestQuestionCount(effectiveContent);
      }
      const wordCount =
        material.materialType === 'TEXTUAL' ? getTextWordCount(effectiveContent) : 0;

      if (material.materialType === 'TEXTUAL') {
        if (wordCount < CREDITS_MATERIAL.TEXTUAL_MIN_WORDS) {
          return NextResponse.json(
            {
              error: `Textual materials must be at least ${CREDITS_MATERIAL.TEXTUAL_MIN_WORDS} words to publish`,
            },
            { status: 400 }
          );
        }
      }
      if (material.materialType === 'PRACTICE_TEST') {
        if (questionCount < CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS) {
          return NextResponse.json(
            {
              error: `Practice tests must include at least ${CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS} questions to publish`,
            },
            { status: 400 }
          );
        }
      }
      const result = await grantMaterialPublish(
        userId,
        {
          materialType: material.materialType,
          questionCount,
          wordCount,
        },
        materialId
      );
      if (!result.success) {
        console.error('[Material publish] Credit grant failed:', result.error);
        return NextResponse.json(
          { error: result.error ?? 'Failed to grant publish credits' },
          { status: 500 }
        );
      }
      balanceAfter = result.balanceAfter;
      creditsGranted = result.amount;
      try {
        await recordUserActivity(userId, {
          materialsSharedTextual: material.materialType === 'TEXTUAL' ? 1 : 0,
          materialsSharedPractice: material.materialType === 'PRACTICE_TEST' ? 1 : 0,
        });
      } catch (error) {
        console.error('[Material publish] Activity tracking failed:', error);
      }
    }

    return NextResponse.json({ ...updated, balanceAfter, creditsGranted });
  } catch (error) {
    console.error('Error updating material:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `materials:delete:${identifier}`,
      RATE_LIMITS.WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { materialId } = await params;
    const material = await prisma.material.findFirst({
      where: { id: materialId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    await prisma.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting material:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
