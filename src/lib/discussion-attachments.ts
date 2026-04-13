import type { CompactRichTextImage } from '@/src/components/rich-text/compact-rich-text';

function escapeHtmlAttr(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function appendDiscussionAttachmentsToHtml(
  html: string,
  images: CompactRichTextImage[],
): string {
  const base = String(html ?? '').trim();
  if (!images?.length) return base;

  const imgs = images
    .filter((img) => typeof img?.src === 'string' && img.src.trim())
    .map((img) => {
      const src = escapeHtmlAttr(img.src.trim());
      const alt = escapeHtmlAttr((img.alt ?? '').trim());
      return `<p><img src="${src}" alt="${alt}" loading="lazy" decoding="async"></p>`;
    })
    .join('');

  if (!base) return imgs;
  return `${base}${imgs}`;
}

