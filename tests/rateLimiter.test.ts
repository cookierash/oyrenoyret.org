import { describe, it, expect } from 'vitest';
import {
  checkRateLimit,
  buildRateLimitResponse,
  resetRateLimitStoreForTests,
} from '@/src/security/rateLimiter';

describe('rate limiter', () => {
  it('blocks after exceeding max requests', async () => {
    resetRateLimitStoreForTests();
    const config = { maxRequests: 2, windowMs: 1000 };

    const first = await checkRateLimit('test:limit', config);
    const second = await checkRateLimit('test:limit', config);
    const third = await checkRateLimit('test:limit', config);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);

    const response = buildRateLimitResponse(third);
    expect(response.status).toBe(429);
  });
});
