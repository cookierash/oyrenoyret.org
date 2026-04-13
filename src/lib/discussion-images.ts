export function getDiscussionImageSrc(src?: string | null): string | null {
  const raw = typeof src === 'string' ? src.trim() : '';
  if (!raw) return null;

  if (raw.startsWith('/api/uploads/discussions/file?key=')) return raw;

  if (raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const key = url.pathname.replace(/^\/+/, '');
      if (!key || key.includes('..')) return raw;
      if (!key.startsWith('discussions/')) return raw;
      return `/api/uploads/discussions/file?key=${encodeURIComponent(key)}`;
    } catch {
      return raw;
    }
  }

  return raw;
}

