import type { NextConfig } from 'next';

/**
 * Next.js Configuration
 * 
 * Security headers and production-ready configuration.
 * All security headers are configured here to protect against common attacks.
 */

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: (() => {
    const r2PublicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').trim();
    const r2PrefixBase = String(process.env.R2_ANNOUNCEMENTS_PREFIX ?? 'announcements').replace(
      /^\/+|\/+$/g,
      '',
    );

    return {
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
      remotePatterns: (() => {
        const patterns: NonNullable<NextConfig['images']>['remotePatterns'] = [];

        if (r2PublicBaseUrl) {
          try {
            const url = new URL(r2PublicBaseUrl);
            patterns.push({
              protocol: url.protocol.replace(':', '') as 'http' | 'https',
              hostname: url.hostname,
              pathname: `${url.pathname.replace(/\/$/, '')}/**`,
            });
          } catch {
            // ignore invalid URL
          }
        }

        // Fallback: allow Cloudflare's public R2 domain even if build-time env vars are missing/mismatched.
        // This prevents Next/Image from rejecting valid `*.r2.dev` URLs returned by our upload signer.
        patterns.push({
          protocol: 'https',
          hostname: '*.r2.dev',
          pathname: `/${r2PrefixBase}/**`,
        });

        return patterns;
      })(),
    } satisfies NonNullable<NextConfig['images']>;
  })(),
  experimental: {
    // Reduces client bundle size for icon-heavy pages.
    optimizePackageImports: ['react-icons'],
  },
  // Explicitly declare Turbopack config to avoid Next 16 dev warnings/errors when a `webpack` config exists.
  turbopack: {},
  webpack: (config, { dev }) => {
    // In some environments, webpack's persistent filesystem cache can throw ENOENT
    // (missing pack files / manifests) and break dev routing. Disable it in dev.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const r2ConnectSrc = (() => {
      const base: string[] = [];
      const accountId = String(process.env.R2_ACCOUNT_ID ?? '').trim();
      if (accountId) {
        base.push(`https://${accountId}.r2.cloudflarestorage.com`);
      } else {
        base.push('https://*.r2.cloudflarestorage.com');
      }
      const endpoint = String(process.env.R2_ENDPOINT ?? '').trim();
      if (endpoint) {
        try {
          const url = new URL(endpoint);
          base.push(`${url.protocol}//${url.hostname}`);
        } catch {
          // ignore invalid URL
        }
      }
      return base.join(' ');
    })();
    const connectSrc = isDev
      ? `connect-src 'self' ws: wss: http://127.0.0.1:3000 http://localhost:3000 http://127.0.0.1:7242 http://localhost:7242 ${r2ConnectSrc}`
      : `connect-src 'self' ${r2ConnectSrc}`;
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline'";
    const securityDirectives = [
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-src 'none'",
      "script-src-attr 'none'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ];
    const prodOnlyDirectives = ["upgrade-insecure-requests", 'block-all-mixed-content'];

    return [
      // Immutable static image assets.
      {
        source: '/avatar-:rest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/partner:rest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/landing-page-screen.gif',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc, // 'unsafe-eval' needed for Next.js in dev
              "style-src 'self' 'unsafe-inline'", // 'unsafe-inline' needed for Tailwind
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              connectSrc,
              "frame-ancestors 'none'",
              ...securityDirectives,
              ...(isDev ? [] : prodOnlyDirectives),
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
