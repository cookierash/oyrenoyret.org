/**
 * Credits Service
 *
 * Handles all credit calculations and transactions.
 * See docs/credits-specification.md for formulas.
 */

import { prisma } from '@/src/db/client';
import { recordUserActivity } from '@/src/modules/activity-stats';
import type { CreditTransactionType, Prisma } from '@prisma/client';
import type { CreditResult, MaterialCreditParams } from './credits.types';
import {
  DEFAULT_CREDITS,
  CREDITS_GROUP_SESSION,
  CREDITS_MATERIAL,
  CREDITS_DISCUSSION,
  CREDITS_SPRINT,
  SESSION_DURATIONS,
  type SessionDuration,
} from '@/src/config/credits';

export function roundCredits(value: number): number {
  return Math.round(value);
}

/** Execute transaction: update balance and log. Returns new balance or throws. */
async function executeTransaction(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  metadata?: Record<string, unknown>,
  referenceId?: string
): Promise<{ balanceAfter: number; transactionId: string }> {
  const amountRounded = roundCredits(amount);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    });
    const newBalance = user.credits + amountRounded;
    if (newBalance < 0) {
      throw new Error('INSUFFICIENT_CREDITS');
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amountRounded } },
      select: { credits: true },
    });
    const txRecord = await tx.creditTransaction.create({
      data: {
        userId,
        amount: amountRounded,
        balanceAfter: updated.credits,
        type,
        referenceId: referenceId ?? undefined,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
    return { balanceAfter: updated.credits, transactionId: txRecord.id };
  });
  return { balanceAfter: roundCredits(result.balanceAfter), transactionId: result.transactionId };
}

async function getBalanceWithClient(
  client: Prisma.TransactionClient | typeof prisma,
  userId: string
): Promise<number> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user ? roundCredits(user.credits) : 0;
}

/** Get current balance */
export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user ? roundCredits(user.credits) : 0;
}

function calcMaterialCreditValue(params: MaterialCreditParams): number {
  if (params.materialType === 'PRACTICE_TEST') {
    const questionCount = params.questionCount ?? 0;
    const extra = Math.max(0, questionCount - CREDITS_MATERIAL.PRACTICE_MIN_QUESTIONS);
    const steps = Math.floor(extra / CREDITS_MATERIAL.PRACTICE_STEP_QUESTIONS);
    return CREDITS_MATERIAL.PRACTICE_BASE_VALUE + steps;
  }
  const wordCount = params.wordCount ?? 0;
  const extra = Math.max(0, wordCount - CREDITS_MATERIAL.TEXTUAL_MIN_WORDS);
  const steps = Math.floor(extra / CREDITS_MATERIAL.TEXTUAL_STEP_WORDS);
  return CREDITS_MATERIAL.TEXTUAL_BASE_VALUE + steps;
}

/** Calculate material publish reward (integer). */
export function calcMaterialPublishCredit(_params: MaterialCreditParams): number {
  return calcMaterialCreditValue(_params);
}

/** Calculate material passive earning per unlock (integer). */
export function calcMaterialPassiveCredit(_params: MaterialCreditParams): number {
  return CREDITS_MATERIAL.PASSIVE_REWARD;
}

/** Calculate material unlock cost based on content size. */
export function calcMaterialUnlockCost(params: MaterialCreditParams): number {
  return calcMaterialCreditValue(params);
}

/** Calculate discussion create cost */
export function calcDiscussionCreateCost(): number {
  return CREDITS_DISCUSSION.BASE_CREATE;
}

/** Calculate discussion reply reward */
export function calcDiscussionReplyCredit(): number {
  return CREDITS_DISCUSSION.BASE_REPLY;
}

/** Calculate discussion help reward (accepted or upvoted) */
export function calcDiscussionHelpCredit(validation: 'accepted' | 'upvotes_2' | 'upvotes_1'): number {
  const mult =
    validation === 'accepted'
      ? CREDITS_DISCUSSION.VALIDATION_ACCEPTED
      : validation === 'upvotes_2'
        ? CREDITS_DISCUSSION.VALIDATION_UPVOTES_2
        : CREDITS_DISCUSSION.VALIDATION_UPVOTES_1;
  return CREDITS_DISCUSSION.BASE_HELP * mult;
}

/** Calculate sprint payout (credits). Only top 3 earn. */
export function calcSprintPayout(cost: number, rank: 1 | 2 | 3): number {
  const bonus = CREDITS_SPRINT.RANK_BONUS[rank] ?? 0;
  return roundCredits(cost + bonus);
}

