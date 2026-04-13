import { describe, expect, it } from 'vitest';
import { getRateLimitIdentifierFromHeaders } from '@/src/security/rateLimiter';

describe('getRateLimitIdentifierFromHeaders', () => {
  it('prefers user ID when provided', () => {
    const out = getRateLimitIdentifierFromHeaders(new Headers(), 'abc123');
    expect(out).toBe('user:abc123');
  });

  it('uses the first IP from x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    const out = getRateLimitIdentifierFromHeaders(headers);
    expect(out).toBe('ip:1.2.3.4');
  });

  it('falls back to Cloudflare connecting IP when forwarded headers are absent', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.42' });
    const out = getRateLimitIdentifierFromHeaders(headers);
    expect(out).toBe('ip:203.0.113.42');
  });

  it('falls back to true-client-ip when forwarded headers are absent', () => {
    const headers = new Headers({ 'true-client-ip': '203.0.113.99' });
    const out = getRateLimitIdentifierFromHeaders(headers);
    expect(out).toBe('ip:203.0.113.99');
  });

  it('returns unknown when no IP headers exist', () => {
    const out = getRateLimitIdentifierFromHeaders(new Headers());
    expect(out).toBe('ip:unknown');
  });
});

