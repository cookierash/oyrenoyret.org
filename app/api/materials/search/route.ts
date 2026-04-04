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

    const results = await prisma.material.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(subjectIds.length > 0 ? { subjectId: { in: subjectIds } } : {}),
        ...(topicIds.length > 0 ? { topicId: { in: topicIds } } : {}),
        ...(q
          ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { objectives: { contains: q, mode: 'insensitive' } },
            ],
          }
          : {}),
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

    const subjectMap = new Map(SUBJECTS.map((s) => [s.id, s.name]));
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
          authorName: [item.user.firstName, item.user.lastName].filter(Boolean).join(' ') || 'Student',
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