function normalizeGroupSessionDuration(durationMinutes: number): SessionDuration {
  const durations = SESSION_DURATIONS as unknown as number[];
  if (durations.includes(durationMinutes)) return durationMinutes as SessionDuration;
  return 45;
}

export function calcGroupSessionParticipantCost(durationMinutes: number): number {
  const duration = normalizeGroupSessionDuration(durationMinutes);
  const factor = CREDITS_GROUP_SESSION.DURATION_PARTICIPANT[duration];
  return roundCredits(CREDITS_GROUP_SESSION.BASE_PARTICIPANT * factor);
}

export function calcGroupSessionFacilitatorPayout(
  durationMinutes: number,
  chargedLearnerCount: number,
  learnerCapacity: number,
): number {
  const duration = normalizeGroupSessionDuration(durationMinutes);
  const factor = CREDITS_GROUP_SESSION.DURATION_FACILITATOR[duration];
  const base = CREDITS_GROUP_SESSION.BASE_FACILITATOR * chargedLearnerCount * factor;
  const isFull = chargedLearnerCount >= learnerCapacity;
  const multiplier = isFull ? 1 + CREDITS_GROUP_SESSION.BONUS_FULL_SESSION : 1;
  return roundCredits(base * multiplier);
}

/** Grant credits on material publish (idempotent: only once per material via publishCreditsGrantedAt) */
export async function grantMaterialPublish(
  userId: string,
  params: MaterialCreditParams,
  materialId: string
): Promise<CreditResult> {
  const amount = roundCredits(calcMaterialPublishCredit(params));

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomically claim the publish reward (only first publish gets credits)
      const updated = await tx.material.updateMany({
        where: {
          id: materialId,
          userId,
          publishCreditsGrantedAt: null,
        },
        data: { publishCreditsGrantedAt: new Date() },
      });

      if (updated.count === 0) {
        return { granted: false, balanceAfter: 0 };
      }

      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });
      const afterUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { credits: true },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          balanceAfter: afterUser.credits,
          type: 'MATERIAL_PUBLISH',
          referenceId: materialId,
          metadata: { materialId, ...params } as object,
        },
      });
      return { granted: true, balanceAfter: roundCredits(afterUser.credits) };
    });

    if (!result.granted) {
      return { success: true, amount: 0, balanceAfter: await getBalance(userId) };
    }
    return {
      success: true,
      amount,
      balanceAfter: result.balanceAfter,
    };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Grant passive credits to publisher when someone unlocks */
export async function grantMaterialPassive(
  publisherUserId: string,
  params: MaterialCreditParams,
  materialId: string,
  consumerUserId: string
): Promise<CreditResult> {
  const amount = roundCredits(calcMaterialPassiveCredit(params));
  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      publisherUserId,
      amount,
      'MATERIAL_PASSIVE',
      { materialId, consumerUserId, ...params }
    );
    return { success: true, amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(publisherUserId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Deduct credits for material unlock; grant passive to publisher; create MaterialAccess */
export async function spendMaterialUnlock(
  userId: string,
  materialId: string,
  params: MaterialCreditParams,
  publisherUserId: string
): Promise<CreditResult> {
  const cost = roundCredits(calcMaterialUnlockCost(params));

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic conditional update: only deduct if balance >= cost (prevents race condition)
      const updateResult = await tx.user.updateMany({
        where: { id: userId, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
      });
      if (updateResult.count === 0) {
        throw new Error('INSUFFICIENT_CREDITS');
      }
      const afterUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { credits: true },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -cost,
          balanceAfter: afterUser.credits,
          type: 'MATERIAL_UNLOCK',
          metadata: { materialId, ...params } as object,
        },
      });
      // Create access record (idempotent: use create, unique constraint prevents duplicate)
      await tx.materialAccess.upsert({
        where: { userId_materialId: { userId, materialId } },
        create: { userId, materialId },
        update: {},
      });
      // Grant passive to publisher every N purchases (skip if same user)
      if (publisherUserId !== userId) {
        const purchaseCount = await tx.materialAccess.count({
          where: { materialId },
        });
        const everyN = CREDITS_MATERIAL.PASSIVE_EVERY_N_PURCHASES;
        if (purchaseCount % everyN === 0) {
          const passiveAmount = roundCredits(calcMaterialPassiveCredit(params));
          const referenceId = `${materialId}:passive:${purchaseCount}`;
          const existing = await tx.creditTransaction.findFirst({
            where: {
              type: 'MATERIAL_PASSIVE',
              referenceId,
            },
            select: { id: true },
          });
          if (!existing) {
            await tx.user.update({
              where: { id: publisherUserId },
              data: { credits: { increment: passiveAmount } },
            });
            const afterPub = await tx.user.findUniqueOrThrow({
              where: { id: publisherUserId },
              select: { credits: true },
            });
            await tx.creditTransaction.create({
              data: {
                userId: publisherUserId,
                amount: passiveAmount,
                balanceAfter: afterPub.credits,
                type: 'MATERIAL_PASSIVE',
                referenceId,
                metadata: { materialId, consumerUserId: userId, purchaseCount, ...params },
              },
            });
          }
        }
      }
      return { balanceAfter: afterUser.credits };
    });
    if (publisherUserId !== userId) {
      try {
        await recordUserActivity(publisherUserId, { materialsPurchasedFromUser: 1 });
      } catch (error) {
        console.error('[Material unlock] Activity tracking failed:', error);
      }
    }
    return { success: true, amount: -cost, balanceAfter: roundCredits(result.balanceAfter) };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Deduct credits for creating discussion */
