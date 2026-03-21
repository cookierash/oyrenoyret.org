import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/db/client';

const PUBLIC_ID_RETRIES = 5;

export function generatePublicId(): string {
  const raw = crypto.randomBytes(8).toString('hex');
  return raw.match(/.{1,4}/g)?.join('-') ?? raw;
}

export async function getOrCreatePublicId(userId: string): Promise<string | null> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicId: true },
  });

  if (!existing) return null;
  if (existing.publicId) return existing.publicId;

  for (let i = 0; i < PUBLIC_ID_RETRIES; i += 1) {
    const candidate = generatePublicId();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { publicId: candidate },
        select: { publicId: true },
      });
      return updated.publicId ?? candidate;
    } catch (error) {
      // Retry on unique constraint collisions.
      const isUnique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isUnique) {
        throw error;
      }
    }
  }

  return null;
}
