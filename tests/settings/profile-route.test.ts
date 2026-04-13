import { describe, expect, it, vi } from 'vitest';

describe('settings profile route', () => {
  it('does not overwrite names when updating only avatarVariant', async () => {
    vi.resetModules();

    const update = vi.fn().mockResolvedValue({ id: 'user_1' });

    vi.doMock('@/src/modules/auth/utils/session', () => ({
      getCurrentSession: vi.fn().mockResolvedValue('user_1'),
    }));

    vi.doMock('@/src/security/rateLimiter', () => ({
      getRateLimitIdentifier: vi.fn().mockReturnValue('user_1'),
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      buildRateLimitResponse: vi.fn(),
    }));

    vi.doMock('@/src/lib/http-cache', () => ({
      getPrivateNoStoreHeaders: () => ({}),
    }));

    vi.doMock('@/src/config/constants', () => ({
      RATE_LIMITS: { WRITE: { limit: 1000, windowMs: 60_000 } },
    }));

    vi.doMock('@/src/db/client', () => ({
      prisma: {
        user: { update },
      },
    }));

    const { POST } = await import('@/app/api/settings/profile/route');

    const req = new Request('http://localhost/api/settings/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ avatarVariant: 'regular' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]?.[0] as { data?: Record<string, unknown> };
    expect(arg.data).toMatchObject({ avatarVariant: 'regular' });
    expect(arg.data).not.toHaveProperty('firstName');
    expect(arg.data).not.toHaveProperty('lastName');
  });

  it('updates only the provided name fields', async () => {
    vi.resetModules();

    const update = vi.fn().mockResolvedValue({ id: 'user_1' });

    vi.doMock('@/src/modules/auth/utils/session', () => ({
      getCurrentSession: vi.fn().mockResolvedValue('user_1'),
    }));

    vi.doMock('@/src/security/rateLimiter', () => ({
      getRateLimitIdentifier: vi.fn().mockReturnValue('user_1'),
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      buildRateLimitResponse: vi.fn(),
    }));

    vi.doMock('@/src/lib/http-cache', () => ({
      getPrivateNoStoreHeaders: () => ({}),
    }));

    vi.doMock('@/src/config/constants', () => ({
      RATE_LIMITS: { WRITE: { limit: 1000, windowMs: 60_000 } },
    }));

    vi.doMock('@/src/db/client', () => ({
      prisma: {
        user: { update },
      },
    }));

    const { POST } = await import('@/app/api/settings/profile/route');

    const req = new Request('http://localhost/api/settings/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstName: '  Alice  ' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]?.[0] as { data?: Record<string, unknown> };
    expect(arg.data).toMatchObject({ firstName: 'Alice' });
    expect(arg.data).not.toHaveProperty('lastName');
    expect(arg.data).not.toHaveProperty('avatarVariant');
  });
});

