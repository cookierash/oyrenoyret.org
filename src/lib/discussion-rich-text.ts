import { richTextHtmlToPlainText } from '@/src/lib/rich-text';

export function discussionRichTextHasContent(html: string): boolean {
  const plain = richTextHtmlToPlainText(html);
  if (plain.length > 0) return true;
  return /<img\b/i.test(String(html ?? ''));
}

export function countDiscussionImages(html: string): number {
  return (String(html ?? '').match(/<img\b/gi) ?? []).length;
}

