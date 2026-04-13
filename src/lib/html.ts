/**
 * Small HTML helpers that work in both server and client environments.
 */

const namedEntities: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(entity: string): string {
  const named = namedEntities[entity];
  if (named !== undefined) return named;

  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const code = Number.parseInt(entity.slice(2), 16);
    if (Number.isFinite(code)) return String.fromCodePoint(code);
    return `&${entity};`;
  }

  if (entity.startsWith('#')) {
    const code = Number.parseInt(entity.slice(1), 10);
    if (Number.isFinite(code)) return String.fromCodePoint(code);
    return `&${entity};`;
  }

  return `&${entity};`;
}

export function decodeHtmlEntitiesOnce(input: string): string {
  return String(input ?? '').replace(/&([a-zA-Z]+|#x[0-9a-fA-F]+|#[0-9]+);/g, (_m, entity) =>
    decodeEntity(String(entity)),
  );
}

/**
 * Decodes HTML entities only when the input looks like HTML that was escaped
 * (e.g. `&lt;p&gt;Hello&lt;/p&gt;`). Avoids altering normal rich text that already
 * contains real tags, or plain text that happens to include `&amp;` etc.
 */
export function maybeDecodeEscapedHtml(input: string): string {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';

  // Already has real tags → keep as-is.
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  // Looks like escaped tags → decode (a couple passes to handle double-escaping).
  const looksEscaped =
    /&lt;\s*\/?\s*[a-z][^&]*&gt;/i.test(trimmed) ||
    /&#0*60;\s*\/?\s*[a-z]/i.test(trimmed) ||
    /&#x0*3c;\s*\/?\s*[a-z]/i.test(trimmed);
  if (!looksEscaped) return trimmed;

  let decoded = trimmed;
  for (let i = 0; i < 2; i += 1) {
    const next = decodeHtmlEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function htmlToPlainTextWithNewlines(input: string): string {
  const html = maybeDecodeEscapedHtml(input);
  if (!html) return '';

  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|pre)>/gi, '\n');

  // Only strip real tags (e.g. `<p>`) so we don't eat comparison operators like `<` / `>`.
  return withBreaks
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

