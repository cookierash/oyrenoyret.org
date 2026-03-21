import { Prisma } from '@prisma/client';
import { prisma } from '@/src/db/client';
import { getOrCreatePublicId } from '@/src/lib/public-id';

type ActivityDelta = Partial<{
  materialsSharedTextual: number;
  materialsSharedPractice: number;
  liveProblemSprintTop3: number;
  liveGuidedGroupFacilitated: number;
  discussionHelps: number;
  materialsPurchasedFromUser: number;
}>;

const FIELDS: (keyof ActivityDelta)[] = [
  'materialsSharedTextual',
  'materialsSharedPractice',
  'liveProblemSprintTop3',
  'liveGuidedGroupFacilitated',
  'discussionHelps',
  'materialsPurchasedFromUser',
];

export async function recordUserActivity(userId: string, delta: ActivityDelta) {
  const publicId = await getOrCreatePublicId(userId);
  if (!publicId) return;

  const createDelta: Record<keyof ActivityDelta, number> = {
    materialsSharedTextual: 0,
    materialsSharedPractice: 0,
    liveProblemSprintTop3: 0,
    liveGuidedGroupFacilitated: 0,
    discussionHelps: 0,
    materialsPurchasedFromUser: 0,
  };
  const updateDelta: Partial<Record<keyof ActivityDelta, { increment: number }>> = {};

  for (const field of FIELDS) {
    const value = delta[field] ?? 0;
    createDelta[field] = value;
    if (value !== 0) {
      updateDelta[field] = { increment: value };
    }
  }

  const createData: Prisma.UserActivityStatsUncheckedCreateInput = {
    userId,
    userPublicId: publicId,
    ...createDelta,
  };
  const updateData: Prisma.UserActivityStatsUpdateInput = {
    userPublicId: publicId,
    ...updateDelta,
  };

  await prisma.userActivityStats.upsert({
    where: { userId },
    create: createData,
    update: updateData,
  });
}
