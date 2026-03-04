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
import { CONTENT_LIMITS } from '@/src/config/constants';
import { sanitizeInput, sanitizeHtml } from '@/src/security/validation';

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
      publishedAt?: Date;
      difficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
    } = {};

    if (body.title !== undefined) {
      updates.title = sanitizeInput(String(body.title)).slice(0, CONTENT_LIMITS.MATERIAL_TITLE_MAX);
    }
    if (body.objectives !== undefined) {
      updates.objectives = body.objectives == null ? null : sanitizeInput(String(body.objectives)).slice(0, 2000);
    }
    if (body.content !== undefined) {
      updates.content = sanitizeHtml(String(body.content)).slice(0, CONTENT_LIMITS.MATERIAL_CONTENT_MAX);
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
      let questionCount = 0;
      if (material.materialType === 'PRACTICE_TEST' && material.content) {
        try {
          const parsed = JSON.parse(material.content) as { questions?: unknown[] };
          questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
        } catch {
          /* ignore */
        }
      }
      const result = await grantMaterialPublish(
        userId,
        {
          materialType: material.materialType,
          questionCount,
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
