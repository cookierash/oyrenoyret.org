import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';
import type { MutedWindow } from './mute-windows';
import { buildMutedCreatedAtNotFilters } from './mute-windows';

export async function computeUnreadCount(params: {
  userId: string;
  notificationsReadAt: Date;
  repliesMutedWindows: MutedWindow[];
  creditsMutedWindows: MutedWindow[];
  sprintsMutedWindows: MutedWindow[];
  repliesOpenMutedFrom: Date | null;
  creditsOpenMutedFrom: Date | null;
  sprintsOpenMutedFrom: Date | null;
}): Promise<number> {
  const since = params.notificationsReadAt;

  const repliesNotFilters = buildMutedCreatedAtNotFilters(
    params.repliesMutedWindows,
    params.repliesOpenMutedFrom,
  );
  const creditsNotFilters = buildMutedCreatedAtNotFilters(
    params.creditsMutedWindows,
    params.creditsOpenMutedFrom,
  );
  const sprintsNotFilters = buildMutedCreatedAtNotFilters(
    params.sprintsMutedWindows,
    params.sprintsOpenMutedFrom,
  );

  const [replyCount, creditCount, sprintCount, moderationCount] = await Promise.all([
    prisma.discussionReply.count({
      where: {
        ...(repliesNotFilters.length ? { AND: repliesNotFilters } : {}),
        createdAt: { gt: since },
        userId: { not: params.userId },
        OR: [{ discussion: { userId: params.userId } }, { parentReply: { userId: params.userId } }],
      },
    }),
    prisma.creditTransaction.count({
      where: {
        ...(creditsNotFilters.length ? { AND: creditsNotFilters } : {}),
        userId: params.userId,
        createdAt: { gt: since },
      },
    }),
    (async () => {
      try {
        return await prisma.liveEventEnrollment.count({
          where: {
            ...(sprintsNotFilters.length ? { AND: sprintsNotFilters } : {}),
            userId: params.userId,
            createdAt: { gt: since },
            status: { in: ['PENDING', 'CANCELLED'] },
            liveEvent: { deletedAt: null, type: 'PROBLEM_SPRINT' },
          },
        });
      } catch (error) {
        if (isDbSchemaMismatch(error)) return 0;
        throw error;
      }
    })(),
    prisma.moderationNotice.count({
      where: { userId: params.userId, createdAt: { gt: since } },
    }),
  ]);

  return replyCount + creditCount + sprintCount + moderationCount;
}

