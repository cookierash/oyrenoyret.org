/**
 * Facilitator Applications API
 *
 * GET: Current user's latest facilitator application + verified subjects.
 * POST: Submit (or resubmit) a facilitator application.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import { getPrivateNoStoreHeaders } from '@/src/lib/http-cache';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const subjectIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/i, 'Invalid subject id.');

const applicationSchema = z.object({
  phoneNumber: z.string().trim().min(6).max(32),
  finCode: z.string().trim().min(5).max(24),
  motivationLetter: z.string().trim().min(20).max(1200),
  subjectIds: z.array(subjectIdSchema).min(1).max(12),
});

export async function GET(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`facilitator-applications:read:${identifier}`, RATE_LIMITS.GENERAL);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const db = prisma as unknown as Record<string, unknown>;
    const facilitatorApplicationDelegate = db.facilitatorApplication as
      | { findFirst: (args: unknown) => Promise<unknown> }
      | undefined;
    const facilitatorSubjectVerificationDelegate = db.facilitatorSubjectVerification as
      | { findMany: (args: unknown) => Promise<Array<{ subjectId: string }>> }
      | undefined;

    if (!facilitatorApplicationDelegate || !facilitatorSubjectVerificationDelegate) {
      return NextResponse.json(
        { application: null, verifiedSubjectIds: [] },
        { headers: getPrivateNoStoreHeaders() },
      );
    }

    const [application, verifiedSubjects] = await Promise.all([
      (async () => {
        try {
          return await facilitatorApplicationDelegate.findFirst({
            where: { userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              phoneNumber: true,
              finCode: true,
              motivationLetter: true,
              status: true,
              reviewerMessage: true,
              reviewedAt: true,
              createdAt: true,
              updatedAt: true,
              subjects: {
                orderBy: { subjectId: 'asc' },
                select: { subjectId: true, approvedAt: true },
              },
              reviewedBy: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          });
        } catch (error) {
          if (isDbSchemaMismatch(error)) return null;
          throw error;
        }
      })(),
      (async () => {
        try {
          return await facilitatorSubjectVerificationDelegate.findMany({
            where: { userId, revokedAt: null },
            orderBy: { verifiedAt: 'desc' },
            select: { subjectId: true, verifiedAt: true },
          });
        } catch (error) {
          if (isDbSchemaMismatch(error)) return [];
          throw error;
        }
      })(),
    ]);

    return NextResponse.json(
      {
        application,
        verifiedSubjectIds: verifiedSubjects.map((row) => row.subjectId),
      },
      { headers: getPrivateNoStoreHeaders() },
    );
  } catch (error) {
    console.error('Error fetching facilitator application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentSession();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(`facilitator-applications:write:${identifier}`, RATE_LIMITS.WRITE);
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const db = prisma as unknown as Record<string, unknown>;
    const facilitatorApplicationDelegate = db.facilitatorApplication as
      | {
          findFirst: (args: unknown) => Promise<unknown>;
          update: (args: unknown) => Promise<unknown>;
          create: (args: unknown) => Promise<unknown>;
        }
      | undefined;

    if (!facilitatorApplicationDelegate) {
      return NextResponse.json(
        { error: 'Feature is not available yet. Please try again later.' },
        { status: 503 },
      );
    }

    const writeAccess = await requireVerifiedEmailForWrite(userId);
    if (!writeAccess.ok) {
      const errorMessage = 'error' in writeAccess ? writeAccess.error : 'Unauthorized';
      return NextResponse.json(
        { error: errorMessage, errorKey: writeAccess.errorKey },
        { status: writeAccess.status },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const phoneNumber = sanitizeInput(parsed.data.phoneNumber);
    const finCode = sanitizeInput(parsed.data.finCode);
    const motivationLetter = sanitizeInput(parsed.data.motivationLetter);
    const subjectIds = Array.from(new Set(parsed.data.subjectIds.map((value) => value.trim()))).sort();

    const openApplication = (await (async () => {
      try {
        return await facilitatorApplicationDelegate.findFirst({
          where: {
            userId,
            deletedAt: null,
            status: { in: ['PENDING', 'CHANGES_REQUESTED'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true },
        });
      } catch (error) {
        if (isDbSchemaMismatch(error)) return null;
        throw error;
      }
    })()) as { id: string; status: 'PENDING' | 'CHANGES_REQUESTED' } | null;

    if (openApplication?.status === 'PENDING') {
      return NextResponse.json(
        { error: 'You already have a pending application.' },
        { status: 409 },
      );
    }

    const data = {
      phoneNumber,
      finCode,
      motivationLetter,
      status: 'PENDING' as const,
      reviewerMessage: null,
      reviewedAt: null,
      reviewedById: null,
      subjects: {
        deleteMany: {},
        create: subjectIds.map((subjectId) => ({ subjectId })),
      },
    };

    const application = await (async () => {
      try {
        if (openApplication?.status === 'CHANGES_REQUESTED') {
          return await facilitatorApplicationDelegate.update({
            where: { id: openApplication.id },
            data,
            select: {
              id: true,
              status: true,
              reviewerMessage: true,
              reviewedAt: true,
              createdAt: true,
              updatedAt: true,
              subjects: {
                orderBy: { subjectId: 'asc' },
                select: { subjectId: true, approvedAt: true },
              },
            },
          });
        }

        return await facilitatorApplicationDelegate.create({
          data: {
            userId,
            phoneNumber,
            finCode,
            motivationLetter,
            status: 'PENDING',
            subjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
          },
          select: {
            id: true,
            status: true,
            reviewerMessage: true,
            reviewedAt: true,
            createdAt: true,
            updatedAt: true,
            subjects: {
              orderBy: { subjectId: 'asc' },
              select: { subjectId: true, approvedAt: true },
            },
          },
        });
      } catch (error) {
        if (isDbSchemaMismatch(error)) return null;
        throw error;
      }
    })();

    if (!application) {
      return NextResponse.json(
        { error: 'Feature is not available yet. Please try again later.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ application }, { headers: getPrivateNoStoreHeaders() });
  } catch (error) {
    console.error('Error submitting facilitator application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
