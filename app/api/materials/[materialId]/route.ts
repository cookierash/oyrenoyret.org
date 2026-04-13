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
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { sanitizeInput, sanitizePracticeTestContent, sanitizeRichTextHtml } from '@/src/security/validation';
import { getPracticeTestQuestionCount, getTextWordCount } from '@/src/modules/materials/utils';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`materials:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { materialId } = await params;

    let material: any = null;
    try {
      material = await prisma.material.findFirst({
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
          removedAt: true,
          removedReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      material = await prisma.material.findFirst({
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
      if (material) {
        material = { ...material, removedAt: null, removedReason: null };
      }
    }

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }
    if (material.removedAt) {
      return NextResponse.json(
        { error: 'This material was removed by moderators and is read-only.', errorKey: 'contentRemoved' },
        { status: 403 },
      );
    }

    return NextResponse.json(material, { headers: getPrivateNoStoreHeaders() });
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

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status }
      );
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

    let material: any = null;
    try {
      material = await prisma.material.findFirst({
        where: { id: materialId, userId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          status: true,
          materialType: true,
          content: true,
          objectives: true,
          questionCount: true,
          publishedAt: true,
          removedAt: true,
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      material = await prisma.material.findFirst({
        where: { id: materialId, userId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          status: true,
          materialType: true,
          content: true,
          objectives: true,
          questionCount: true,
          publishedAt: true,
        },
      });
      if (material) {
        material = { ...material, removedAt: null };
      }
    }

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }
    if ((material as any).removedAt) {
      return NextResponse.json(
        { error: 'This material was removed by moderators and cannot be edited.', errorKey: 'contentRemoved' },
        { status: 403 },
      );
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
      let sanitized: string;
      try {
        sanitized =
          material.materialType === 'PRACTICE_TEST'
            ? sanitizePracticeTestContent(String(body.content))
            : sanitizeRichTextHtml(String(body.content));
      } catch {
        return NextResponse.json({ error: 'Invalid material content' }, { status: 400 });
      }
      sanitized = sanitized.slice(0, CONTENT_LIMITS.MATERIAL_CONTENT_MAX);
      updates.content = sanitized;
      updates.questionCount =
        material.materialType === 'PRACTICE_TEST'
          ? getPracticeTestQuestionCount(sanitized)
          : 0;
    }
    const isPublishing = body.status === 'PUBLISHED' && material.status !== 'PUBLISHED';
    let publishQuestionCount: number | undefined;
    let publishWordCount: number | undefined;
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

      const effectiveContent = updates.content ?? material.content ?? '';
      if (material.materialType === 'TEXTUAL') {
        const wordCount = getTextWordCount(effectiveContent);
        if (wordCount < CREDITS_MATERIAL.TEXTUAL_MIN_WORDS) {
          return NextResponse.json(
            {
              error: `Textual materials must be at least ${CREDITS_MATERIAL.TEXTUAL_MIN_WORDS} words to publish`,
            },
            { status: 400 }
          );
        }
        publishWordCount = wordCount;
      }
      if (material.materialType === 'PRACTICE_TEST') {
        let questionCount = updates.questionCount ?? material.questionCount;
        if (questionCount === 0) {
          questionCount = getPracticeTestQuestionCount(effectiveContent);
        }
        if (questionCount < CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS) {
          return NextResponse.json(
            {
              error: `Practice tests must include at least ${CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS} questions to publish`,
            },
            { status: 400 }
          );
        }
        publishQuestionCount = questionCount;
        updates.questionCount = questionCount;
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
      const result = await grantMaterialPublish(
        userId,
        {
          materialType: material.materialType,
          questionCount: publishQuestionCount ?? 0,
          wordCount: publishWordCount ?? 0,
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

    const verified = await requireVerifiedEmailForWrite(userId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status }
      );
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
