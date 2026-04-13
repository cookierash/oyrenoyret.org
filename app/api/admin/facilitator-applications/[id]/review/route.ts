/**
 * Admin Facilitator Application Review API
 *
 * POST: Approve / reject / request changes for a facilitator application (staff only).
 * Creates a notice visible on the applicant's Notifications page.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { isStaff } from '@/src/lib/permissions';
import { RATE_LIMITS } from '@/src/config/constants';
import { buildRateLimitResponse, checkRateLimit, getRateLimitIdentifier } from '@/src/security/rateLimiter';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { sanitizeInput } from '@/src/security/validation';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

const subjectIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/i);

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  message: z.string().trim().max(2000).optional(),
  approvedSubjectIds: z.array(subjectIdSchema).max(12).optional(),
});

type FacilitatorApplicationNoticePayloadV1 = {
  v: 1;
  kind: 'facilitator_application';
  status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
  approvedSubjectIds?: string[];
  message?: string | null;
};

function buildFacilitatorApplicationNoticeBody(payload: FacilitatorApplicationNoticePayloadV1) {
  return JSON.stringify(payload);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const applicationId = typeof id === 'string' ? id.trim() : '';

  const staffId = await getCurrentSession();
  if (!staffId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const verified = await requireVerifiedEmailForWrite(staffId);
    if (!verified.ok) {
      const message = 'error' in verified ? verified.error : 'Unauthorized';
      return NextResponse.json(
        { error: message, errorKey: verified.errorKey },
        { status: verified.status },
      );
    }

    const identifier = getRateLimitIdentifier(request, staffId);
    const rateLimit = await checkRateLimit(
      `admin:facilitator-applications:review:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE,
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const staffUser = await prisma.user.findUnique({
      where: { id: staffId },
      select: { role: true },
    });
    if (!staffUser?.role || !isStaff(staffUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!applicationId) {
      return NextResponse.json({ error: 'Application id is required.' }, { status: 400 });
    }

    const db = prisma as unknown as Record<string, unknown>;
    const facilitatorApplicationDelegate = db.facilitatorApplication as
      | { findFirst: (args: unknown) => Promise<any> }
      | undefined;
    if (!facilitatorApplicationDelegate) {
      return NextResponse.json(
        { error: 'Feature is not available yet. Please try again later.' },
        { status: 503 },
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = reviewSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const action = parsed.data.action;
    const message = parsed.data.message ? sanitizeInput(parsed.data.message).trim() : '';

    const application = (await (async () => {
      try {
        return await facilitatorApplicationDelegate.findFirst({
          where: { id: applicationId, deletedAt: null },
          select: {
            id: true,
            userId: true,
            status: true,
            subjects: { select: { subjectId: true } },
          },
        });
      } catch (error) {
        if (isDbSchemaMismatch(error)) return null;
        throw error;
      }
    })()) as
      | {
          id: string;
          userId: string;
          status: 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';
          subjects: Array<{ subjectId: string }>;
        }
      | null;

    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      const requested = application.subjects.map((s) => s.subjectId);
      const requestedSet = new Set(requested);
      const approvedRequested = Array.isArray(parsed.data.approvedSubjectIds)
        ? parsed.data.approvedSubjectIds.filter((value) => requestedSet.has(value))
        : requested;
      const approvedSubjectIds = Array.from(new Set(approvedRequested)).sort();

      if (approvedSubjectIds.length === 0) {
        return NextResponse.json({ error: 'Select at least one subject to approve.' }, { status: 400 });
      }

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const tdb = tx as unknown as Record<string, any>;
        await tdb.facilitatorApplication.update({
          where: { id: application.id },
          data: {
            status: 'APPROVED',
            reviewerMessage: message || null,
            reviewedAt: now,
            reviewedById: staffId,
          },
          select: { id: true },
        });

        await tdb.facilitatorApplicationSubject.updateMany({
          where: { applicationId: application.id },
          data: { approvedAt: null },
        });

        await tdb.facilitatorApplicationSubject.updateMany({
          where: { applicationId: application.id, subjectId: { in: approvedSubjectIds } },
          data: { approvedAt: now },
        });

        for (const subjectId of approvedSubjectIds) {
          await tdb.facilitatorSubjectVerification.upsert({
            where: { userId_subjectId: { userId: application.userId, subjectId } },
            create: {
              userId: application.userId,
              subjectId,
              applicationId: application.id,
              verifiedById: staffId,
              verifiedAt: now,
            },
            update: {
              applicationId: application.id,
              verifiedById: staffId,
              verifiedAt: now,
              revokedAt: null,
              revokedById: null,
              revokedReason: null,
            },
          });
        }

        await tdb.moderationNotice.create({
          data: {
            userId: application.userId,
            type: 'FACILITATOR_APPLICATION_APPROVED',
            title: 'Facilitator application approved',
            body: buildFacilitatorApplicationNoticeBody({
              v: 1,
              kind: 'facilitator_application',
              status: 'APPROVED',
              approvedSubjectIds,
              message: message || null,
            }),
            linkUrl: '/my-library/guided-group-sessions',
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const nextStatus = action === 'reject' ? 'REJECTED' : 'CHANGES_REQUESTED';
    const noticeType =
      action === 'reject'
        ? ('FACILITATOR_APPLICATION_REJECTED' as const)
        : ('FACILITATOR_APPLICATION_CHANGES_REQUESTED' as const);
    const noticeTitle =
      action === 'reject' ? 'Facilitator application rejected' : 'Facilitator application: changes requested';
    const noticeStatus = action === 'reject' ? 'REJECTED' : 'CHANGES_REQUESTED';

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const tdb = tx as unknown as Record<string, any>;
      await tdb.facilitatorApplication.update({
        where: { id: application.id },
        data: {
          status: nextStatus,
          reviewerMessage: message,
          reviewedAt: now,
          reviewedById: staffId,
        },
        select: { id: true },
      });

      await tdb.moderationNotice.create({
        data: {
          userId: application.userId,
          type: noticeType,
          title: noticeTitle,
          body: buildFacilitatorApplicationNoticeBody({
            v: 1,
            kind: 'facilitator_application',
            status: noticeStatus,
            message,
          }),
          linkUrl: '/my-library/guided-group-sessions',
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error reviewing facilitator application:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
