/**
 * Credits Service
 *
 * Handles all credit calculations and transactions.
 * See docs/credits-specification.md for formulas.
 */

import { prisma } from '@/src/db/client';
import type { CreditTransactionType } from '@prisma/client';
import type { CreditResult, MaterialCreditParams } from './credits.types';
import {
  DEFAULT_CREDITS,
  CREDITS_MATERIAL,
  CREDITS_DISCUSSION,
} from '@/src/config/credits';

export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
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

/** Get current balance */
export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user ? roundCredits(user.credits) : 0;
}

/** Calculate material publish reward. Textual: 0.5. Practice test: 0.5 + 0.05/question (cap 20). */
export function calcMaterialPublishCredit(params: MaterialCreditParams): number {
  const { materialType, questionCount = 0 } = params;
  if (materialType === 'PRACTICE_TEST') {
    const q = Math.min(questionCount, CREDITS_MATERIAL.PRACTICE_QUESTION_CAP_PUBLISH);
    return CREDITS_MATERIAL.BASE_PUBLISH + CREDITS_MATERIAL.PRACTICE_QUESTION_BONUS_PUBLISH * q;
  }
  return CREDITS_MATERIAL.BASE_PUBLISH;
}

/** Calculate material passive earning per unlock. Textual: 0.15. Practice test: 0.15 + 0.02/question (cap 15). */
export function calcMaterialPassiveCredit(params: MaterialCreditParams): number {
  const { materialType, questionCount = 0 } = params;
  if (materialType === 'PRACTICE_TEST') {
    const q = Math.min(questionCount, CREDITS_MATERIAL.PRACTICE_QUESTION_CAP_PASSIVE);
    return CREDITS_MATERIAL.BASE_PASSIVE + CREDITS_MATERIAL.PRACTICE_QUESTION_BONUS_PASSIVE * q;
  }
  return CREDITS_MATERIAL.BASE_PASSIVE;
}

/** Calculate material unlock cost. Textual: 2.0. Practice test: 2.0 + 0.03/question (cap 25). */
export function calcMaterialUnlockCost(params: MaterialCreditParams): number {
  const { materialType, questionCount = 0 } = params;
  if (materialType === 'PRACTICE_TEST') {
    const q = Math.min(questionCount, CREDITS_MATERIAL.PRACTICE_QUESTION_CAP_UNLOCK);
    return CREDITS_MATERIAL.BASE_UNLOCK + CREDITS_MATERIAL.PRACTICE_QUESTION_BONUS_UNLOCK * q;
  }
  return CREDITS_MATERIAL.BASE_UNLOCK;
}

/** Calculate discussion create cost */
export function calcDiscussionCreateCost(): number {
  return CREDITS_DISCUSSION.BASE_CREATE;
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
      // Grant passive to publisher (skip if same user)
      if (publisherUserId !== userId) {
        const passiveAmount = roundCredits(calcMaterialPassiveCredit(params));
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
            metadata: { materialId, consumerUserId: userId, ...params },
          },
        });
      }
      // Create access record (idempotent: use create, unique constraint prevents duplicate)
      await tx.materialAccess.upsert({
        where: { userId_materialId: { userId, materialId } },
        create: { userId, materialId },
        update: {},
      });
      return { balanceAfter: afterUser.credits };
    });
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
