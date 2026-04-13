import crypto from 'crypto';
import { prisma } from '@/src/db/client';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

export function createEmailVerificationToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  return { token, tokenHash, expiresAt };
}

export function hashEmailVerificationToken(token: string): string {
  return hashToken(token);
}

export async function issueEmailVerificationToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenHash, expiresAt } = createEmailVerificationToken();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    throw new Error('User not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.emailVerificationToken.create({
      data: { userId, email: user.email, tokenHash, expiresAt },
    });
  });

  return { token, expiresAt };
}

export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (!user) return false;
  return Boolean(user.emailVerifiedAt);
}
