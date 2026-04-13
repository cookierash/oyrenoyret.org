/**
 * Materials API
 *
 * GET: List published materials by topic (public)
 * POST: Create new material (Studio, requires auth)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { calcMaterialUnlockCost, getBalance, roundCredits } from '@/src/modules/credits';
import { SUBJECTS, CONTENT_LIMITS, RATE_LIMITS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { getPrivateNoStoreHeaders, getPublicCacheHeaders } from '@/src/lib/http-cache';
import { sanitizeInput, sanitizePracticeTestContent, sanitizeRichTextHtml } from '@/src/security/validation';
import { getPracticeTestQuestionCount, getTextWordCount } from '@/src/modules/materials/utils';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { Prisma } from '@prisma/client';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

async function findPublishedMaterialsPublic(options: {
  subjectId: string;
  topicId: string;
  take?: number;
  skip?: number;
}): Promise<any[]> {
  const { subjectId, topicId, take, skip } = options;
  const orderBy = { publishedAt: 'desc' } as const;

  const selectCore = {
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
  } as const;

  const selectWithRatings = {
    ...selectCore,
    ratingAvg: true,
    ratingCount: true,
  } as const;

  const whereWithModeration = {
    subjectId,
    topicId,
    status: 'PUBLISHED' as const,
    deletedAt: null,
    removedAt: null,
  };

  const whereWithoutModeration = {
    subjectId,
    topicId,
    status: 'PUBLISHED' as const,
    deletedAt: null,
  };

  try {
    return (await prisma.material.findMany({
      where: whereWithModeration,
      orderBy,
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
      select: selectWithRatings as any,
    })) as any[];
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  try {
    return (await prisma.material.findMany({
      where: whereWithoutModeration,
      orderBy,
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
      select: selectWithRatings as any,
    })) as any[];
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  return (await prisma.material.findMany({
    where: whereWithoutModeration,
    orderBy,
    ...(take ? { take } : {}),
    ...(skip ? { skip } : {}),
    select: selectCore as any,
  })) as any[];
}

async function findPublishedMaterialsWithAccess(options: {
  subjectId: string;
  topicId: string;
  take?: number;
  skip?: number;
}): Promise<any[]> {
  const { subjectId, topicId, take, skip } = options;
  const orderBy = { publishedAt: 'desc' } as const;

  const selectCore = {
    id: true,
    userId: true,
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
  } as const;

  const selectWithRatings = {
    ...selectCore,
    difficulty: true,
    questionCount: true,
    ratingAvg: true,
    ratingCount: true,
  } as const;

  const selectWithCounts = {
    ...selectWithRatings,
    _count: {
      select: { accesses: true },
    },
  } as const;

  const selectCoreWithCounts = {
    ...selectCore,
    _count: {
      select: { accesses: true },
    },
  } as const;

  const whereWithModeration = {
    subjectId,
    topicId,
    status: 'PUBLISHED' as const,
    deletedAt: null,
    removedAt: null,
  };

  const whereWithoutModeration = {
    subjectId,
    topicId,
    status: 'PUBLISHED' as const,
    deletedAt: null,
  };

  try {
    return (await prisma.material.findMany({
      where: whereWithModeration,
      orderBy,
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
      select: selectWithCounts as any,
    })) as any[];
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  try {
    return (await prisma.material.findMany({
      where: whereWithoutModeration,
      orderBy,
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
      select: selectWithCounts as any,
    })) as any[];
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  try {
    return (await prisma.material.findMany({
      where: whereWithoutModeration,
      orderBy,
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
      select: selectCoreWithCounts as any,
    })) as any[];
  } catch (error) {
    if (!isDbSchemaMismatch(error)) throw error;
  }

  return (await prisma.material.findMany({
    where: whereWithoutModeration,
    orderBy,
    ...(take ? { take } : {}),
    ...(skip ? { skip } : {}),
    select: selectCore as any,
  })) as any[];
}

export async function GET(request: Request) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`materials:list:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const topicId = searchParams.get('topicId');
    const takeRaw = searchParams.get('take');
    const skipRaw = searchParams.get('skip');
    const takeParam = takeRaw ? Number(takeRaw) : null;
    const skipParam = skipRaw ? Number(skipRaw) : null;
    const take = takeParam !== null && Number.isFinite(takeParam)
      ? Math.min(Math.max(takeParam, 1), 200)
      : undefined;
    const skip = skipParam !== null && Number.isFinite(skipParam) && skipParam > 0
      ? skipParam
      : undefined;
    const includeAccess =
      searchParams.get('includeAccess') === '1' ||
      searchParams.get('includeAccess') === 'true' ||
      searchParams.get('view') === 'catalog';

    if (!subjectId || !topicId) {
      return NextResponse.json(
        { error: 'subjectId and topicId are required' },
        { status: 400 }
      );
    }

    if (!includeAccess) {
      const materials = await findPublishedMaterialsPublic({ subjectId, topicId, take, skip });

      return NextResponse.json(
        materials.map((m) => ({
          id: m.id,
          title: m.title,
          content: m.content,
          materialType: m.materialType,
          publishedAt: m.publishedAt,
          ratingAvg: typeof m.ratingAvg === 'number' ? m.ratingAvg : 0,
          ratingCount: typeof m.ratingCount === 'number' ? m.ratingCount : 0,
          authorName: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || 'Student',
        })),
        { headers: getPublicCacheHeaders() }
      );
    }

    const materials = await findPublishedMaterialsWithAccess({ subjectId, topicId, take, skip });

    const userId = await getCurrentSession();
    const materialIds = materials.map((m) => m.id);
    const [unlockedForUser, balance] = await Promise.all([
      userId && materialIds.length > 0
        ? prisma.materialAccess.findMany({
            where: { userId, materialId: { in: materialIds } },
            select: { materialId: true },
          })
        : Promise.resolve([]),
      userId ? getBalance(userId) : Promise.resolve(0),
    ]);
    const unlockedIds = new Set(unlockedForUser.map((a) => a.materialId));

    const mappedMaterials = materials.map((m) => {
      const questionCount =
        m.materialType === 'PRACTICE_TEST'
          ? (typeof m.questionCount === 'number' ? m.questionCount : getPracticeTestQuestionCount(m.content))
          : 0;
      const wordCount = m.materialType === 'TEXTUAL' ? getTextWordCount(m.content) : 0;
      return {
        id: m.id,
        userId: m.userId,
        title: m.title,
        materialType: m.materialType,
        difficulty: m.difficulty ?? null,
        publishedAt: m.publishedAt,
        ratingAvg: typeof m.ratingAvg === 'number' ? m.ratingAvg : 0,
        ratingCount: typeof m.ratingCount === 'number' ? m.ratingCount : 0,
        user: m.user,
        _count: m._count ?? { accesses: 0 },
        estimatedCost: roundCredits(
          calcMaterialUnlockCost({
            materialType: m.materialType,
            questionCount,
            wordCount,
          })
        ),
      };
    });

    return NextResponse.json(
      {
        materials: mappedMaterials,
        unlockedIds: Array.from(unlockedIds),
        balance,
        userId,
      },
      { headers: getPrivateNoStoreHeaders() }
    );
  } catch (error) {
    console.error('Error fetching materials:', error);
    const message = error instanceof Error ? error.message : '';
    const looksLikeMissingMigration =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') ||
      /column .* does not exist/i.test(message);
    if (looksLikeMissingMigration) {
      return NextResponse.json(
        { error: 'Database schema out of date', code: 'DB_MIGRATION_REQUIRED' },
        { status: 500 }
      );
    }
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
      `materials:create:${identifier}`,
      RATE_LIMITS.WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
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

    let dbSubject: { id: string } | null = null;
    try {
      dbSubject = await prisma.subject.findFirst({
        where: { slug: subjectId, deletedAt: null },
        select: { id: true },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      dbSubject = null;
    }
    if (dbSubject) {
      let dbTopic: { id: string } | null = null;
      try {
        dbTopic = await prisma.topic.findFirst({
          where: { subjectId: dbSubject.id, slug: topicId, deletedAt: null },
          select: { id: true },
        });
      } catch (error) {
        if (!isDbSchemaMismatch(error)) throw error;
        dbTopic = null;
      }
      if (!dbTopic) {
        return NextResponse.json({ error: 'Invalid subject or topic' }, { status: 400 });
      }
    } else {
      const subject = SUBJECTS.find((s) => s.id === subjectId);
      const topics = subject
        ? CURRICULUM_TOPICS[subject.id as keyof typeof CURRICULUM_TOPICS]
        : null;
      const topic = topics?.find((t) => t.id === topicId);
      if (!subject || !topic) {
        return NextResponse.json({ error: 'Invalid subject or topic' }, { status: 400 });
      }
    }

    let sanitizedContent: string;
    try {
      sanitizedContent =
        type === 'PRACTICE_TEST'
          ? sanitizePracticeTestContent(content)
          : sanitizeRichTextHtml(content);
    } catch {
      return NextResponse.json({ error: 'Invalid material content' }, { status: 400 });
    }
    sanitizedContent = sanitizedContent.slice(0, CONTENT_LIMITS.MATERIAL_CONTENT_MAX);
    const questionCount =
      type === 'PRACTICE_TEST' ? getPracticeTestQuestionCount(sanitizedContent) : 0;

    const material = await prisma.material.create({
      data: {
        userId,
        subjectId,
        topicId,
        title: sanitizeInput(String(title)).slice(0, CONTENT_LIMITS.MATERIAL_TITLE_MAX),
        objectives: objectives != null ? sanitizeInput(String(objectives)).slice(0, 2000) : null,
        content: sanitizedContent,
        materialType: type,
        questionCount,
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
