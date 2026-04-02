/**
 * Logout API
 *
 * Clears the session and redirects to home.
 */

import { NextResponse } from 'next/server';
import { deleteSession } from '@/src/modules/auth/utils/session';

export async function POST(request: Request) {
  await deleteSession();
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.delete('session_token');
  return response;
}
