import { describe, expect, it } from 'vitest';
import { isDbSchemaMismatch } from '@/src/db/schema-mismatch';

describe('isDbSchemaMismatch', () => {
  it('detects Prisma missing table errors by message', () => {
    const error = new Error(
      'Invalid `prisma.subject.findMany()` invocation:\n\nThe table `public.Subject` does not exist in the current database.',
    );
    expect(isDbSchemaMismatch(error)).toBe(true);
  });

  it('detects Prisma missing table errors by code', () => {
    const error = { code: 'P2021', message: 'Table does not exist' };
    expect(isDbSchemaMismatch(error)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isDbSchemaMismatch(new Error('boom'))).toBe(false);
  });
});

