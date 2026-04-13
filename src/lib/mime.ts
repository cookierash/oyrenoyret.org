const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

export function inferContentTypeFromKey(key: string): string | null {
  const clean = key.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').filter(Boolean).pop() ?? '';
  const dot = last.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = last.slice(dot + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? null;
}

export function inferFilenameFromKey(key: string): string | null {
  const clean = key.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').filter(Boolean).pop() ?? '';
  return last ? last : null;
}

export function sanitizeContentDispositionFilename(name: string): string {
  // Keep it simple: avoid path separators, quotes, and control chars.
  return name.replace(/[\r\n]/g, '').replace(/[\\/"]/g, '_');
}

