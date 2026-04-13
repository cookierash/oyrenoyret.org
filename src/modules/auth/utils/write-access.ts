import { prisma } from '@/src/db/client';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

export async function requireVerifiedEmailForWrite(userId: string): Promise<
  | { ok: true }
  | { ok: false; status: 401; errorKey: 'unauthorized' }
  | { ok: false; status: 403; errorKey: 'emailNotVerified' | 'accountSuspended' | 'accountBanned'; error: string }
> {
  let user: { emailVerifiedAt: Date | null; role: string; status: string; suspensionUntil: Date | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, role: true, status: true, suspensionUntil: true },
    });
  } catch (error) {
    // Be tolerant during partial rollouts / baseline DBs where these columns may not exist yet.
    // Prefer allowing writes rather than failing with a 500 everywhere.
    if (isDbSchemaMismatch(error)) {
      console.warn('[write-access] Skipping verified-email checks due to DB schema mismatch.');
      return { ok: true };
    }
    throw error;
  }

  if (!user) return { ok: false, status: 401, errorKey: 'unauthorized' };

  // Account restrictions apply to all roles.
  if (user.status === 'BANNED') {
    return { ok: false, status: 403, errorKey: 'accountBanned', error: 'Account banned.' };
  }

  if (user.status === 'SUSPENDED') {
    const until = user.suspensionUntil;
    if (until && until.getTime() <= Date.now()) {
      // Suspension window expired; lift it opportunistically.
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'ACTIVE', suspensionUntil: null, suspensionReason: null },
          select: { id: true },
        });
      } catch (error) {
        if (!isDbSchemaMismatch(error)) throw error;
      }
    } else {
      return {
        ok: false,
        status: 403,
        errorKey: 'accountSuspended',
        error: 'Account suspended.',
      };
    }
  }

  if (!user.emailVerifiedAt) {
    return { ok: false, status: 403, errorKey: 'emailNotVerified', error: 'Email not verified.' };
  }

  return { ok: true };
}