export async function spendDiscussionCreate(
  userId: string,
  discussionId: string
): Promise<CreditResult> {
  const cost = roundCredits(calcDiscussionCreateCost());

  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      userId,
      -cost,
      'DISCUSSION_CREATE',
      discussionId !== 'pending' ? { discussionId } : undefined
    );
    return { success: true, amount: -cost, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Refund credits for discussions with no replies */
export async function refundDiscussionCreate(
  userId: string,
  discussionId: string,
  tx?: Prisma.TransactionClient
): Promise<CreditResult> {
  const refundAmount = roundCredits(calcDiscussionCreateCost());
  const client = tx ?? prisma;
  const run = async (): Promise<CreditResult> => {
    const existing = await client.creditTransaction.findFirst({
      where: {
        type: 'DISCUSSION_REFUND',
        referenceId: discussionId,
      },
      select: { id: true },
    });

    if (existing) {
      return {
        success: true,
        amount: 0,
        balanceAfter: await getBalanceWithClient(client, userId),
      };
    }

    const updated = await client.user.update({
      where: { id: userId },
      data: { credits: { increment: refundAmount } },
      select: { credits: true },
    });

    await client.creditTransaction.create({
      data: {
        userId,
        amount: refundAmount,
        balanceAfter: updated.credits,
        type: 'DISCUSSION_REFUND',
        referenceId: discussionId,
        metadata: { discussionId, reason: 'no_replies' },
      },
    });

    return {
      success: true,
      amount: refundAmount,
      balanceAfter: roundCredits(updated.credits),
    };
  };

  if (tx) {
    return run();
  }

  try {
    return await run();
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalanceWithClient(client, userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Deduct credits for sprint entry */
export async function spendSprintEntry(
  userId: string,
  cost: number,
  liveEventId?: string
): Promise<CreditResult> {
  const amount = roundCredits(cost);

  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      userId,
      -amount,
      'SPRINT_ENTRY',
      liveEventId ? { liveEventId, cost: amount } : undefined,
      liveEventId
    );
    return { success: true, amount: -amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Grant sprint payout to winner by rank (1-3). */
export async function grantSprintPayout(
  userId: string,
  cost: number,
  rank: 1 | 2 | 3,
  liveEventId?: string
): Promise<CreditResult> {
  const amount = roundCredits(calcSprintPayout(cost, rank));
  try {
    const referenceId = liveEventId ? `${liveEventId}:rank:${rank}` : undefined;
    const { balanceAfter, transactionId } = await executeTransaction(
      userId,
      amount,
      'SPRINT_PAYOUT',
      liveEventId ? { liveEventId, cost, rank } : { cost, rank },
      referenceId
    );
    return { success: true, amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Grant credits for replying to a discussion */
export async function grantDiscussionReply(
  userId: string,
  discussionId: string,
  replyId: string
): Promise<CreditResult> {
  const amount = roundCredits(calcDiscussionReplyCredit());
  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      userId,
      amount,
      'DISCUSSION_HELP', // Reusing DISCUSSION_HELP or could add DISCUSSION_REPLY, but we'll stick to DISCUSSION_HELP semantic or use a generic one if type mismatch. Actually, looking at types, maybe we should just use DISCUSSION_HELP with different validations. Let's use DISCUSSION_HELP.
      { discussionId, replyId, type: 'reply_post' },
      replyId
    );
    return { success: true, amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(userId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Check if we've already granted help credits for this reply */
export async function hasGrantedHelpForReply(replyId: string): Promise<boolean> {
  const existing = await prisma.creditTransaction.findFirst({
    where: {
      type: 'DISCUSSION_HELP',
      referenceId: replyId,
    },
  });
  return !!existing;
}

/** Grant credits to helper (reply author) when reply is accepted or upvoted */
export async function grantDiscussionHelp(
  helperUserId: string,
  discussionId: string,
  replyId: string,
  validation: 'accepted' | 'upvotes_2' | 'upvotes_1'
): Promise<CreditResult> {
  const amount = roundCredits(calcDiscussionHelpCredit(validation));
  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      helperUserId,
      amount,
      'DISCUSSION_HELP',
      { discussionId, replyId, validation },
      replyId
    );
    try {
      await recordUserActivity(helperUserId, { discussionHelps: 1 });
    } catch (error) {
      console.error('[Discussion help] Activity tracking failed:', error);
    }
    return { success: true, amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(helperUserId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

export async function spendGroupSessionParticipation(
  learnerUserId: string,
  sessionId: string,
  cost: number,
  enrollmentId: string,
): Promise<CreditResult> {
  const amount = roundCredits(cost);
  try {
    const existing = await prisma.creditTransaction.findFirst({
      where: {
        userId: learnerUserId,
        type: 'GROUP_SESSION_PARTICIPATE',
        referenceId: enrollmentId,
      },
      select: { id: true, amount: true, balanceAfter: true },
    });
    if (existing) {
      return {
        success: true,
        amount: roundCredits(existing.amount),
        balanceAfter: roundCredits(existing.balanceAfter),
        transactionId: existing.id,
      };
    }

    const { balanceAfter, transactionId } = await executeTransaction(
      learnerUserId,
      -amount,
      'GROUP_SESSION_PARTICIPATE',
      { sessionId, cost: amount, enrollmentId },
      enrollmentId,
    );
    return { success: true, amount: -amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(learnerUserId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

export async function grantGroupSessionFacilitation(
  facilitatorUserId: string,
  sessionId: string,
  payout: number,
  metadata?: Record<string, unknown>,
): Promise<CreditResult> {
  const amount = roundCredits(payout);
  try {
    const existing = await prisma.creditTransaction.findFirst({
      where: {
        userId: facilitatorUserId,
        type: 'GROUP_SESSION_FACILITATE',
        referenceId: sessionId,
      },
      select: { id: true, amount: true, balanceAfter: true },
    });
    if (existing) {
      return {
        success: true,
        amount: roundCredits(existing.amount),
        balanceAfter: roundCredits(existing.balanceAfter),
        transactionId: existing.id,
      };
    }

    const { balanceAfter, transactionId } = await executeTransaction(
      facilitatorUserId,
      amount,
      'GROUP_SESSION_FACILITATE',
      { sessionId, payout: amount, ...(metadata ?? {}) },
      sessionId,
    );
    return { success: true, amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(facilitatorUserId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

export async function spendGroupSessionCancelPenalty(
  facilitatorUserId: string,
  sessionId: string,
): Promise<CreditResult> {
  const amount = 1;
  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      facilitatorUserId,
      -amount,
      'GROUP_SESSION_CANCEL_PENALTY',
      { sessionId, penalty: amount, reason: 'cancel_with_registrations' },
      sessionId,
    );
    return { success: true, amount: -amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(facilitatorUserId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

export async function spendGroupSessionNoShowPenalty(
  facilitatorUserId: string,
  sessionId: string,
): Promise<CreditResult> {
  const amount = 1;
  try {
    const { balanceAfter, transactionId } = await executeTransaction(
      facilitatorUserId,
      -amount,
      'GROUP_SESSION_NO_SHOW_PENALTY',
      { sessionId, penalty: amount, reason: 'no_show' },
      sessionId,
    );
    return { success: true, amount: -amount, balanceAfter, transactionId };
  } catch (e) {
    return {
      success: false,
      amount: 0,
      balanceAfter: await getBalance(facilitatorUserId),
      error: e instanceof Error ? e.message : 'Transaction failed',
    };
  }
}

/** Ensure user has default credits on registration (idempotent) */
export async function ensureDefaultCredits(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  if (!user) return;
  if (user.credits < DEFAULT_CREDITS) {
    const toAdd = roundCredits(DEFAULT_CREDITS - user.credits);
    await executeTransaction(userId, toAdd, 'REGISTRATION', { reason: 'default_on_registration' });
  }
}
