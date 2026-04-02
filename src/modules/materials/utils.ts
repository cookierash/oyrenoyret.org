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
  const text = content
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}
