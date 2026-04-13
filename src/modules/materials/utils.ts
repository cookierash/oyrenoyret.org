import { htmlToPlainTextWithNewlines } from '@/src/lib/html';

export function getPracticeTestQuestionCount(content: string | null | undefined): number {
  if (!content) return 0;
  try {
    const parsed = JSON.parse(content) as { questions?: unknown[] };
    return Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
  } catch {
    return 0;
  }
}

export function getTextWordCount(content: string | null | undefined): number {
  if (!content) return 0;
  const text = htmlToPlainTextWithNewlines(content).replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').filter(Boolean).length : 0;
}

export function splitObjectives(objectives: string | null | undefined): string[] {
  const raw = String(objectives ?? '').trim();
  if (!raw) return [];

  const looksLikeHtml =
    /<\/?[a-z][\s\S]*>/i.test(raw) ||
    /&lt;\s*\/?\s*[a-z][^&]*&gt;/i.test(raw) ||
    /&#0*60;\s*\/?\s*[a-z]/i.test(raw) ||
    /&#x0*3c;\s*\/?\s*[a-z]/i.test(raw);

  const text = looksLikeHtml ? htmlToPlainTextWithNewlines(raw) : raw;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
