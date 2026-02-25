import type { NextConfig } from 'next';

/**
 * Next.js Configuration
 * 
 * Security headers and production-ready configuration.
 * All security headers are configured here to protect against common attacks.
 */

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const connectSrc = isDev
      ? "connect-src 'self' ws: wss: http://127.0.0.1:3000 http://localhost:3000 http://127.0.0.1:7242 http://localhost:7242"
      : "connect-src 'self'";

    return [
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-eval' needed for Next.js in dev
              "style-src 'self' 'unsafe-inline'", // 'unsafe-inline' needed for Tailwind
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              connectSrc,
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
