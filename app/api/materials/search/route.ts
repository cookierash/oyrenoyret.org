/**
 * Materials Search API
 *
 * GET: Lightweight search across published materials.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { SUBJECTS, RATE_LIMITS } from '@/src/config/constants';
import { CURRICULUM_TOPICS } from '@/src/config/curriculum';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { sanitizeInput } from '@/src/security/validation';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rateLimit = await checkRateLimit(`materials:search:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const { searchParams } = new URL(request.url);
    const qRaw = searchParams.get('q') ?? '';
    const q = sanitizeInput(qRaw).trim();
    const subjectsParam = searchParams.get('subjects') ?? '';
    const topicsParam = searchParams.get('topics') ?? '';
    const takeParam = Number(searchParams.get('take') ?? 8);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 12) : 8;

    const subjectIds = subjectsParam
      ? subjectsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const topicIds = topicsParam
      ? topicsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (!q && subjectIds.length === 0) {
      return NextResponse.json({ results: [] }, { headers: getPrivateNoStoreHeaders() });
    }

    type NormalizedResult = {
      id: string;
      title: string;
      subjectId: string;
      topicId: string;
      materialType: 'TEXTUAL' | 'PRACTICE_TEST';
      publishedAt: Date | null;
      authorFirstName: string | null;
      authorLastName: string | null;
    };

    const results: NormalizedResult[] = await (async () => {
      if (!q) {
        const rows = await prisma.material.findMany({
          where: {
            status: 'PUBLISHED',
            deletedAt: null,
            ...(subjectIds.length > 0 ? { subjectId: { in: subjectIds } } : {}),
            ...(topicIds.length > 0 ? { topicId: { in: topicIds } } : {}),
          },
          orderBy: { publishedAt: 'desc' },
          take,
          select: {
            id: true,
            title: true,
            subjectId: true,
            topicId: true,
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
        return rows.map((row) => ({
          id: row.id,
          title: row.title,
          subjectId: row.subjectId,
          topicId: row.topicId,
          materialType: row.materialType,
          publishedAt: row.publishedAt,
          authorFirstName: row.user.firstName,
          authorLastName: row.user.lastName,
        }));
      }

      type Row = NormalizedResult & { rank: number };

      const vectorExpr = Prisma.sql`to_tsvector('simple', concat_ws(' ', m.title, m.objectives, m.content))`;
      const baseWhere = Prisma.sql`m."status" = 'PUBLISHED' AND m."deletedAt" IS NULL`;
      const subjectFilter =
        subjectIds.length > 0
          ? Prisma.sql` AND m."subjectId" IN (${Prisma.join(subjectIds)})`
          : Prisma.empty;
      const topicFilter =
        topicIds.length > 0
          ? Prisma.sql` AND m."topicId" IN (${Prisma.join(topicIds)})`
          : Prisma.empty;

      const runQuery = async (tsQueryFn: 'websearch_to_tsquery' | 'plainto_tsquery') => {
        const tsQuery =
          tsQueryFn === 'websearch_to_tsquery'
            ? Prisma.sql`websearch_to_tsquery('simple', ${q})`
            : Prisma.sql`plainto_tsquery('simple', ${q})`;
        return prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT
            m.id,
            m.title,
            m."subjectId" as "subjectId",
            m."topicId" as "topicId",
            m."materialType" as "materialType",
            m."publishedAt" as "publishedAt",
            u."firstName" as "authorFirstName",
            u."lastName" as "authorLastName",
            ts_rank_cd(${vectorExpr}, ${tsQuery}) as rank
          FROM "Material" m
          JOIN "User" u ON u.id = m."userId"
          WHERE ${baseWhere}
            AND ${vectorExpr} @@ ${tsQuery}
            ${subjectFilter}
            ${topicFilter}
          ORDER BY rank DESC, m."publishedAt" DESC NULLS LAST
          LIMIT ${take}
        `);
      };

      try {
        const rows = await runQuery('websearch_to_tsquery');
        return rows;
      } catch {
        const rows = await runQuery('plainto_tsquery');
        return rows;
      }
    })();

    const subjectMap = new Map<string, string>(SUBJECTS.map((s) => [s.id, s.name]));
    const topicMap = new Map<string, string>();
    Object.entries(CURRICULUM_TOPICS).forEach(([subjectId, topics]) => {
      topics.forEach((topic) => {
        topicMap.set(`${subjectId}:${topic.id}`, topic.name);
      });
    });

    return NextResponse.json(
      {
        results: results.map((item) => ({
          id: item.id,
          title: item.title,
          subjectId: item.subjectId,
          subjectName: subjectMap.get(item.subjectId) ?? item.subjectId,
          topicId: item.topicId,
          topicName: topicMap.get(`${item.subjectId}:${item.topicId}`) ?? item.topicId,
          materialType: item.materialType,
          publishedAt: item.publishedAt,
          authorName: [item.authorFirstName, item.authorLastName].filter(Boolean).join(' ') || 'Student',
        })),
      },
      { headers: getPrivateNoStoreHeaders() }
    );
  } catch (error) {
    console.error('Error searching materials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
