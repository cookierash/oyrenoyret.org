const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const AZ_CHAR_MAP: Record<string, string> = {
  Ə: 'e',
  ə: 'e',
  I: 'i',
  ı: 'i',
  İ: 'i',
};

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function slugify(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  const mapped = trimmed.replace(/[ƏəIıİ]/g, (ch) => AZ_CHAR_MAP[ch] ?? ch);
  const ascii = stripDiacritics(mapped).toLowerCase();

  return ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function normalizeSlug(input: unknown): string {
  return slugify(input);
}

export function isValidSlug(slug: string): boolean {
  return Boolean(slug) && slug.length <= 80 && SLUG_REGEX.test(slug);
}
