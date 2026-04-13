import { describe, expect, it, vi } from 'vitest';

describe('email verification gating', () => {
  it('requires verified email for write actions regardless of role', async () => {
    vi.resetModules();

    const findUnique = vi.fn().mockResolvedValue({
      emailVerifiedAt: null,
      role: 'ADMIN',
      status: 'ACTIVE',
      suspensionUntil: null,
    });

    vi.doMock('@/src/db/client', () => ({
      prisma: {
        user: { findUnique, update: vi.fn() },
      },
    }));

    vi.doMock('@/src/db/schema-mismatch', () => ({
      isDbSchemaMismatch: () => false,
    }));

    const { requireVerifiedEmailForWrite } = await import('@/src/modules/auth/utils/write-access');
    const out = await requireVerifiedEmailForWrite('user_1');
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('Expected ok=false');
    expect(out.status).toBe(403);
    expect(out.errorKey).toBe('emailNotVerified');
  });

  it('treats a user as verified only when emailVerifiedAt is set', async () => {
    vi.resetModules();

    const findUnique = vi.fn();

    vi.doMock('@/src/db/client', () => ({
      prisma: {
        user: { findUnique },
      },
    }));

    const { isUserEmailVerified } = await import('@/src/modules/auth/utils/email-verification');

    findUnique.mockResolvedValueOnce({ emailVerifiedAt: null });
    await expect(isUserEmailVerified('user_1')).resolves.toBe(false);

    findUnique.mockResolvedValueOnce({ emailVerifiedAt: new Date('2026-04-13T00:00:00.000Z') });
    await expect(isUserEmailVerified('user_1')).resolves.toBe(true);
  });
});

