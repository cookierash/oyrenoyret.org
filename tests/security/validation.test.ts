// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeDiscussionRichTextHtml, sanitizeRichTextHtml } from '@/src/security/validation';

describe('sanitizeRichTextHtml', () => {
  it('removes script tags', () => {
    const out = sanitizeRichTextHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>Hi</p>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/alert\s*\(/i);
  });

  it('strips event handler attributes (onerror/onclick/etc)', () => {
    const out = sanitizeRichTextHtml('<p onclick="alert(1)">Hi</p>');
    expect(out).toBe('<p>Hi</p>');
    expect(out).not.toMatch(/\son\w+=/i);
  });

  it('forbids images entirely (img tag removed)', () => {
    const out = sanitizeRichTextHtml('<p>Hi <img src=x onerror=alert(1)> there</p>');
    expect(out).toBe('<p>Hi  there</p>');
    expect(out).not.toMatch(/<img/i);
    expect(out).not.toMatch(/\sonerror=/i);
  });

  it('forbids links entirely (a tag removed but content kept)', () => {
    const out = sanitizeRichTextHtml('<p><a href="javascript:alert(1)">Click</a></p>');
    expect(out).toBe('<p>Click</p>');
    expect(out).not.toMatch(/<a/i);
    expect(out).not.toMatch(/javascript:/i);
  });

  it('restricts inline styles to hex color/background-color only', () => {
    const out = sanitizeRichTextHtml(
      '<span style="color: #ff00ff; position: fixed; top: 0; background-color: #000; background-image: url(javascript:alert(1))">X</span>',
    );
    expect(out).toMatch(/<span/i);
    expect(out).toMatch(/>X<\/span>/);
    expect(out).toMatch(/style="[^"]*color:\s*#ff00ff/i);
    expect(out).toMatch(/style="[^"]*background-color:\s*#000/i);
    expect(out).not.toMatch(/position:/i);
    expect(out).not.toMatch(/background-image/i);
    expect(out).not.toMatch(/javascript:/i);
  });
});

describe('sanitizeDiscussionRichTextHtml', () => {
  it('allows R2 discussion images for the configured public base URL', () => {
    const prev = process.env.R2_PUBLIC_BASE_URL;
    const prevPrefix = process.env.R2_DISCUSSIONS_PREFIX;
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      const out = sanitizeDiscussionRichTextHtml(
        '<img src="https://cdn.example.com/discussions/2026/04/abc.webp" alt="x" onerror="alert(1)">',
      );
      expect(out).toMatch(/<img/i);
      expect(out).toMatch(/cdn\.example\.com\/discussions\/2026\/04\/abc\.webp/i);
      expect(out).not.toMatch(/\sonerror=/i);
    } finally {
      if (prev === undefined) {
        delete process.env.R2_PUBLIC_BASE_URL;
      } else {
        process.env.R2_PUBLIC_BASE_URL = prev;
      }
      if (prevPrefix === undefined) {
        delete process.env.R2_DISCUSSIONS_PREFIX;
      } else {
        process.env.R2_DISCUSSIONS_PREFIX = prevPrefix;
      }
    }
  });

  it('rejects external image URLs', () => {
    const out = sanitizeDiscussionRichTextHtml('<p>Hi <img src="https://evil.example/x.png"></p>');
    expect(out).toBe('<p>Hi </p>');
    expect(out).not.toMatch(/<img/i);
  });

  it('rejects data URLs', () => {
    const out = sanitizeDiscussionRichTextHtml('<img src="data:image/png;base64,aaaa" alt="x">');
    expect(out).toBe('');
    expect(out).not.toMatch(/<img/i);
  });
});
