import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export type AcademicProgressSummary = {
  lifetimeCreditsEarned: number;
  guidedGroupSessionsFacilitated: number;
  guidedGroupTeachingMinutes: number;
  materialsPublishedTextual: number;
  materialsPublishedPracticeTests: number;
  discussionsStarted: number;
  discussionsReplied: number;
  replyReplies: number;
  problemSprintsRegistered: number;
  sprintFirstPlaces: number;
  sprintSecondPlaces: number;
  sprintThirdPlaces: number;
  liveEventsRegistered: number;
};

const ZERO_ACADEMIC_PROGRESS_SUMMARY: AcademicProgressSummary = {
  lifetimeCreditsEarned: 0,
  guidedGroupSessionsFacilitated: 0,
  guidedGroupTeachingMinutes: 0,
  materialsPublishedTextual: 0,
  materialsPublishedPracticeTests: 0,
  discussionsStarted: 0,
  discussionsReplied: 0,
  replyReplies: 0,
  problemSprintsRegistered: 0,
  sprintFirstPlaces: 0,
  sprintSecondPlaces: 0,
  sprintThirdPlaces: 0,
  liveEventsRegistered: 0,
};

export async function getAcademicProgressSummary(userId: string): Promise<AcademicProgressSummary> {
  let earnedCredits: { _sum: { amount: number | null } } = { _sum: { amount: 0 } };
  let guidedFacilitations = 0;
  let guidedFacilitationTxs: Array<{ metadata: unknown }> = [];
  let publishedTextual = 0;
  let publishedPractice = 0;
  let discussionsStarted = 0;
  let discussionsRepliedDistinct: Array<{ discussionId: string }> = [];
  let replyReplies = 0;
  let problemSprintsRegistered = 0;
  let sprintFirstPlaces = 0;
  let sprintSecondPlaces = 0;
  let sprintThirdPlaces = 0;
  let liveEventsRegistered = 0;

  try {
    [
      earnedCredits,
      guidedFacilitations,
      guidedFacilitationTxs,
      publishedTextual,
      publishedPractice,
      discussionsStarted,
      discussionsRepliedDistinct,
      replyReplies,
      problemSprintsRegistered,
      sprintFirstPlaces,
      sprintSecondPlaces,
      sprintThirdPlaces,
      liveEventsRegistered,
    ] = await Promise.all([
      prisma.creditTransaction.aggregate({
        where: { userId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.creditTransaction.count({
        where: { userId, type: 'GROUP_SESSION_FACILITATE' },
      }),
      prisma.creditTransaction.findMany({
        where: { userId, type: 'GROUP_SESSION_FACILITATE' },
        select: { metadata: true },
      }),
      prisma.material.count({
        where: {
          userId,
          materialType: 'TEXTUAL',
          status: 'PUBLISHED',
          deletedAt: null,
          removedAt: null,
        },
      }),
      prisma.material.count({
        where: {
          userId,
          materialType: 'PRACTICE_TEST',
          status: 'PUBLISHED',
          deletedAt: null,
          removedAt: null,
        },
      }),
      prisma.discussion.count({
        where: { userId, removedAt: null },
      }),
      prisma.discussionReply.findMany({
        where: { userId, removedAt: null },
        distinct: ['discussionId'],
        select: { discussionId: true },
      }),
      prisma.discussionReply.count({
        where: { userId, removedAt: null, parentReplyId: { not: null } },
      }),
      prisma.liveEventEnrollment.count({
        where: {
          userId,
          status: { not: 'CANCELLED' },
          liveEvent: { deletedAt: null, type: 'PROBLEM_SPRINT' },
        },
      }),
      prisma.creditTransaction.count({
        where: { userId, type: 'SPRINT_PAYOUT', referenceId: { endsWith: ':rank:1' } },
      }),
      prisma.creditTransaction.count({
        where: { userId, type: 'SPRINT_PAYOUT', referenceId: { endsWith: ':rank:2' } },
      }),
      prisma.creditTransaction.count({
        where: { userId, type: 'SPRINT_PAYOUT', referenceId: { endsWith: ':rank:3' } },
      }),
      prisma.liveEventEnrollment.count({
        where: {
          userId,
          status: { not: 'CANCELLED' },
          liveEvent: { deletedAt: null, type: 'EVENT' },
        },
      }),
    ]);
  } catch (error) {
    if (isDbSchemaMismatch(error)) {
      return ZERO_ACADEMIC_PROGRESS_SUMMARY;
    }
    throw error;
  }

  const guidedGroupTeachingMinutes = guidedFacilitationTxs.reduce((sum, tx) => {
    const metadata = tx.metadata as Record<string, unknown> | null;
    if (!metadata) return sum;
    const raw =
      metadata.durationMinutes ??
      metadata.duration ??
      metadata.minutes ??
      (metadata.sessionDurationMinutes as unknown);
    const minutes = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum;
  }, 0);

  return {
    lifetimeCreditsEarned: earnedCredits._sum.amount ?? 0,
    guidedGroupSessionsFacilitated: guidedFacilitations,
    guidedGroupTeachingMinutes,
    materialsPublishedTextual: publishedTextual,
    materialsPublishedPracticeTests: publishedPractice,
    discussionsStarted,
    discussionsReplied: discussionsRepliedDistinct.length,
    replyReplies,
    problemSprintsRegistered,
    sprintFirstPlaces,
    sprintSecondPlaces,
    sprintThirdPlaces,
    liveEventsRegistered,
  };
}
