/**
 * Live Event Submissions API
 *
 * POST: Submit a single sprint solution (confirmed participant only)
 * GET:  List sprint submissions (staff only)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { requireVerifiedEmailForWrite } from '@/src/modules/auth/utils/write-access';
import { isStaff } from '@/src/lib/permissions';
import { sanitizeInput } from '@/src/security/validation';
import { RATE_LIMITS } from '@/src/config/constants';
import {
  buildRateLimitResponse,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/src/security/rateLimiter';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import {
  MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER,
  MAX_SPRINT_SUBMISSION_IMAGES_TOTAL,
} from '@/src/config/uploads';

function isWithinWindow(now: number, start: Date, durationMinutes: number) {
  const startMs = start.getTime();
  const endMs = startMs + durationMinutes * 60_000;
  return now >= startMs && now <= endMs;
}

type StructuredAnswerPayload = {
  problemId?: unknown;
  type?: unknown;
  textAnswer?: unknown;
  selectedOptionId?: unknown;
  imageKeys?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const liveEventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!liveEventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
    }

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
      `live-events:submit:${identifier}`,
      RATE_LIMITS.LIVE_EVENT
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const staff = Boolean(user?.role && isStaff(user.role));

    const event = await prisma.liveEvent.findFirst({
      where: { id: liveEventId, deletedAt: null },
      select: { id: true, type: true, date: true, durationMinutes: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.type !== 'PROBLEM_SPRINT') {
      return NextResponse.json(
        { error: 'Submissions are only allowed for problem sprints.' },
        { status: 400 }
      );
    }

    if (!staff) {
      const enrollment = await prisma.liveEventEnrollment.findUnique({
        where: { liveEventId_userId: { liveEventId: event.id, userId } },
        select: { status: true },
      });
      if (!enrollment || enrollment.status !== 'CONFIRMED') {
        return NextResponse.json({ error: 'Registration not confirmed' }, { status: 403 });
      }

      const now = Date.now();
      if (!isWithinWindow(now, event.date, event.durationMinutes)) {
        return NextResponse.json(
          { error: 'Submission window is closed.' },
          { status: 409 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const existing = await prisma.liveEventSubmission.findUnique({
      where: { liveEventId_userId: { liveEventId: event.id, userId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'You already submitted.' }, { status: 409 });
    }

    const rawAnswers = Array.isArray(body?.answers) ? (body.answers as StructuredAnswerPayload[]) : null;

    // Legacy path (single plain-text submission).
    if (!rawAnswers) {
      const answer = typeof body?.answer === 'string' ? sanitizeInput(body.answer) : '';
      if (!answer || answer.length < 10) {
        return NextResponse.json(
          { error: 'Answer is required (min 10 characters).' },
          { status: 400 }
        );
      }
      if (answer.length > 20_000) {
        return NextResponse.json({ error: 'Answer is too long.' }, { status: 400 });
      }

      const submission = await prisma.liveEventSubmission.create({
        data: {
          liveEventId: event.id,
          userId,
          answer,
        },
        select: { id: true, createdAt: true },
      });

      return NextResponse.json(submission);
    }

    if (rawAnswers.length === 0) {
      return NextResponse.json({ error: 'answers[] cannot be empty.' }, { status: 400 });
    }

    // Structured path.
    let problems: Array<{
      id: string;
      order: number;
      type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
      prompt: string;
      options: Array<{ id: string; text: string }>;
    }> = [];
    try {
      problems = await prisma.liveEventProblem.findMany({
        where: { liveEventId: event.id },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          type: true,
          prompt: true,
          options: { orderBy: { order: 'asc' }, select: { id: true, text: true } },
        },
      });
    } catch (error) {
      if (isDbSchemaMismatch(error)) {
        return NextResponse.json(
          { error: 'Structured submissions are not available. Apply database migrations first.' },
          { status: 503 },
        );
      }
      throw error;
    }

    if (problems.length === 0) {
      return NextResponse.json(
        { error: 'This sprint has no problems configured yet.' },
        { status: 409 }
      );
    }

    const byProblemId = new Map(problems.map((p) => [p.id, p] as const));
    const seen = new Set<string>();
    const normalized = rawAnswers.map((a) => {
      const problemId = typeof a?.problemId === 'string' ? a.problemId.trim() : '';
      const type = typeof a?.type === 'string' ? a.type.trim() : '';
      const selectedOptionId =
        typeof a?.selectedOptionId === 'string' ? a.selectedOptionId.trim() : '';
      const textAnswer = typeof a?.textAnswer === 'string' ? sanitizeInput(a.textAnswer).slice(0, 20_000) : '';
      const imageKeys = Array.isArray(a?.imageKeys) ? (a.imageKeys as unknown[]) : [];
      const keys = imageKeys
        .map((k) => (typeof k === 'string' ? k.trim() : ''))
        .filter((k) => k && !k.includes('..'));

      return { problemId, type, selectedOptionId, textAnswer, imageKeys: keys };
    });

    for (const ans of normalized) {
      if (!ans.problemId) {
        return NextResponse.json({ error: 'problemId is required for every answer.' }, { status: 400 });
      }
      if (seen.has(ans.problemId)) {
        return NextResponse.json({ error: 'Duplicate problemId in answers.' }, { status: 400 });
      }
      seen.add(ans.problemId);

      const problem = byProblemId.get(ans.problemId);
      if (!problem) {
        return NextResponse.json({ error: 'Invalid problemId.' }, { status: 400 });
      }
      if (ans.type && ans.type !== problem.type) {
        return NextResponse.json({ error: 'Answer type mismatch.' }, { status: 400 });
      }

      if (problem.type === 'MULTIPLE_CHOICE') {
        if (!ans.selectedOptionId) {
          return NextResponse.json({ error: 'Multiple choice selection is required.' }, { status: 400 });
        }
        const allowed = new Set(problem.options.map((o) => o.id));
        if (!allowed.has(ans.selectedOptionId)) {
          return NextResponse.json({ error: 'Invalid selected option.' }, { status: 400 });
        }
      } else {
        if (!ans.textAnswer.trim()) {
          return NextResponse.json({ error: 'Short answer text is required.' }, { status: 400 });
        }
      }

      if (ans.imageKeys.length > MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER) {
        return NextResponse.json(
          { error: `Too many images for a single problem (max ${MAX_SPRINT_SUBMISSION_IMAGES_PER_ANSWER}).` },
          { status: 400 }
        );
      }
    }

    // Require answering every configured problem.
    if (seen.size !== problems.length) {
      return NextResponse.json({ error: 'You must answer every problem.' }, { status: 400 });
    }

    const totalImages = normalized.reduce((acc, a) => acc + a.imageKeys.length, 0);
    if (totalImages > MAX_SPRINT_SUBMISSION_IMAGES_TOTAL) {
      return NextResponse.json(
        { error: `Too many images attached (max ${MAX_SPRINT_SUBMISSION_IMAGES_TOTAL}).` },
        { status: 400 }
      );
    }

    const prefixBase = String(process.env.R2_SPRINT_SUBMISSIONS_PREFIX ?? 'sprint-submissions').replace(
      /^\/+|\/+$/g,
      ''
    );
    const requiredPrefix = `${prefixBase}/${event.id}/${userId}/`;
    for (const ans of normalized) {
      for (const key of ans.imageKeys) {
        if (!key.startsWith(requiredPrefix)) {
          return NextResponse.json({ error: 'Invalid image key.' }, { status: 400 });
        }
      }
    }

    const summaryLines: string[] = [];
    for (const p of problems) {
      const ans = normalized.find((x) => x.problemId === p.id)!;
      if (p.type === 'MULTIPLE_CHOICE') {
        const label = p.options.find((o) => o.id === ans.selectedOptionId)?.text ?? '(unknown option)';
        summaryLines.push(`Problem ${p.order} (MCQ): ${label}`);
      } else {
        summaryLines.push(`Problem ${p.order} (short): ${ans.textAnswer.trim()}`);
      }
      if (ans.imageKeys.length) summaryLines.push(`Images: ${ans.imageKeys.length}`);
      summaryLines.push('');
    }
    const summary = summaryLines.join('\n').trim().slice(0, 20_000) || '(submitted)';

    const submission = await prisma.liveEventSubmission.create({
      data: {
        liveEventId: event.id,
        userId,
        answer: summary,
        answers: {
          create: normalized.map((ans) => ({
            problemId: ans.problemId,
            type: (byProblemId.get(ans.problemId)!.type as any) ?? 'SHORT_ANSWER',
            textAnswer: byProblemId.get(ans.problemId)!.type === 'SHORT_ANSWER' ? ans.textAnswer.trim() : null,
            selectedOptionId:
              byProblemId.get(ans.problemId)!.type === 'MULTIPLE_CHOICE' ? ans.selectedOptionId : null,
            images: ans.imageKeys.length
              ? { create: ans.imageKeys.map((key, idx) => ({ order: idx + 1, key })) }
              : undefined,
          })),
        },
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(submission);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Submissions are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error submitting sprint answer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const liveEventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!liveEventId) {
      return NextResponse.json({ error: 'Live event id is required' }, { status: 400 });
    }

    const userId = await getCurrentSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !isStaff(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const identifier = getRateLimitIdentifier(request, userId);
    const rateLimit = await checkRateLimit(
      `live-events:submissions:list:${identifier}`,
      RATE_LIMITS.ADMIN_WRITE
    );
    if (!rateLimit.allowed) {
      const { status, body, headers } = buildRateLimitResponse(rateLimit);
      return NextResponse.json(body, { status, headers });
    }

    let submissions: any[] = [];
    try {
      submissions = await prisma.liveEventSubmission.findMany({
        where: { liveEventId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          answer: true,
          createdAt: true,
          answers: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              problemId: true,
              type: true,
              textAnswer: true,
              selectedOptionId: true,
              selectedOption: { select: { id: true, text: true } },
              images: { orderBy: { order: 'asc' }, select: { id: true, order: true, key: true } },
            },
          },
          user: {
            select: {
              id: true,
              publicId: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isDbSchemaMismatch(error)) throw error;
      try {
        submissions = await prisma.liveEventSubmission.findMany({
          where: { liveEventId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            answer: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                publicId: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
      } catch (fallbackError) {
        if (!isDbSchemaMismatch(fallbackError)) throw fallbackError;
        submissions = await prisma.liveEventSubmission.findMany({
          where: { liveEventId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            answer: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                publicId: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
      }
    }

    return NextResponse.json(submissions);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return NextResponse.json(
        { error: 'Submissions are temporarily unavailable. Apply database migrations first.' },
        { status: 503 },
      );
    }
    console.error('Error listing sprint submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
