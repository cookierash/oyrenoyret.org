import { describe, it, expect } from 'vitest';
import { sanitizeInput, sanitizeHtml } from '@/src/security/validation';

describe('validation sanitizers', () => {
  it('strips HTML tags from plain input', () => {
    const result = sanitizeInput('  <b>Hi</b>  ');
    expect(result).toBe('Hi');
  });

  it('removes anchor tags from HTML content', () => {
    const result = sanitizeHtml('<p>Go to <a href="https://example.com">Example</a></p>');
    expect(result).toContain('Go to');
    expect(result).not.toContain('<a');
  });
});
