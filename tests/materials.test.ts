import { describe, it, expect } from 'vitest';
import { getPracticeTestQuestionCount } from '@/src/modules/materials/utils';

describe('practice test question count', () => {
  it('counts questions from JSON content', () => {
    const content = JSON.stringify({ questions: [1, 2, 3] });
    expect(getPracticeTestQuestionCount(content)).toBe(3);
  });

  it('returns 0 for invalid JSON', () => {
    expect(getPracticeTestQuestionCount('not-json')).toBe(0);
  });
});
