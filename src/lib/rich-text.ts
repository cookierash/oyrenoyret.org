/**
 * Rich text helpers that work in both server and client environments.
 */

export function richTextHtmlToPlainText(html: string): string {
  const input = String(html ?? '');
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|pre)>/gi, '\n')
    // Strip real tags only (avoid eating text like "<, >, =").
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function richTextHasContent(html: string): boolean {
  return richTextHtmlToPlainText(html).length > 0;
}
