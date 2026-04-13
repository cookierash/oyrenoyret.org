import { describe, expect, it } from 'vitest';
import { isValidSlug, normalizeSlug, slugify } from '@/src/modules/curriculum/slug';

describe('curriculum slug', () => {
  it('slugifies Azerbaijani characters + spaces', () => {
    const out = slugify('Riyaziyyat və məntiq');
    expect(out).toBe('riyaziyyat-ve-mentiq');
    expect(isValidSlug(out)).toBe(true);
  });

  it('slugifies diacritics', () => {
    expect(slugify('Şəxsi inkişaf')).toBe('sexsi-inkisaf');
    expect(slugify('Ölçü və Üçbucaq')).toBe('olcu-ve-ucbucaq');
  });

  it('normalizeSlug is slugify', () => {
    expect(normalizeSlug('  Mathematics  ')).toBe('mathematics');
  });
});

