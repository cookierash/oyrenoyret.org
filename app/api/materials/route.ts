/**
 * Materials API
 *
 * GET: List published materials by topic (public)
 * POST: Create new material (Studio, requires auth)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { SUBJECTS, CONTENT_LIMITS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { sanitizeInput, sanitizeHtml } from '@/src/security/validation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const topicId = searchParams.get('topicId');

    if (!subjectId || !topicId) {
      return NextResponse.json(
        { error: 'subjectId and topicId are required' },
        { status: 400 }
      );
    }

    const materials = await prisma.material.findMany({
      where: {
        subjectId,
        topicId,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        materialType: true,
        publishedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(
      materials.map((m) => ({
        id: m.id,
        title: m.title,
        content: m.content,
        materialType: m.materialType,
        publishedAt: m.publishedAt,
        authorName: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || 'Student',
      }))
    );
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subjectId, topicId, title, objectives, content, materialType } = body;

    if (!subjectId || !topicId || !title || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'subjectId, topicId, title, and content are required' },
        { status: 400 }
      );
    }

    const type = materialType === 'PRACTICE_TEST' ? 'PRACTICE_TEST' : 'TEXTUAL';

    const subject = SUBJECTS.find((s) => s.id === subjectId);
    const topics = subject ? CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS] : null;
    const topic = topics?.find((t) => t.id === topicId);

    if (!subject || !topic) {
      return NextResponse.json({ error: 'Invalid subject or topic' }, { status: 400 });
    }

    const material = await prisma.material.create({
      data: {
        userId,
        subjectId,
        topicId,
        title: sanitizeInput(String(title)).slice(0, CONTENT_LIMITS.MATERIAL_TITLE_MAX),
        objectives: objectives != null ? sanitizeInput(String(objectives)).slice(0, 2000) : null,
        content: sanitizeHtml(content).slice(0, CONTENT_LIMITS.MATERIAL_CONTENT_MAX),
        materialType: type,
        status: 'DRAFT',
      },
      select: {
        id: true,
        subjectId: true,
        topicId: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error creating material:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Internal server error' },
      { status: 500 }
    );
  }
}
