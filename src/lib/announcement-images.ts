export function getAnnouncementImageSrc(imageUrl?: string | null): string | null {
  const raw = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  if (!raw) return null;

  if (raw.startsWith('/api/uploads/announcements/file')) return raw;

  // Proxy Cloudflare R2 public URLs through the app server to avoid public bucket access issues.
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const hostname = url.hostname.toLowerCase();
      const keyFromPath = url.pathname.replace(/^\/+/, '');
      const looksLikeAnnouncementObject = keyFromPath.startsWith('announcements/');
      const isR2Public =
        hostname.endsWith('.r2.dev') || hostname.endsWith('.r2.cloudflarestorage.com');

      // Also proxy custom CDN domains (e.g. `cdn.oyrenoyret.org`) as long as the path looks like an announcement object key.
      if (!isR2Public && !looksLikeAnnouncementObject) return raw;

      const key = keyFromPath;
      if (!key || key.includes('..')) return raw;

      return `/api/uploads/announcements/file?key=${encodeURIComponent(key)}`;
    } catch {
      return raw;
    }
  }

  return raw;
}
