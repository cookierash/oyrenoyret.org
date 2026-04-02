import { prisma } from '@/src/db/client';
import { toDayNumber } from '@/src/lib/streak';

export async function recordDailyVisit(userId: string, now = new Date()) {
  const dayNumber = toDayNumber(now);

  await prisma.userDailyVisit.upsert({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
    create: {
      userId,
      dayNumber,
      visitedAt: now,
    },
    update: {
      visitedAt: now,
    },
  });
}
