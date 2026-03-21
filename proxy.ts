import { NextRequest, NextResponse } from 'next/server';

/**
 * Prevent a "landing page flash" for authenticated users.
 *
 * We intentionally only check for the presence of the session cookie here.
 * Full validation happens in server components / API routes (Node runtime).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If user hits the public home page and already has a session cookie,
  // send them straight to the dashboard.
  if (pathname === '/' && req.cookies.get('session_token')?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all pages except Next internals, API routes, and static assets.
    '/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};

